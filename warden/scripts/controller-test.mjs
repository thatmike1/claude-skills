import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WardenController } from './controller.mjs';
import { createWardenServer } from './warden.mjs';

const START = '2026-09-15T08:00:00.000Z';
const BINDING = {
  baseDir: '/tmp/t3',
  baseUrl: 'http://127.0.0.1:9000',
  threadId: 'thread-1',
  providerThreadId: 'codex-thread-1',
};

class Clock {
  constructor(iso = START) {
    this.value = new Date(iso);
  }

  now = () => new Date(this.value);

  advanceMinutes(minutes) {
    this.value = new Date(this.value.getTime() + minutes * 60_000);
  }

  advanceMilliseconds(milliseconds) {
    this.value = new Date(this.value.getTime() + milliseconds);
  }
}

function startPayload(overrides = {}) {
  return {
    action: 'start',
    binding: BINDING,
    endAt: '2026-09-15T18:00:00.000Z',
    blocks: [
      { id: 'one', title: 'First block', minutes: 30 },
      { id: 'two', title: 'Second block', minutes: 20 },
    ],
    ...overrides,
  };
}

async function fixture(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'warden-controller-'));
  const clock = options.clock ?? new Clock();
  const dispatches = [];
  const controller = new WardenController({
    stateDir: directory,
    now: clock.now,
    dispatcher: options.dispatcher ?? (async (binding, tick) => {
      dispatches.push({ binding, tick });
      return { dispatched: true, commandId: `warden:${tick.id}` };
    }),
    notifier: options.notifier,
    bindingRefresher: options.bindingRefresher,
    retryDelaysMs: options.retryDelaysMs,
  });
  await controller.init();
  return {
    directory,
    clock,
    controller,
    dispatches,
    async cleanup() { await rm(directory, { recursive: true, force: true }); },
  };
}

test('start, extend, and done preserve estimate and advance the plan', async (context) => {
  const item = await fixture();
  context.after(item.cleanup);
  await item.controller.action(startPayload());
  item.clock.advanceMinutes(5);
  let state = await item.controller.action({ action: 'extend', minutes: 15 });
  assert.equal(state.blocks[0].estimateMinutes, 30);
  assert.equal(state.blocks[0].minutes, 45);
  assert.equal(state.blocks[0].activeSeconds, 300);
  assert.equal(state.current.remainingSeconds, 40 * 60);

  state = await item.controller.action({ action: 'done', id: 'one' });
  assert.equal(state.blocks[0].status, 'done');
  assert.equal(state.blocks[1].status, 'current');
  assert.equal(state.current.blockId, 'two');
});

test('pause and resume exclude paused time from elapsed work', async (context) => {
  const item = await fixture();
  context.after(item.cleanup);
  await item.controller.action(startPayload());
  item.clock.advanceMinutes(5);
  let state = await item.controller.action({ action: 'pause' });
  assert.equal(state.current.remainingSeconds, 25 * 60);
  assert.equal(state.blocks[0].activeSeconds, 5 * 60);

  item.clock.advanceMinutes(60);
  state = await item.controller.action({ action: 'resume' });
  assert.equal(state.current.remainingSeconds, 25 * 60);
  item.clock.advanceMinutes(5);
  state = await item.controller.action({ action: 'done' });
  assert.equal(state.blocks[0].activeSeconds, 10 * 60);
});

test('endAt stops the day, cancels reminders, and starts the final readout', async (context) => {
  const notifications = [];
  const item = await fixture({ notifier: async (notification) => notifications.push(notification) });
  context.after(item.cleanup);
  await item.controller.action(startPayload({
    endAt: '2026-09-15T08:10:00.000Z',
    reminders: [{ id: 'fixed', title: 'A fixed reminder', at: '2026-09-15T08:05:00.000Z' }],
  }));
  item.clock.advanceMinutes(11);
  await item.controller.processDue();
  const state = item.controller.getState();
  assert.equal(state.phase, 'stopped');
  assert.equal(state.stopReason, 'day ended');
  assert.equal(state.reminders[0].status, 'cancelled');
  assert.equal(item.dispatches.length, 1);
  assert.equal(notifications.length, 1);
});

