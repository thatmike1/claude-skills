/**
 * t3 — what Jarvis needs from T3 Code beyond the shared roster reader: one
 * thread's state, the activity the check-in rule looks at, and a way to put a
 * message into a thread.
 *
 * Reads go straight to T3's Orchestrator V2 tables in `statev2.sqlite`,
 * read-only. Writes never do: a message goes through T3's own authenticated API
 * (`message.dispatch`), the route Warden's bridge uses, so T3 stays the only
 * writer of its database.
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_TIMEOUT_MS = 10_000;
const ACTIVE_RUN = `('preparing', 'starting', 'running')`;

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
    db = new DatabaseSync(join(t3BaseDir(), 'userdata', 'statev2.sqlite'), { readOnly: true });
    return db.prepare(sql).all(...params);
  } catch {
    return [];
  } finally {
    try { db?.close(); } catch { /* already closed */ }
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    return {};
  }
}

/**
 * one thread's state and the time it last said or heard anything.
 *
 * `waiting` means T3 is holding the thread on Mike: an open approval or
 * question, or a proposed plan to accept. `busy` means a run is in progress.
 *
 * @param {string} threadId
 * @returns {{ threadId: string, title: string, status: 'busy'|'idle'|'waiting', settled: boolean,
 *   createdAt: string, updatedAt: string } | null}
 */
export function threadInfo(threadId) {
  const [r] = query(`
    SELECT t.thread_id, t.title, t.created_at, t.payload_json,
      (SELECT status FROM orchestration_v2_projection_runs r
        WHERE r.thread_id = t.thread_id ORDER BY ordinal DESC LIMIT 1) AS run_status,
      (SELECT COUNT(*) FROM orchestration_v2_projection_runtime_requests q
        WHERE q.thread_id = t.thread_id AND q.status = 'pending')
      + (SELECT COUNT(*) FROM orchestration_v2_projection_turn_items i
        WHERE i.thread_id = t.thread_id AND i.type = 'secret_request' AND i.status = 'waiting')
      + (SELECT COUNT(*) FROM orchestration_v2_projection_plans pl
        WHERE pl.thread_id = t.thread_id AND pl.kind = 'proposed_plan' AND pl.status = 'active') AS asks,
      (SELECT MAX(created_at) FROM orchestration_v2_projection_messages m
        WHERE m.thread_id = t.thread_id) AS last_message_at
      FROM orchestration_v2_projection_threads t
     WHERE t.thread_id = ? AND t.deleted_at IS NULL`, threadId);
  if (!r) return null;
  const payload = parseJson(r.payload_json);
  return {
    threadId: String(r.thread_id),
    title: String(r.title || ''),
    status: Number(r.asks || 0) ? 'waiting'
      : ['preparing', 'starting', 'running'].includes(r.run_status) ? 'busy' : 'idle',
    settled: payload.settledOverride === 'settled' || Boolean(payload.settledAt) || Boolean(payload.archivedAt),
    createdAt: String(r.created_at || ''),
    updatedAt: String(r.last_message_at || r.created_at || ''),
  };
}

/**
 * the T3 thread a provider session is running in, found by the session's own
 * id: the Claude Code session id, or Codex's thread id.
 *
 * @param {string} nativeId
 */
export function threadForSession(nativeId) {
  const [r] = query(`
    SELECT pt.thread_id FROM orchestration_v2_projection_provider_threads pt
      JOIN orchestration_v2_projection_threads t ON t.thread_id = pt.thread_id
     WHERE json_extract(pt.payload_json, '$.nativeThreadRef.nativeId') = ?
       AND t.deleted_at IS NULL
     ORDER BY pt.updated_at DESC LIMIT 1`, nativeId);
  return r ? String(r.thread_id) : null;
}

/**
 * the activity the check-in rule needs, from T3's message log: the newest
 * message anywhere, the newest outside Jarvis's own thread, and the last user
 * message in Jarvis's thread (which includes the service's own wake messages,
 * so callers allow for that).
 *
 * @param {string} homeThreadId
 */
export function activity(homeThreadId) {
  const [r] = query(`
    SELECT max(created_at) AS all_at,
           max(CASE WHEN thread_id != ? THEN created_at END) AS others_at,
           max(CASE WHEN thread_id = ? AND role = 'user' THEN created_at END) AS home_user_at
      FROM orchestration_v2_projection_messages`, homeThreadId, homeThreadId);
  return {
    lastAll: String(r?.all_at || ''),
    lastOthers: String(r?.others_at || ''),
    homeLastUser: String(r?.home_user_at || ''),
  };
}

/** whether any thread is mid-run right now. */
export function anyThreadBusy() {
  const [r] = query(`SELECT count(*) AS n FROM orchestration_v2_projection_runs WHERE status IN ${ACTIVE_RUN}`);
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
    SELECT payload_json, created_at FROM orchestration_v2_projection_messages
     WHERE thread_id = ? AND role = ? AND streaming = 0
     ORDER BY created_at DESC LIMIT 1`, threadId, role)[0];
  const trim = text => {
    const flat = String(text || '').replace(/\s+/g, ' ').trim();
    return flat.length > max ? `…${flat.slice(-max)}` : flat;
  };
  const user = pick('user');
  const assistant = pick('assistant');
  return {
    user: trim(parseJson(user?.payload_json).text),
    userAt: String(user?.created_at || ''),
    assistant: trim(parseJson(assistant?.payload_json).text),
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
 * put a message into a T3 thread as if Mike had typed it.
 *
 * The message shows in the thread as a user message, which is the point: the
 * wake is visible in the thread it lands in. A busy thread gets it queued after
 * its current run instead of interrupted. Idempotent on `id`.
 *
 * @param {{ threadId: string, text: string, id: string, tokenFile: string, timeoutMs?: number }} opts
 */
export async function dispatchMessage({ threadId, text, id, tokenFile, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  if (!threadInfo(threadId)) throw new Error(`no T3 thread ${threadId}`);
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
      type: 'message.dispatch',
      commandId: `jarvis:${id}`,
      threadId,
      messageId: `jarvis-message:${id}`,
      text,
      attachments: [],
      createdBy: 'user',
      creationSource: 'server',
      dispatchMode: { type: 'queue_after_active' },
    },
  }, timeoutMs);
}
