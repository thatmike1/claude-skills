/**
 * t3 — the two things Jarvis needs from T3 Code beyond the shared roster reader:
 * which threads an agent launched, and a way to start a turn in a thread.
 *
 * Reads go straight to T3's sqlite, read-only. Writes never do: starting a turn
 * goes through T3's own authenticated API (`orchestration.dispatchCommand`), the
 * same route Warden's bridge uses, so T3 stays the only writer of its database.
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_TIMEOUT_MS = 10_000;

/** the T3 base directory; overridable so tests can point at a fixture. */
export function t3BaseDir() {
  return process.env.T3_BASE_DIR || join(homedir(), '.t3');
}

/** load node:sqlite without its one-off ExperimentalWarning. */
function loadSqlite() {
  const original = process.emitWarning;
  process.emitWarning = (warning, ...rest) => {
    const type = typeof rest[0] === 'string' ? rest[0] : rest[0]?.type;
    if (type === 'ExperimentalWarning') return;
    return original.call(process, warning, ...rest);
  };
  try {
    return createRequire(import.meta.url)('node:sqlite');
  } finally {
    process.emitWarning = original;
  }
}

/**
 * run one read-only query against T3's state, or return [] when T3 or the table
 * is missing. T3's schema is not ours, so any failure reads as "nothing there".
 */
function query(sql, ...params) {
  let db;
  try {
    const { DatabaseSync } = loadSqlite();
    db = new DatabaseSync(join(t3BaseDir(), 'userdata', 'state.sqlite'), { readOnly: true });
    return db.prepare(sql).all(...params);
  } catch {
    return [];
  } finally {
    try { db?.close(); } catch { /* already closed */ }
  }
}

/**
 * every thread an agent launched since `sinceIso`, with its live state.
 *
 * `agent_thread_parents` is Mike's fork's own table (V1 + nesting). Stock T3 and
 * V2 do not have it; there the list is empty and V2's `delegate_task` replaces it.
 *
 * @param {string} sinceIso only launches at or after this time
 * @returns {{threadId: string, parentThreadId: string, launchedAt: string, title: string,
 *   status: 'busy'|'idle'|'waiting', settled: boolean, updatedAt: string}[]}
 */
export function launchedThreads(sinceIso) {
  const rows = query(`
    SELECT a.thread_id, a.parent_thread_id, a.created_at AS launched_at,
           t.title, t.updated_at, t.settled_override, t.archived_at,
           t.pending_approval_count + t.pending_user_input_count
             + t.has_actionable_proposed_plan AS asks,
           s.status AS turn_status
      FROM agent_thread_parents a
      JOIN projection_threads t ON t.thread_id = a.thread_id
      LEFT JOIN projection_thread_sessions s ON s.thread_id = a.thread_id
     WHERE t.deleted_at IS NULL AND a.created_at >= ?
     ORDER BY a.created_at ASC`, sinceIso);
  return rows.map(r => ({
    threadId: String(r.thread_id),
    parentThreadId: String(r.parent_thread_id),
    launchedAt: String(r.launched_at),
    title: String(r.title || ''),
    status: Number(r.asks || 0) ? 'waiting' : r.turn_status === 'running' ? 'busy' : 'idle',
    settled: String(r.settled_override || '') === 'settled' || Boolean(r.archived_at),
    updatedAt: String(r.updated_at || ''),
  }));
}

/**
 * one thread's state and the modes a new turn must be started with.
 * @param {string} threadId
 */
export function threadInfo(threadId) {
  const [r] = query(`
    SELECT t.thread_id, t.title, t.runtime_mode, t.interaction_mode, t.updated_at,
           t.pending_approval_count + t.pending_user_input_count
             + t.has_actionable_proposed_plan AS asks,
           s.status AS turn_status
      FROM projection_threads t
      LEFT JOIN projection_thread_sessions s ON s.thread_id = t.thread_id
     WHERE t.thread_id = ? AND t.deleted_at IS NULL`, threadId);
  if (!r) return null;
  return {
    threadId: String(r.thread_id),
    title: String(r.title || ''),
    runtimeMode: String(r.runtime_mode || 'full-access'),
    interactionMode: String(r.interaction_mode || 'default'),
    status: Number(r.asks || 0) ? 'waiting' : r.turn_status === 'running' ? 'busy' : 'idle',
    updatedAt: String(r.updated_at || ''),
  };
}

/** the T3 thread a Claude session is running in, found by its session id. */
export function threadForClaudeSession(sessionId) {
  const [r] = query(`
    SELECT r.thread_id FROM provider_session_runtime r
      JOIN projection_threads t ON t.thread_id = r.thread_id
     WHERE r.provider_name = 'claudeAgent'
       AND json_extract(r.resume_cursor_json, '$.resume') = ?
       AND t.deleted_at IS NULL`, sessionId);
  return r ? String(r.thread_id) : null;
}

/** the T3 thread a Codex session is running in, found by Codex's own thread id. */
export function threadForCodexThread(codexThreadId) {
  const [r] = query(`
    SELECT r.thread_id FROM provider_session_runtime r
      JOIN projection_threads t ON t.thread_id = r.thread_id
     WHERE r.provider_name = 'codex'
       AND json_extract(r.resume_cursor_json, '$.threadId') = ?
       AND t.deleted_at IS NULL`, codexThreadId);
  return r ? String(r.thread_id) : null;
}

/**
 * the activity the check-in rule needs: the newest update anywhere, the newest
 * outside Jarvis's own thread, and the last user message in Jarvis's thread
 * (which includes the service's own wake messages, so callers allow for that).
 *
 * @param {string} homeThreadId
 */
