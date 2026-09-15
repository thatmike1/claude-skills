import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DEFAULT_TICK_MINUTES = 25;
const MIN_TICK_MINUTES = 10;
const MAX_TICK_MINUTES = 30;
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000];
const PHASES = new Set(['idle', 'running', 'paused', 'break', 'stopped']);
const VERDICTS = new Set(['on-plan', 'drift', 'break', 'unknown']);
const SKILL_PATH = fileURLToPath(new URL('../SKILL.md', import.meta.url));

export class WardenError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'WardenError';
    this.code = code;
    this.status = status;
  }
}

/** return a new empty persisted state. */
export function emptyState(now = new Date()) {
  return {
    version: 1,
    revision: 0,
    phase: 'idle',
    binding: null,
    endAt: null,
    blocks: [],
    current: null,
    break: null,
    nextTickAt: null,
    pendingTick: null,
    reminders: [],
    lastVerdict: null,
    lastError: null,
    updatedAt: now.toISOString(),
  };
}

/** own the durable Warden state and all serialized mutations. */
export class WardenController {
  constructor({
    stateDir,
    dispatcher,
    notifier = async () => {},
    widgetWriter = async () => {},
    now = () => new Date(),
    retryDelaysMs = RETRY_DELAYS_MS,
    controlUrl = 'http://127.0.0.1:1339',
  }) {
    if (!stateDir) throw new TypeError('stateDir is required');
    if (typeof dispatcher !== 'function') throw new TypeError('dispatcher is required');
    this.statePath = join(stateDir, 'state.json');
    this.dispatcher = dispatcher;
    this.notifier = notifier;
    this.widgetWriter = widgetWriter;
    this.now = now;
    this.retryDelaysMs = retryDelaysMs;
    this.controlUrl = controlUrl;
    this.state = emptyState(this.now());
    this.queue = Promise.resolve();
  }