test('restart keeps an acknowledged pending dispatch from duplicating', async (context) => {
  const item = await fixture();
  context.after(item.cleanup);
  await item.controller.action(startPayload({ blocks: [{ id: 'one', title: 'Short', minutes: 10 }] }));
  item.clock.advanceMinutes(10);
  await item.controller.processDue();
  assert.equal(item.dispatches.length, 1);
  assert.equal(item.controller.getState().pendingTick.status, 'awaiting');

  const restartDispatches = [];
  const restarted = new WardenController({
    stateDir: item.directory,
    now: item.clock.now,
    dispatcher: async (...args) => restartDispatches.push(args),
  });
  await restarted.init();
  item.clock.advanceMinutes(60);
  await restarted.processDue();
  assert.equal(restartDispatches.length, 0);
  assert.equal(restarted.getState().pendingTick.status, 'awaiting');
});

test('many missed intervals coalesce into one pending tick', async (context) => {
  const item = await fixture();
  context.after(item.cleanup);
  await item.controller.action(startPayload({ blocks: [{ id: 'one', title: 'Long', minutes: 120 }] }));
  item.clock.advanceMinutes(90);
  await Promise.all([item.controller.processDue(), item.controller.processDue(), item.controller.processDue()]);
  assert.equal(item.dispatches.length, 1);
  assert.equal(item.controller.getState().pendingTick.status, 'awaiting');
});

test('failed dispatch is visible and retries with the same tick id', async (context) => {
  const attempts = [];
  const item = await fixture({
    retryDelaysMs: [1_000],
    dispatcher: async (_binding, tick) => {
      attempts.push(tick.id);
      if (attempts.length === 1) throw new Error('T3 is busy');
      return { dispatched: true, commandId: `warden:${tick.id}` };
    },
  });
  context.after(item.cleanup);
  await item.controller.action(startPayload({ blocks: [{ id: 'one', title: 'Short', minutes: 10 }] }));
  item.clock.advanceMinutes(10);
  await item.controller.processDue();
  let state = item.controller.getState();
  assert.equal(state.pendingTick.status, 'retry');
  assert.match(state.lastError.message, /T3 is busy/);

  item.clock.advanceMilliseconds(1_000);
  await item.controller.processDue();
  state = item.controller.getState();
  assert.equal(state.pendingTick.status, 'awaiting');
  assert.deepEqual(attempts, [attempts[0], attempts[0]]);
});

test('retry refreshes the binding and resets the attempt budget without changing the tick id', async (context) => {
  const attempts = [];
  const refreshedBindings = [];
  let dispatchShouldFail = true;
  const item = await fixture({
    retryDelaysMs: [],
    bindingRefresher: async (binding) => {
      refreshedBindings.push(binding);
      return { ...binding, baseUrl: 'http://127.0.0.1:9001' };
    },
    dispatcher: async (binding, tick) => {
      attempts.push({ binding, id: tick.id });
      if (dispatchShouldFail) throw new Error('stale T3 runtime');
      return { dispatched: true, commandId: `warden:${tick.id}` };
    },
  });
  context.after(item.cleanup);
  await item.controller.action(startPayload({ blocks: [{ id: 'one', title: 'Short', minutes: 10 }] }));
  item.clock.advanceMinutes(10);
  await item.controller.processDue();
  const failed = item.controller.getState();
  assert.equal(failed.pendingTick.status, 'failed');
  assert.equal(failed.pendingTick.attempt, 1);

  dispatchShouldFail = false;
  const retried = await item.controller.action({ action: 'retry' });
  assert.equal(retried.pendingTick.id, failed.pendingTick.id);
  assert.equal(retried.pendingTick.status, 'retry');
  assert.equal(retried.pendingTick.attempt, 0);
  assert.equal(retried.binding.baseUrl, 'http://127.0.0.1:9001');
  assert.equal(refreshedBindings.length, 1);
  await item.controller.processDue();
  assert.deepEqual(attempts.map(({ id }) => id), [failed.pendingTick.id, failed.pendingTick.id]);
  assert.equal(attempts[1].binding.baseUrl, 'http://127.0.0.1:9001');
  assert.equal(item.controller.getState().pendingTick.status, 'awaiting');
});

test('retry rejects a refreshed binding that points at a different thread', async (context) => {
  const item = await fixture({
    retryDelaysMs: [],
    dispatcher: async () => { throw new Error('thread disappeared'); },
    bindingRefresher: async (binding) => ({ ...binding, threadId: 'another-thread' }),
  });
  context.after(item.cleanup);
  await item.controller.action(startPayload({ blocks: [{ id: 'one', title: 'Short', minutes: 10 }] }));
  item.clock.advanceMinutes(10);
  await item.controller.processDue();
  const before = item.controller.getState();
  await assert.rejects(item.controller.action({ action: 'retry' }), /same T3 thread/);
  assert.deepEqual(item.controller.getState(), before);
});