export function activity(homeThreadId) {
  const [r] = query(`
    SELECT max(updated_at) AS all_at,
           max(CASE WHEN thread_id != ? THEN updated_at END) AS others_at,
           max(CASE WHEN thread_id = ? THEN latest_user_message_at END) AS home_user_at
      FROM projection_threads WHERE deleted_at IS NULL`, homeThreadId, homeThreadId);
  return {
    lastAll: String(r?.all_at || ''),
    lastOthers: String(r?.others_at || ''),
    homeLastUser: String(r?.home_user_at || ''),
  };
}

/** whether any thread is mid-turn right now. */
export function anyThreadBusy() {
  const [r] = query(`SELECT count(*) AS n FROM projection_thread_sessions WHERE status = 'running'`);
  return Number(r?.n || 0) > 0;
}

/**
 * the last thing each side said in a thread, from T3's own message log, which
 * is the same shape whichever provider runs the thread.
 * @param {string} threadId
 * @param {number} [max] characters kept from each message's end
 */
export function lastWords(threadId, max = 600) {
  const pick = role => query(`
    SELECT text, created_at FROM projection_thread_messages
     WHERE thread_id = ? AND role = ? ORDER BY created_at DESC LIMIT 1`, threadId, role)[0];
  const trim = text => {
    const flat = String(text || '').replace(/\s+/g, ' ').trim();
    return flat.length > max ? `…${flat.slice(-max)}` : flat;
  };
  const user = pick('user');
  const assistant = pick('assistant');
  return {
    user: trim(user?.text),
    userAt: String(user?.created_at || ''),
    assistant: trim(assistant?.text),
    assistantAt: String(assistant?.created_at || ''),
  };
}

/** the running T3 server's origin, from the identity file it writes on start. */
function runtimeOrigin() {
  const runtime = JSON.parse(readFileSync(join(t3BaseDir(), 'userdata', 'server-runtime.json'), 'utf8'));
  try {
    process.kill(runtime.pid, 0);
  } catch {
    throw new Error(`T3 is not running (pid ${runtime.pid} is gone)`);
  }
  const origin = new URL(runtime.origin);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) {
    throw new Error(`refusing a non-loopback T3 origin ${origin.origin}`);
  }
  return origin.origin;
}

/** send one request over T3's Effect RPC websocket and resolve with its value. */
function rpc(socketUrl, request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(socketUrl);
    let done = false;
    const timer = setTimeout(() => finish(reject, new Error(`T3 RPC timed out after ${timeoutMs}ms`)), timeoutMs);
    function finish(cb, value) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { socket.close(); } catch { /* already closed */ }
      cb(value);
    }
    socket.addEventListener('open', () => socket.send(JSON.stringify({ _tag: 'Request', headers: [], ...request })), { once: true });
    socket.addEventListener('message', event => {
      let msg;
      try { msg = JSON.parse(String(event.data)); } catch { return; }
      if (msg?._tag === 'Exit' && msg.requestId === request.id) {
        if (msg.exit?._tag === 'Success') finish(resolve, msg.exit.value);
        else finish(reject, new Error(`T3 rejected ${request.tag}: ${JSON.stringify(msg.exit?.cause ?? msg.exit)}`));
      } else if (msg?._tag === 'Defect' || msg?._tag === 'ClientProtocolError') {
        finish(reject, new Error(`T3 RPC ${msg._tag}: ${JSON.stringify(msg.defect ?? msg.error)}`));
      }
    });
    socket.addEventListener('error', () => finish(reject, new Error('T3 websocket failed')), { once: true });
    socket.addEventListener('close', () => finish(reject, new Error('T3 websocket closed before replying')), { once: true });
  });
}

/**
 * start a turn in a T3 thread, as if Mike had typed `text` into it.
 *
 * The message shows in the thread as a user message, which is the point: the
 * wake is visible in the thread it lands in. Idempotent on `id`.
 *
 * @param {{ threadId: string, text: string, id: string, tokenFile: string, timeoutMs?: number }} opts
 */
export async function startTurn({ threadId, text, id, tokenFile, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const info = threadInfo(threadId);
  if (!info) throw new Error(`no T3 thread ${threadId}`);
  const token = readFileSync(tokenFile.replace(/^~(?=\/)/, homedir()), 'utf8').trim();
  if (!token) throw new Error(`empty T3 token file ${tokenFile}`);
  const origin = runtimeOrigin();
  const ticketRes = await fetch(`${origin}/api/auth/websocket-ticket`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!ticketRes.ok) throw new Error(`T3 ticket request failed: HTTP ${ticketRes.status}`);
  const { ticket } = await ticketRes.json();
  const socketUrl = new URL(origin);
  socketUrl.protocol = 'ws:';
  socketUrl.pathname = '/ws';
  socketUrl.searchParams.set('clientSurface', 'cli');
  socketUrl.searchParams.set('wsTicket', ticket);
  return rpc(socketUrl, {
    id: `jarvis-rpc:${id}`,
    tag: 'orchestration.dispatchCommand',
    payload: {
      type: 'thread.turn.start',
      commandId: `jarvis:${id}`,
      threadId,
      message: { messageId: `jarvis-message:${id}`, role: 'user', text, attachments: [] },
      runtimeMode: info.runtimeMode,
      interactionMode: info.interactionMode,
      createdAt: new Date().toISOString(),
    },
  }, timeoutMs);
}
