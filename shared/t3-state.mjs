/**
 * t3-state — read T3 Code's own state for the threads it is running.
 *
 * T3 Code is a front end, not a harness: every thread it opens runs an ordinary
 * Claude Code or Antigravity session underneath, which is why its rows reach a
 * roster looking like any other session. What T3 knows and the session does not
 * is the thread around it — its title, its project, whether it is waiting on the
 * user, and whether the user has *settled* it. Settled is the one signal here
 * that a human produced deliberately, so it is the one worth filtering on.
 *
 * Everything below is best-effort against another tool's internals: T3 does not
 * have to be installed and its schema is not ours. Any failure reads as "no T3",
 * never as an error.
 */

import { createRequire } from 'module';
import { homedir } from 'os';

/** resolved per call so a test can point at a fixture after import. */
function dbPath() {
  return process.env.T3_STATE_DB || `${homedir()}/.t3/userdata/state.sqlite`;
}

/**
 * `node:sqlite` is stable enough to use and still prints an ExperimentalWarning
 * on first load. Suppress that one warning across the load and put the original
 * emitter straight back, so a caller's real warnings are untouched.
 */
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

// one row per thread T3 has a provider session for, joined to the thread itself
const QUERY = `
  SELECT r.resume_cursor_json, r.runtime_payload_json, r.provider_name,
         r.last_seen_at, s.status AS turn_status,
         t.thread_id, t.title, t.updated_at, t.latest_user_message_at,
         t.settled_override, t.snoozed_until, t.archived_at,
         t.pending_approval_count, t.pending_user_input_count,
         t.has_actionable_proposed_plan, p.title AS project
    FROM provider_session_runtime r
    JOIN projection_threads t ON t.thread_id = r.thread_id
    LEFT JOIN projection_thread_sessions s ON s.thread_id = r.thread_id
    LEFT JOIN projection_projects p ON p.project_id = t.project_id
   WHERE t.deleted_at IS NULL
   ORDER BY t.updated_at ASC`;

function rawRows() {
  let sqlite;
  try {
    sqlite = loadSqlite();
  } catch {
    return [];
  }
  let db;
  try {
    db = new sqlite.DatabaseSync(dbPath(), { readOnly: true });
    return db.prepare(QUERY).all();
  } catch {
    return [];
  } finally {
    try { db?.close(); } catch { /* already gone */ }
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
 * the underlying session id, which each provider files under its own key:
 * `resume` for Claude Code, `sessionId` for Antigravity. `threadId` is T3's
 * own id and is never the session's, so it is not a fallback.
 */
function sessionIdOf(cursor, provider) {
  if (provider === 'claudeAgent') return String(cursor.resume || '');
  return String(cursor.sessionId || cursor.resume || '');
}

function shape(row, nowMs) {
  const cursor = parseJson(row.resume_cursor_json);
  const payload = parseJson(row.runtime_payload_json);
  const sessionId = sessionIdOf(cursor, row.provider_name);
  if (!sessionId) return null;

  // T3 counts three separate things it can be stopped on the user for
  const asks = Number(row.pending_approval_count || 0)
    + Number(row.pending_user_input_count || 0)
    + Number(row.has_actionable_proposed_plan || 0);

  // T3 keeps the wake time after a snooze runs out, so a thread is only snoozed
  // while that time is still ahead of us
  const snoozedUntil = String(row.snoozed_until || '');
  const snoozed = snoozedUntil ? Date.parse(snoozedUntil) > nowMs : false;

  return {
    threadId: String(row.thread_id),
    sessionId,
    title: String(row.title || ''),
    project: String(row.project || ''),
    provider: String(row.provider_name || ''),
    model: String(payload.model || ''),
    cwd: String(payload.cwd || ''),
    // the session's own log carries no idea of any of this; T3 is the only source
    status: asks ? 'waiting' : row.turn_status === 'running' ? 'busy' : 'idle',
    settled: String(row.settled_override || '') === 'settled',
    archived: Boolean(row.archived_at),
    snoozed,
    snoozedUntil: snoozed ? snoozedUntil : '',
    asks,
    updatedAt: String(row.updated_at || ''),
    lastUserMessageAt: String(row.latest_user_message_at || ''),
  };
}

/**
 * every T3 thread keyed by the session id running it, newest last.
 *
 * A session id can appear on two threads when one was resumed from the other;
 * the query's ascending order leaves the most recent thread holding the key.
 *
 * @param {{ nowMs?: number }} [opts] `nowMs` is the clock snoozes are judged against
 * @returns {Map<string, object>}
 */
export function t3ThreadsBySession({ nowMs = Date.now() } = {}) {
  const out = new Map();
  for (const row of rawRows()) {
    const thread = shape(row, nowMs);
    if (thread) out.set(thread.sessionId, thread);
  }
  return out;
}

/**
 * open T3 threads, newest first.
 *
 * Settled threads are excluded by default and that is the point of the call:
 * settled is what the user has already dealt with, it only ever grows, and what
 * is left is the set of loops still open on them. Snoozed and archived threads
 * are parked by the same deliberate act and go with it.
 *
 * @param {{ all?: boolean, nowMs?: number }} [opts] `all` keeps everything
 * @returns {object[]}
 */
export function t3OpenThreads({ all = false, nowMs = Date.now() } = {}) {
  const threads = [...t3ThreadsBySession({ nowMs }).values()];
  const kept = all
    ? threads
    : threads.filter(t => !t.settled && !t.snoozed && !t.archived);
  return kept.reverse();
}