test('exhausted tick delivery notifies once until a new retry episode', async (context) => {
  const notifications = [];
  const item = await fixture({
    retryDelaysMs: [],
    dispatcher: async () => { throw new Error('T3 is offline'); },
    notifier: async (notification) => notifications.push(notification),
  });
  context.after(item.cleanup);
  await item.controller.action(startPayload({ blocks: [{ id: 'one', title: 'Short', minutes: 10 }] }));
  item.clock.advanceMinutes(10);
  await item.controller.processDue();
  await item.controller.processDue();
  assert.equal(notifications.length, 1);
  assert.match(notifications[0].body, /Retry check/);

  await item.controller.action({ action: 'retry' });
  await item.controller.processDue();
  await item.controller.processDue();
  assert.equal(notifications.length, 2);
});

test('natural day end retries one idempotent final readout across restart', async (context) => {
  const notifications = [];
  const attempts = [];
  const clock = new Clock();
  const dispatcher = async (_binding, prompt) => {
    attempts.push(prompt);
    if (attempts.length === 1) throw new Error('T3 restarting');
    return { dispatched: true, commandId: `warden:${prompt.id}` };
  };
  const item = await fixture({
    clock,
    dispatcher,
    notifier: async (notification) => notifications.push(notification),
    retryDelaysMs: [1_000],
  });
  context.after(item.cleanup);
  await item.controller.action(startPayload({
    endAt: '2026-09-15T08:10:00.000Z',
    blocks: [{ id: 'one', title: 'One block', minutes: 30 }],
  }));
  clock.advanceMinutes(11);
  await item.controller.processDue();
  assert.equal(item.controller.getState().phase, 'stopped');
  assert.equal(item.controller.getState().endReport.status, 'retry');
  assert.equal(notifications.length, 1);
  assert.match(attempts[0].text, /Read the stopped Warden state/);
  assert.doesNotMatch(attempts[0].text, /acknowledg|restart/i);

  const restarted = new WardenController({
    stateDir: item.directory,
    now: clock.now,
    dispatcher,
    notifier: async (notification) => notifications.push(notification),
    retryDelaysMs: [1_000],
  });
  await restarted.init();
  clock.advanceMilliseconds(1_000);
  await restarted.processDue();
  await restarted.processDue();
  assert.equal(restarted.getState().endReport.status, 'sent');
  assert.deepEqual(attempts.map(({ id }) => id), [attempts[0].id, attempts[0].id]);
  assert.equal(notifications.length, 1);
});

test('explicit stop stays quiet and cancels all automatic end work', async (context) => {
  const notifications = [];
  const item = await fixture({ notifier: async (notification) => notifications.push(notification) });
  context.after(item.cleanup);
  await item.controller.action(startPayload({ endAt: '2026-09-15T08:10:00.000Z' }));
  await item.controller.action({ action: 'stop' });
  item.clock.advanceMinutes(11);
  await item.controller.processDue();
  assert.equal(item.controller.getState().endReport, null);
  assert.equal(item.dispatches.length, 0);
  assert.equal(notifications.length, 0);
});

test('starting a new day suppresses an old end report waiting behind notification', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'warden-end-race-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const clock = new Clock();
  const notificationStarted = Promise.withResolvers();
  const releaseNotification = Promise.withResolvers();
  const dispatches = [];
  const controller = new WardenController({
    stateDir: directory,
    now: clock.now,
    dispatcher: async (_binding, prompt) => dispatches.push(prompt),
    notifier: async () => {
      notificationStarted.resolve();
      await releaseNotification.promise;
    },
  });
  await controller.init();
  await controller.action(startPayload({
    endAt: '2026-09-15T08:10:00.000Z',
    blocks: [{ id: 'one', title: 'Old day', minutes: 30 }],
  }));
  clock.advanceMinutes(11);
  const due = controller.processDue();
  await notificationStarted.promise;
  await controller.action(startPayload({
    endAt: '2026-09-15T18:00:00.000Z',
    blocks: [{ id: 'new', title: 'New day', minutes: 30 }],
  }));
  releaseNotification.resolve();
  await due;
  assert.equal(dispatches.length, 0);
  assert.equal(controller.getState().phase, 'running');
  assert.equal(controller.getState().endReport, null);
});