  /** load existing state, making an interrupted dispatch safe after restart. */
  async init() {
    await mkdir(dirname(this.statePath), { recursive: true });
    try {
      const loaded = JSON.parse(await readFile(this.statePath, 'utf8'));
      validatePersistedState(loaded);
      this.state = loaded;
      if (loaded.pendingTick?.status === 'acknowledged') {
        finalizeAcknowledgedTick(loaded, this.now());
        this.state = loaded;
        await this.#commit(this.state);
      } else if (loaded.pendingTick?.status === 'dispatching') {
        this.state = {
          ...loaded,
          pendingTick: {
            ...loaded.pendingTick,
            status: 'awaiting',
            error: 'service restarted while dispatch outcome was unknown',
          },
          lastError: {
            code: 'dispatch-outcome-unknown',
            message: 'A tick may already be in T3. Acknowledge it before another is sent.',
            at: this.now().toISOString(),
          },
        };
        await this.#commit(this.state);
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      await this.#commit(this.state);
    }
    await this.#publishWidget();
    return this.getState();
  }

  /** return a safe snapshot with the live remaining time calculated. */
  getState() {
    const snapshot = structuredClone(this.state);
    if (snapshot.binding?.bearerTokenFile) {
      delete snapshot.binding.bearerTokenFile;
      snapshot.binding.credential = 'file';
    }
    if (snapshot.phase === 'running' && snapshot.current?.dueAt) {
      snapshot.current.remainingSeconds = Math.max(
        0,
        Math.ceil((Date.parse(snapshot.current.dueAt) - this.now().getTime()) / 1000),
      );
    }
    if (snapshot.phase === 'break' && snapshot.break?.dueAt) {
      snapshot.break.remainingSeconds = Math.max(
        0,
        Math.ceil((Date.parse(snapshot.break.dueAt) - this.now().getTime()) / 1000),
      );
    }
    return snapshot;
  }

  /** return the private dispatch binding for local trusted integrations. */
  getBinding() {
    return this.state.binding ? structuredClone(this.state.binding) : null;
  }

  /** refresh the widget timestamp without changing durable state. */
  async publishHeartbeat() {
    await this.#publishWidget();
  }

  /** apply one API action without allowing interleaved state writes. */
  action(payload) {
    return this.#serialize(async () => {
      assertPlainObject(payload, 'request body');
      const action = requiredString(payload.action, 'action');
      const draft = structuredClone(this.state);
      const now = this.now();

      switch (action) {
        case 'start':
          applyStart(draft, payload, now);
          break;
        case 'done':
          requireActive(draft);
          finishBlock(draft, payload.id, 'done', now);
          break;
        case 'skip':
          requireActive(draft);
          finishBlock(draft, payload.id, 'skipped', now);
          break;
        case 'extend':
          requireRunning(draft);
          extendCurrent(draft, positiveInteger(payload.minutes, 'minutes'), now);
          break;
        case 'pause':
          pause(draft, now);
          break;
        case 'resume':
          resume(draft, now);
          break;
        case 'break':
          beginBreak(draft, positiveInteger(payload.minutes, 'minutes'), now);
          break;
        case 'stop':
          stop(draft, now, 'stopped by user');
          break;
        case 'check-in':
          checkIn(draft, payload, now);
          break;
        case 'replan':
          replan(draft, payload, now);
          break;
        case 'ack-reminder':
          acknowledgeReminder(draft, payload.id, now);
          break;
        case 'snooze-reminder':
          snoozeReminder(draft, payload.id, positiveInteger(payload.minutes, 'minutes'), now);
          break;
        default:
          throw new WardenError('unknown-action', `Unknown action: ${action}`);
      }

      validatePersistedState(draft);
      await this.#commit(draft);
      return this.getState();
    });
  }

  /** process elapsed end, reminders, and at most one scheduled tick. */
  async processDue() {
    let dispatch = null;
    const notifications = [];

    await this.#serialize(async () => {
      const draft = structuredClone(this.state);
      const now = this.now();
      let changed = false;

      if (isPast(draft.endAt, now) && !['idle', 'stopped'].includes(draft.phase)) {
        stop(draft, now, 'day ended');
        changed = true;
      }

      if (['running', 'break'].includes(draft.phase)) {
        for (const reminder of draft.reminders) {
          const dueAt = reminder.snoozedUntil ?? reminder.at;
          if (reminder.status === 'pending' && isPast(dueAt, now)) {
            reminder.status = 'due';
            reminder.dueAt = now.toISOString();
            notifications.push({ title: 'warden reminder', body: reminder.title });
            changed = true;
          }
        }
      }

      if (draft.phase === 'break' && draft.break?.dueAt && isPast(draft.break.dueAt, now)) {
        draft.phase = 'running';
        draft.break = null;
        if (draft.current) {
          draft.current.startedAt = now.toISOString();
          draft.current.dueAt = addSeconds(now, draft.current.remainingSeconds).toISOString();
        }
        draft.nextTickAt = now.toISOString();
        changed = true;
      }

      if (
        draft.phase === 'running'
        && !draft.pendingTick
        && isPast(draft.nextTickAt, now)
        && !isPast(draft.endAt, now)
      ) {
        const pendingTick = makePendingTick(draft, now, 'scheduled check');
        draft.pendingTick = pendingTick;
        draft.nextTickAt = null;
        dispatch = { id: pendingTick.id, text: makeTickPrompt(pendingTick.id, this.controlUrl), binding: draft.binding };
        changed = true;
      } else if (
        draft.phase === 'running'
        && draft.pendingTick?.status === 'retry'
        && isPast(draft.pendingTick.nextAttemptAt, now)
        && !isPast(draft.endAt, now)
      ) {
        draft.pendingTick.status = 'dispatching';
        draft.pendingTick.attempt += 1;
        draft.pendingTick.nextAttemptAt = null;
        draft.pendingTick.error = null;
        dispatch = {
          id: draft.pendingTick.id,
          text: makeTickPrompt(draft.pendingTick.id, this.controlUrl),
          binding: draft.binding,
        };
        changed = true;
      }

      if (changed) await this.#commit(draft);
    });

    for (const notification of notifications) {
      try {
        await this.notifier(notification);
      } catch (error) {
        await this.#recordError('notification-failed', error);
      }
    }

    if (!dispatch) return { dispatched: false, state: this.getState() };

    const stillCurrent = await this.#serialize(async () => {
      const now = this.now();
      if (isPast(this.state.endAt, now) && !['idle', 'stopped'].includes(this.state.phase)) {
        const draft = structuredClone(this.state);
        stop(draft, now, 'day ended');
        await this.#commit(draft);
        return false;
      }
      return this.state.phase === 'running'
        && this.state.pendingTick?.id === dispatch.id
        && this.state.pendingTick.status === 'dispatching';
    });
    if (!stillCurrent) return { dispatched: false, state: this.getState() };

    try {
      const result = await this.dispatcher(dispatch.binding, { id: dispatch.id, text: dispatch.text });
      await this.#serialize(async () => {
        if (this.state.pendingTick?.id !== dispatch.id) return;
        const draft = structuredClone(this.state);
        if (draft.pendingTick.status === 'acknowledged') {
          finalizeAcknowledgedTick(draft, this.now());
          draft.lastError = null;
          await this.#commit(draft);
          return;
        }
        draft.pendingTick.status = 'awaiting';
        draft.pendingTick.dispatchedAt = this.now().toISOString();
        draft.pendingTick.result = compactDispatchResult(result);
        draft.lastError = null;
        await this.#commit(draft);
      });
      return { dispatched: true, result, state: this.getState() };
    } catch (error) {
      await this.#serialize(async () => {
        if (this.state.pendingTick?.id !== dispatch.id) return;
        const draft = structuredClone(this.state);
        const pending = draft.pendingTick;
        if (pending.status === 'acknowledged') {
          finalizeAcknowledgedTick(draft, this.now());
          await this.#commit(draft);
          return;
        }
        const delay = this.retryDelaysMs[pending.attempt - 1];
        pending.error = safeErrorMessage(error);
        if (delay === undefined || isPast(draft.endAt, new Date(this.now().getTime() + delay))) {
          pending.status = 'failed';
          pending.nextAttemptAt = null;
        } else {
          pending.status = 'retry';
          pending.nextAttemptAt = new Date(this.now().getTime() + delay).toISOString();
        }
        draft.lastError = {
          code: 'dispatch-failed',
          message: pending.error,
          at: this.now().toISOString(),
        };
        await this.#commit(draft);
      });
      return { dispatched: false, error: safeErrorMessage(error), state: this.getState() };
    }
  }

  #serialize(operation) {
    const result = this.queue.then(operation, operation);
    this.queue = result.catch(() => {});
    return result;
  }

  async #commit(nextState) {
    const committed = structuredClone(nextState);
    committed.revision = this.state.revision + 1;
    committed.updatedAt = this.now().toISOString();
    const temporaryPath = `${this.statePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(committed, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryPath, this.statePath);
    this.state = committed;
    await this.#publishWidget();
  }

  async #publishWidget() {
    await this.widgetWriter(toWidget(this.getState(), this.now()));
  }

  async #recordError(code, error) {
    await this.#serialize(async () => {
      const draft = structuredClone(this.state);
      draft.lastError = { code, message: safeErrorMessage(error), at: this.now().toISOString() };
      await this.#commit(draft);
    });
  }
}

/** create the read-only T3 widget representation. */
export function toWidget(state, now = new Date()) {
  const currentBlock = state.current?.blockId
    ? state.blocks.find((block) => block.id === state.current.blockId)
    : null;
  const dueReminderCount = state.reminders.filter((reminder) => reminder.status === 'due').length;
  let widgetState = 'off';
  if (state.lastError || ['failed', 'retry'].includes(state.pendingTick?.status)) widgetState = 'error';
  else if (state.pendingTick || dueReminderCount > 0) widgetState = 'attention';
  else if (['running', 'break'].includes(state.phase)) widgetState = 'ok';

  const rows = [];
  if (currentBlock) {
    rows.push({
      label: `Now: ${currentBlock.title}`,
      hint: state.phase === 'paused'
        ? 'paused'
        : state.phase === 'break'
          ? 'on a break'
          : state.current.remainingSeconds <= 0
            ? 'ready for a check'
            : `${Math.max(1, Math.ceil(state.current.remainingSeconds / 60))} min`,
    });
  }
  const time = (value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const nextBlock = state.blocks.find(block => block.status === 'pending');
  if (nextBlock && state.phase !== 'stopped') rows.push({ label: `Next: ${nextBlock.title}`, hint: `${nextBlock.minutes} min` });
  if (state.phase === 'break' && state.break?.dueAt) rows.push({ label: 'Back at', hint: time(state.break.dueAt) });
  if (state.nextTickAt) rows.push({ label: 'Next check', hint: time(state.nextTickAt) });
  if (state.endAt && !['idle', 'stopped'].includes(state.phase)) rows.push({ label: 'Finish', hint: time(state.endAt) });
  if (state.pendingTick) rows.push({ label: 'Check-in', hint: state.pendingTick.status === 'awaiting' ? 'sent to T3' : state.pendingTick.status });
  if (dueReminderCount) rows.push({ label: 'reminders', hint: `${dueReminderCount} ready` });
  if (!rows.length) rows.push({ label: 'warden', hint: state.phase });

  return {
    id: 'warden',
    icon: 'clock',
    label: state.phase === 'running' && state.current ? `${Math.max(0, Math.ceil(state.current.remainingSeconds / 60))}m` : ({ idle: 'Warden', paused: 'Paused', break: 'Break', stopped: 'Done' }[state.phase] ?? 'Warden'),
    tooltip: state.lastError?.message ?? currentBlock?.title ?? 'Warden is idle',
    state: widgetState,
    rows,
    updatedAt: Math.floor(now.getTime() / 1000),
    staleAfterSeconds: 90,
  };
}

function applyStart(state, payload, now) {
  const binding = validateBinding(payload.binding);
  const endAt = requiredFutureDate(payload.endAt, 'endAt', now);
  const blocks = validateBlocks(payload.blocks);
  const reminders = validateReminders(payload.reminders ?? [], now, endAt);
  state.phase = 'running';
  state.binding = binding;
  state.endAt = endAt.toISOString();
  state.blocks = blocks.map((block, index) => ({
    ...block,
    estimateMinutes: block.minutes,
    activeSeconds: 0,
    status: index === 0 ? 'current' : 'pending',
    ...(index === 0 ? { startedAt: now.toISOString() } : {}),
  }));
  state.current = makeCurrent(blocks[0], now);
  state.break = null;
  state.nextTickAt = nextTickTime(state, now, DEFAULT_TICK_MINUTES);
  state.pendingTick = null;
  state.reminders = reminders;
  state.lastVerdict = null;
  state.lastError = null;
}

function finishBlock(state, requestedId, status, now) {
  const id = requestedId === undefined ? state.current?.blockId : requiredString(requestedId, 'id');
  if (!id || id !== state.current?.blockId) {
    throw new WardenError('not-current-block', 'Only the current block can be finished');
  }
  const block = state.blocks.find((candidate) => candidate.id === id);
  accrueActive(state, now);
  block.status = status;
  block.completedAt = now.toISOString();
  const next = state.blocks.find((candidate) => candidate.status === 'pending');
  if (!next) {
    stop(state, now, 'all blocks finished');
    return;
  }
  next.status = 'current';
  next.startedAt = now.toISOString();
  state.current = makeCurrent(next, now);
  state.nextTickAt = nextTickTime(state, now, DEFAULT_TICK_MINUTES);
  state.pendingTick = null;
  state.phase = 'running';
}

function extendCurrent(state, minutes, now) {
  accrueActive(state, now);
  const block = state.blocks.find((candidate) => candidate.id === state.current.blockId);
  block.minutes += minutes;
  state.current.remainingSeconds = currentRemainingSeconds(state, now) + minutes * 60;
  state.current.dueAt = addSeconds(now, state.current.remainingSeconds).toISOString();
  state.nextTickAt = nextTickTime(state, now, DEFAULT_TICK_MINUTES);
}

function pause(state, now) {
  requireRunning(state);
  if (!state.current) throw new WardenError('no-current-block', 'There is no current block to pause');
  accrueActive(state, now);
  state.current.remainingSeconds = currentRemainingSeconds(state, now);
  state.current.startedAt = null;
  state.current.dueAt = null;
  state.phase = 'paused';
  state.nextTickAt = null;
  state.pendingTick = null;
}

function resume(state, now) {
  if (!['paused', 'break'].includes(state.phase)) throw new WardenError('not-paused', 'Warden is not paused or on a break');
  if (!state.current) throw new WardenError('no-current-block', 'There is no current block to resume');
  if (isPast(state.endAt, now)) {
    stop(state, now, 'day ended');
    return;
  }
  state.phase = 'running';
  state.break = null;
  state.current.startedAt = now.toISOString();
  state.current.dueAt = addSeconds(now, state.current.remainingSeconds).toISOString();
  state.nextTickAt = nextTickTime(state, now, DEFAULT_TICK_MINUTES);
}

function beginBreak(state, minutes, now) {
  requireActive(state);
  if (state.phase === 'break') throw new WardenError('already-on-break', 'A break is already active');
  if (!state.current) throw new WardenError('no-current-block', 'There is no current block to pause for a break');
  if (state.phase === 'running') accrueActive(state, now);
  const remainingSeconds = state.phase === 'running' ? currentRemainingSeconds(state, now) : state.current.remainingSeconds;
  state.current = { ...state.current, startedAt: null, dueAt: null, remainingSeconds };
  state.phase = 'break';
  state.break = {
    startedAt: now.toISOString(),
    dueAt: addMinutes(now, minutes).toISOString(),
    remainingSeconds: minutes * 60,
  };
  state.nextTickAt = null;
  state.pendingTick = null;
}

function checkIn(state, payload, now) {
  requireRunning(state);
  const tickId = requiredString(payload.id, 'id');
  if (!state.pendingTick || state.pendingTick.id !== tickId) {
    throw new WardenError('stale-tick', 'This check-in no longer matches the pending Warden tick', 409);
  }
  const verdict = requiredString(payload.verdict, 'verdict');
  if (!VERDICTS.has(verdict)) {
    throw new WardenError('invalid-verdict', 'verdict must be on-plan, drift, break, or unknown');
  }
  const note = optionalShortString(payload.note, 'note', 500);
  const defaultMinutes = verdict === 'drift' ? 12 : DEFAULT_TICK_MINUTES;
  const nextMinutes = payload.nextMinutes === undefined
    ? defaultMinutes
    : integerInRange(payload.nextMinutes, 'nextMinutes', MIN_TICK_MINUTES, MAX_TICK_MINUTES);
  if (verdict === 'drift' && nextMinutes > 15) {
    throw new WardenError('invalid-next-minutes', 'drift check-ins must schedule the next check in 10 to 15 minutes');
  }
  if (verdict === 'on-plan' && nextMinutes < 25) {
    throw new WardenError('invalid-next-minutes', 'on-plan check-ins must schedule the next check in 25 to 30 minutes');
  }
  state.lastVerdict = { verdict, note: note ?? null, at: now.toISOString() };
  if (state.pendingTick.status === 'dispatching') {
    state.pendingTick.status = 'acknowledged';
    state.pendingTick.acknowledgedAt = now.toISOString();
    state.pendingTick.nextMinutes = nextMinutes;
    state.nextTickAt = null;
  } else {
    state.pendingTick = null;
    state.nextTickAt = nextTickTime(state, now, nextMinutes);
  }
  state.lastError = null;
}

function replan(state, payload, now) {
  requireActive(state);
  const replacements = validateBlocks(payload.blocks, { allowEmpty: true });
  const retained = state.blocks.filter((block) => block.status !== 'pending');
  const retainedIds = new Set(retained.map((block) => block.id));
  for (const block of replacements) {
    if (retainedIds.has(block.id)) {
      throw new WardenError('duplicate-block-id', `Block id is already used: ${block.id}`);
    }
  }
  state.blocks = [...retained, ...replacements.map((block) => ({
    ...block,
    estimateMinutes: block.minutes,
    activeSeconds: 0,
    status: 'pending',
  }))];
  if (payload.endAt !== undefined) state.endAt = requiredFutureDate(payload.endAt, 'endAt', now).toISOString();
  if (!state.current && replacements.length) {
    const first = state.blocks.find((block) => block.status === 'pending');
    first.status = 'current';
    first.startedAt = now.toISOString();
    state.current = makeCurrent(first, now);
    state.phase = 'running';
    state.nextTickAt = nextTickTime(state, now, DEFAULT_TICK_MINUTES);
  }
}

function acknowledgeReminder(state, rawId, now) {
  const reminder = findReminder(state, rawId);
  reminder.status = 'acked';
  reminder.ackedAt = now.toISOString();
  reminder.snoozedUntil = null;
}

function snoozeReminder(state, rawId, minutes, now) {
  const reminder = findReminder(state, rawId);
  reminder.status = 'pending';
  reminder.snoozedUntil = addMinutes(now, minutes).toISOString();
  delete reminder.dueAt;
}

function findReminder(state, rawId) {
  const id = requiredString(rawId, 'id');
  const reminder = state.reminders.find((candidate) => candidate.id === id);
  if (!reminder) throw new WardenError('unknown-reminder', `Unknown reminder: ${id}`);
  return reminder;
}

function stop(state, now, reason) {
  if (state.phase === 'idle') throw new WardenError('not-started', 'Warden has not started');
  if (state.phase === 'running') accrueActive(state, now);
  state.phase = 'stopped';
  state.current = null;
  state.break = null;
  state.nextTickAt = null;
  state.pendingTick = null;
  state.stoppedAt = now.toISOString();
  state.stopReason = reason;
  for (const reminder of state.reminders) {
    if (['pending', 'due'].includes(reminder.status)) reminder.status = 'cancelled';
  }
}

function makeCurrent(block, now) {
  return {
    blockId: block.id,
    startedAt: now.toISOString(),
    dueAt: addMinutes(now, block.minutes).toISOString(),
    remainingSeconds: block.minutes * 60,
  };
}

function currentRemainingSeconds(state, now) {
  if (!state.current?.dueAt) return state.current?.remainingSeconds ?? 0;
  return Math.max(0, Math.ceil((Date.parse(state.current.dueAt) - now.getTime()) / 1000));
}

function makePendingTick(state, now, reason) {
  const block = state.blocks.find((candidate) => candidate.id === state.current?.blockId);
  return {
    id: randomUUID(),
    status: 'dispatching',
    reason: block && currentRemainingSeconds(state, now) <= 0 ? 'block timer finished; ask for a check' : reason,
    createdAt: now.toISOString(),
    attempt: 1,
    nextAttemptAt: null,
    error: null,
  };
}

function makeTickPrompt(id, controlUrl) {
  return [
    `Warden tick ${id}.`,
    `Invoke $warden and follow ${SKILL_PATH}.`,
    `Read current state from GET ${controlUrl}/api/state; this prompt intentionally contains no plan or signal data.`,
    'Gather only the recent signals needed for a gentle on-plan, break, unknown, or drift verdict.',
    `Before acknowledging, confirm phase is running and pendingTick.id is still ${id}.`,
    `POST the check-in to ${controlUrl}/api/action as JSON with X-Warden-Request: 1, then respond to Mike briefly.`,
  ].join(' ');
}

function compactDispatchResult(result) {
  if (!result || typeof result !== 'object') return null;
  const compact = {};
  for (const key of ['dispatched', 'commandId', 'messageId', 'sequence']) {
    if (['string', 'number', 'boolean'].includes(typeof result[key])) compact[key] = result[key];
  }
  return compact;
}

function validateBinding(binding) {
  assertPlainObject(binding, 'binding');
  const baseDir = requiredString(binding.baseDir, 'binding.baseDir', 1000);
  if (!isAbsolute(baseDir)) throw new WardenError('invalid-binding', 'binding.baseDir must be an absolute path');
  const threadId = requiredString(binding.threadId, 'binding.threadId');
  const providerThreadId = requiredString(binding.providerThreadId, 'binding.providerThreadId');
  const baseUrl = requiredString(binding.baseUrl, 'binding.baseUrl');
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new WardenError('invalid-binding', 'binding.baseUrl must be a valid http:// or https:// URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new WardenError('invalid-binding', 'binding.baseUrl must be an http:// or https:// URL without credentials');
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new WardenError('invalid-binding', 'binding.baseUrl must contain only the HTTP origin');
  }
  if (Object.hasOwn(binding, 'bearerToken')) throw new WardenError('sensitive-binding', 'Inline credentials are not persisted');
  const result = { baseDir, baseUrl: parsed.origin, threadId, providerThreadId };
  if (binding.bearerTokenEnv !== undefined) result.bearerTokenEnv = requiredString(binding.bearerTokenEnv, 'binding.bearerTokenEnv');
  if (binding.bearerTokenFile !== undefined) result.bearerTokenFile = requiredString(binding.bearerTokenFile, 'binding.bearerTokenFile', 1000);
  if (result.bearerTokenEnv && result.bearerTokenFile) {
    throw new WardenError('invalid-binding', 'Choose bearerTokenEnv or bearerTokenFile, not both');
  }
  if (binding.runtimeMode !== undefined) result.runtimeMode = requiredString(binding.runtimeMode, 'binding.runtimeMode');
  if (binding.interactionMode !== undefined) result.interactionMode = requiredString(binding.interactionMode, 'binding.interactionMode');
  if (binding.timeoutMs !== undefined) result.timeoutMs = integerInRange(binding.timeoutMs, 'binding.timeoutMs', 1_000, 120_000);
  return result;
}

function validateBlocks(rawBlocks, { allowEmpty = false } = {}) {
  if (!Array.isArray(rawBlocks) || (!allowEmpty && rawBlocks.length === 0)) {
    throw new WardenError('invalid-blocks', 'blocks must be a non-empty array');
  }
  const ids = new Set();
  return rawBlocks.map((raw, index) => {
    assertPlainObject(raw, `blocks[${index}]`);
    const id = requiredString(raw.id, `blocks[${index}].id`);
    if (ids.has(id)) throw new WardenError('duplicate-block-id', `Duplicate block id: ${id}`);
    ids.add(id);
    return {
      id,
      title: requiredString(raw.title, `blocks[${index}].title`, 160),
      minutes: integerInRange(raw.minutes, `blocks[${index}].minutes`, 1, 720),
    };
  });
}

function accrueActive(state, now) {
  if (!state.current?.startedAt || !state.current.blockId) return;
  const block = state.blocks.find((candidate) => candidate.id === state.current.blockId);
  if (block) block.activeSeconds += Math.max(0, Math.floor((now.getTime() - Date.parse(state.current.startedAt)) / 1000));
  state.current.startedAt = now.toISOString();
}

function validateReminders(rawReminders, now, endAt) {
  if (!Array.isArray(rawReminders)) throw new WardenError('invalid-reminders', 'reminders must be an array');
  const ids = new Set();
  return rawReminders.map((raw, index) => {
    assertPlainObject(raw, `reminders[${index}]`);
    const id = requiredString(raw.id, `reminders[${index}].id`);
    if (ids.has(id)) throw new WardenError('duplicate-reminder-id', `Duplicate reminder id: ${id}`);
    ids.add(id);
    const at = requiredDate(raw.at, `reminders[${index}].at`);
    if (at <= now) throw new WardenError('invalid-reminder-time', `Reminder ${id} must be in the future`);
    if (at > endAt) throw new WardenError('invalid-reminder-time', `Reminder ${id} is after endAt`);
    return { id, title: requiredString(raw.title, `reminders[${index}].title`, 160), at: at.toISOString(), status: 'pending' };
  });
}

function validatePersistedState(state) {
  assertPlainObject(state, 'state');
  if (state.version !== 1) throw new WardenError('unsupported-state', 'Unsupported Warden state version');
  if (!PHASES.has(state.phase)) throw new WardenError('invalid-state', 'Invalid state phase');
  if (!Array.isArray(state.blocks) || !Array.isArray(state.reminders)) {
    throw new WardenError('invalid-state', 'Invalid persisted arrays');
  }
}

function requireActive(state) {
  if (!['running', 'paused', 'break'].includes(state.phase)) {
    throw new WardenError('not-active', 'Warden is not active');
  }
}

function requireRunning(state) {
  if (state.phase !== 'running') throw new WardenError('not-running', 'Warden is not running');
}

function requiredFutureDate(value, field, now) {
  const date = requiredDate(value, field);
  if (date <= now) throw new WardenError('invalid-date', `${field} must be in the future`);
  return date;
}

function requiredDate(value, field) {
  if (typeof value !== 'string') throw new WardenError('invalid-date', `${field} must be an ISO date string`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new WardenError('invalid-date', `${field} must be an exact ISO date string`);
  }
  return date;
}

function requiredString(value, field, maxLength = 200) {
  if (typeof value !== 'string' || value.trim() === '' || value.length > maxLength) {
    throw new WardenError('invalid-string', `${field} must be a non-empty string up to ${maxLength} characters`);
  }
  return value.trim();
}

function optionalShortString(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredString(value, field, maxLength);
}

function positiveInteger(value, field) {
  return integerInRange(value, field, 1, 720);
}

function integerInRange(value, field, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new WardenError('invalid-number', `${field} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

function assertPlainObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WardenError('invalid-object', `${field} must be an object`);
  }
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1000);
}

function isPast(value, now) {
  return typeof value === 'string' && Date.parse(value) <= now.getTime();
}

function safeErrorMessage(error) {
  return error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
}

function finalizeAcknowledgedTick(state, now) {
  const nextMinutes = state.pendingTick.nextMinutes;
  state.pendingTick = null;
  state.nextTickAt = nextTickTime(state, now, nextMinutes);
}

function nextTickTime(state, now, minutes) {
  const paced = addMinutes(now, minutes).getTime();
  const blockEnd = state.current?.dueAt ? Date.parse(state.current.dueAt) : Number.POSITIVE_INFINITY;
  return new Date(Math.min(paced, blockEnd)).toISOString();
}