test('day end crossing while a tick waits behind notification still sends the final report', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'warden-end-crossing-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const clock = new Clock();
  const notificationStarted = Promise.withResolvers();
  const releaseNotification = Promise.withResolvers();
  const notifications = [];
  const dispatches = [];
  const controller = new WardenController({
    stateDir: directory,
    now: clock.now,
    dispatcher: async (_binding, prompt) => {
      dispatches.push(prompt);
      return { dispatched: true };
    },
    notifier: async (notification) => {
      notifications.push(notification);
      if (notifications.length === 1) {
        notificationStarted.resolve();
        await releaseNotification.promise;
      }
    },
  });
  await controller.init();
  await controller.action(startPayload({
    endAt: '2026-09-15T08:26:00.000Z',
    blocks: [{ id: 'one', title: 'One block', minutes: 30 }],
    reminders: [{ id: 'fixed', title: 'Reminder', at: '2026-09-15T08:25:00.000Z' }],
  }));
  clock.advanceMinutes(25);
  const due = controller.processDue();
  await notificationStarted.promise;
  clock.advanceMinutes(2);
  releaseNotification.resolve();
  await due;
  await controller.processDue();
  assert.equal(controller.getState().phase, 'stopped');
  assert.equal(controller.getState().endReport.status, 'sent');
  assert.equal(dispatches.length, 1);
  assert.match(dispatches[0].text, /Warden final report/);
  assert.equal(notifications.length, 2);
});

test('a model check-in schedules the next tick only after dispatch finishes', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'warden-after-final-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const clock = new Clock();
  let controller;
  let stateDuringDispatch;
  controller = new WardenController({
    stateDir: directory,
    now: clock.now,
    dispatcher: async (_binding, tick) => {
      await controller.action({ action: 'check-in', id: tick.id, verdict: 'drift', nextMinutes: 10 });
      stateDuringDispatch = controller.getState();
      clock.advanceMinutes(1);
      return { dispatched: true, commandId: `warden:${tick.id}` };
    },
  });
  await controller.init();
  await controller.action(startPayload({ blocks: [{ id: 'one', title: 'Long', minutes: 120 }] }));
  clock.advanceMinutes(25);
  await controller.processDue();
  assert.equal(stateDuringDispatch.pendingTick.status, 'acknowledged');
  assert.equal(stateDuringDispatch.nextTickAt, null);
  assert.equal(controller.getState().pendingTick, null);
  assert.equal(controller.getState().nextTickAt, '2026-09-15T08:36:00.000Z');
});

test('pause while a reminder is notifying cancels the captured tick before dispatch', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'warden-notify-race-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const clock = new Clock();
  let releaseNotification;
  const notificationStarted = Promise.withResolvers();
  const dispatches = [];
  const controller = new WardenController({
    stateDir: directory,
    now: clock.now,
    dispatcher: async (...args) => dispatches.push(args),
    notifier: async () => {
      notificationStarted.resolve();
      await new Promise((resolve) => { releaseNotification = resolve; });
    },
  });
  await controller.init();
  await controller.action(startPayload({
    blocks: [{ id: 'one', title: 'Block', minutes: 25 }],
    reminders: [{ id: 'fixed', title: 'Reminder', at: '2026-09-15T08:25:00.000Z' }],
  }));
  clock.advanceMinutes(25);
  const due = controller.processDue();
  await notificationStarted.promise;
  await controller.action({ action: 'pause' });
  releaseNotification();
  await due;
  assert.equal(dispatches.length, 0);
  assert.equal(controller.getState().phase, 'paused');
  assert.equal(controller.getState().pendingTick, null);
});

test('an early resume returns from break without charging break time to the block', async (context) => {
  const item = await fixture();
  context.after(item.cleanup);
  await item.controller.action(startPayload());
  item.clock.advanceMinutes(5);
  let state = await item.controller.action({ action: 'break', minutes: 10 });
  assert.equal(state.phase, 'break');
  assert.equal(state.current.blockId, 'one');
  assert.equal(state.current.remainingSeconds, 25 * 60);
  item.clock.advanceMinutes(3);
  state = await item.controller.action({ action: 'resume' });
  assert.equal(state.phase, 'running');
  assert.equal(state.break, null);
  item.clock.advanceMinutes(5);
  state = await item.controller.action({ action: 'done' });
  assert.equal(state.blocks[0].activeSeconds, 10 * 60);
});

test('finishing the last block stops cleanly and later pause is a domain error', async (context) => {
  const item = await fixture();
  context.after(item.cleanup);
  await item.controller.action(startPayload({ blocks: [{ id: 'one', title: 'Only block', minutes: 5 }] }));
  const state = await item.controller.action({ action: 'done' });
  assert.equal(state.phase, 'stopped');
  assert.equal(state.stopReason, 'all blocks finished');
  assert.equal(state.current, null);
  await assert.rejects(item.controller.action({ action: 'pause' }), /not running/);
});

test('invalid actions do not mutate memory or the persisted file', async (context) => {
  const item = await fixture();
  context.after(item.cleanup);
  await item.controller.action(startPayload());
  const beforeState = item.controller.getState();
  const beforeFile = await readFile(join(item.directory, 'state.json'), 'utf8');
  await assert.rejects(
    item.controller.action({ action: 'extend', minutes: 'a while' }),
    /minutes must be an integer/,
  );
  assert.deepEqual(item.controller.getState(), beforeState);
  assert.equal(await readFile(join(item.directory, 'state.json'), 'utf8'), beforeFile);
});

test('HTTP API enforces localhost Host, same-origin requests, and custom POST header', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'warden-http-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const dashboardPath = join(directory, 'dashboard.html');
  await writeFile(dashboardPath, '<!doctype html><title>warden</title>');
  const clock = new Clock();
  const dispatchedTicks = [];
  const service = await createWardenServer({
    port: 0,
    stateDir: join(directory, 'state'),
    widgetsDir: join(directory, 'widgets'),
    dashboardPath,
    noNotify: true,
    now: clock.now,
    dispatcher: async (_binding, tick) => {
      dispatchedTicks.push(tick);
      return { dispatched: true };
    },
    dueIntervalMs: 60_000,
  });
  context.after(service.close);

  const stateResponse = await rawRequest(service.port, { path: '/api/state' });
  assert.equal(stateResponse.status, 200);

  const badHost = await rawRequest(service.port, { path: '/api/state', host: 'evil.example' });
  assert.equal(badHost.status, 403);

  const body = JSON.stringify(startPayload());
  const missingHeader = await rawRequest(service.port, {
    method: 'POST', path: '/api/action', body,
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(missingHeader.status, 403);

  const badOrigin = await rawRequest(service.port, {
    method: 'POST', path: '/api/action', body,
    headers: { 'content-type': 'application/json', 'x-warden-request': '1', origin: 'https://evil.example' },
  });
  assert.equal(badOrigin.status, 403);

  const accepted = await rawRequest(service.port, {
    method: 'POST', path: '/api/action', body,
    headers: {
      'content-type': 'application/json',
      'x-warden-request': '1',
      origin: `http://127.0.0.1:${service.port}`,
    },
  });
  assert.equal(accepted.status, 200);
  assert.equal(JSON.parse(accepted.body).state.phase, 'running');
  clock.advanceMinutes(25);
  await service.controller.processDue();
  assert.match(dispatchedTicks[0].text, new RegExp(`http://127\\.0\\.0\\.1:${service.port}/api/state`));
  assert.doesNotMatch(dispatchedTicks[0].text, /127\.0\.0\.1:1339\//);
});

test('service locks its state directory and releases ownership on close', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'warden-lock-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const options = {
    port: 0,
    stateDir: join(directory, 'state'),
    widgetsDir: join(directory, 'widgets'),
    noNotify: true,
    dispatcher: async () => ({ dispatched: true }),
    dueIntervalMs: 60_000,
  };
  const first = await createWardenServer(options);
  await assert.rejects(createWardenServer(options), /already owns state directory/);
  await first.close();

  const reopened = await createWardenServer(options);
  assert.equal(reopened.controller.getState().phase, 'idle');
  await reopened.close();
});

function rawRequest(port, { method = 'GET', path, host, headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: '127.0.0.1',
      port,
      method,
      path,
      headers: { host: host ?? `127.0.0.1:${port}`, ...headers },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.once('error', reject);
    if (body) request.write(body);
    request.end();
  });
}


test('an unknown observation can complete a tick without labeling the user as drifting', async (context) => {
  const item = await fixture();
  context.after(item.cleanup);
  await item.controller.action(startPayload());
  item.clock.advanceMinutes(25);
  await item.controller.processDue();
  const id = item.controller.getState().pendingTick.id;
  const state = await item.controller.action({ action: 'check-in', id, verdict: 'unknown', note: 'Activity data is unavailable.' });
  assert.equal(state.lastVerdict.verdict, 'unknown');
  assert.equal(state.pendingTick, null);
  assert.ok(state.nextTickAt);
});
