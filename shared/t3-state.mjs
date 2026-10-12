/**
 * t3-state — read T3 Code's own state for the threads it is running.
 *
 * T3 Code is a front end, not a harness: every thread it opens runs an ordinary
 * Claude Code, Codex or Antigravity session underneath, which is why its rows reach a
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
import { existsSync } from 'fs';
import { join } from 'path';

/** prefer the live V2 database, keeping V1 fallback for boxes before cutover. */
export function t3StateDbPath(baseDir = join(homedir(), '.t3')) {
  const v2 = join(baseDir, 'userdata', 'statev2.sqlite');
  return existsSync(v2) ? v2 : join(baseDir, 'userdata', 'state.sqlite');
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

/** merge live thread state with legacy identities only where V2 has none. */
function v2Rows(db, legacy) {
  const old = new Map(legacy.map(row => [row.thread_id, row]));
  return db.prepare(`
    SELECT t.*, p.title AS project,
      pt.provider AS provider_name, pt.payload_json AS provider_payload,
      ps.model, ps.payload_json AS session_payload,
      -- frozen V1 running/waiting flags must never describe a live V2 shell
      (SELECT status FROM orchestration_v2_projection_runs r
        WHERE r.thread_id = t.thread_id ORDER BY ordinal DESC LIMIT 1) AS turn_status,
      (SELECT MAX(updated_at) FROM orchestration_v2_projection_messages m
        WHERE m.thread_id = t.thread_id AND m.role = 'user') AS latest_user_message_at,
      (SELECT COUNT(*) FROM orchestration_v2_projection_runtime_requests q
        WHERE q.thread_id = t.thread_id AND q.status = 'pending') AS pending_user_input_count,
      (SELECT COUNT(*) FROM orchestration_v2_projection_turn_items i
        WHERE i.thread_id = t.thread_id AND i.type = 'secret_request'
          AND i.status = 'waiting') AS pending_approval_count,
      (SELECT COUNT(*) FROM orchestration_v2_projection_plans pl
        WHERE pl.thread_id = t.thread_id AND pl.kind = 'proposed_plan'
          AND pl.status = 'active') AS has_actionable_proposed_plan
    FROM orchestration_v2_projection_threads t
    LEFT JOIN projection_projects p ON p.project_id = t.project_id
    LEFT JOIN orchestration_v2_projection_provider_threads pt ON pt.provider_thread_id = COALESCE(
      (SELECT active.provider_thread_id FROM orchestration_v2_projection_provider_threads active
       WHERE active.provider_thread_id = t.active_provider_thread_id
         AND json_extract(active.payload_json, '$.nativeThreadRef.nativeId') IS NOT NULL
         AND json_extract(active.payload_json, '$.nativeThreadRef.nativeId') != ''),
      (SELECT candidate.provider_thread_id FROM orchestration_v2_projection_provider_threads candidate
      WHERE candidate.thread_id = t.thread_id
        AND json_extract(candidate.payload_json, '$.nativeThreadRef.nativeId') IS NOT NULL
        AND json_extract(candidate.payload_json, '$.nativeThreadRef.nativeId') != ''
      ORDER BY candidate.updated_at DESC LIMIT 1))
    LEFT JOIN orchestration_v2_projection_provider_sessions ps
      ON ps.provider_session_id = pt.provider_session_id
    WHERE t.deleted_at IS NULL
    ORDER BY t.updated_at ASC
  `).all().map(row => {
    const thread = parseJson(row.payload_json);
    const nativeId = parseJson(row.provider_payload).nativeThreadRef?.nativeId;
    const previous = old.get(row.thread_id);
    return {
      ...row,
      native_session_id: nativeId || '',
      provider_name: nativeId ? row.provider_name : previous?.provider_name,
      resume_cursor_json: nativeId ? '{}' : previous?.resume_cursor_json,
      runtime_payload_json: nativeId
        ? JSON.stringify({ ...parseJson(row.session_payload), model: row.model })
        : previous?.runtime_payload_json,
      settled_override: thread.settledOverride,
      settled_at: thread.settledAt,
      snoozed_until: thread.snoozedUntil,
    };
  });
}

function rawRows(dbPath) {
  let sqlite;
  try {
    sqlite = loadSqlite();
  } catch {
    return [];
  }
  let db;
  try {
    db = new sqlite.DatabaseSync(dbPath, { readOnly: true });
    const hasV2 = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'orchestration_v2_projection_threads'").get();
    let legacy = [];
    try { legacy = db.prepare(QUERY).all(); } catch (error) {
      if (!hasV2) throw error;
    }
    return hasV2 ? v2Rows(db, legacy) : legacy;
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
 * `resume` for Claude Code, `threadId` for Codex, `sessionId` for Antigravity.
 * Codex's `threadId` is Codex's own name for its session id, not T3's thread
 * id, which is why it is read only for that provider and never as a fallback.
 */
function sessionIdOf(cursor, provider) {
  if (provider === 'claudeAgent') return String(cursor.resume || '');
  if (provider === 'codex') return String(cursor.threadId || '');
  return String(cursor.sessionId || cursor.resume || '');
}

function shape(row, nowMs) {
  const cursor = parseJson(row.resume_cursor_json);
  const payload = parseJson(row.runtime_payload_json);
  const sessionId = row.native_session_id || sessionIdOf(cursor, row.provider_name);
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
    status: asks || row.turn_status === 'waiting' ? 'waiting'
      : ['preparing', 'starting', 'running'].includes(row.turn_status) ? 'busy' : 'idle',
    settled: String(row.settled_override || '') === 'settled' || Boolean(row.settled_at),
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
 * @param {{ nowMs?: number, dbPath?: string }} [opts] `nowMs` is the clock snoozes are judged against
 * @returns {Map<string, object>}
 */
export function t3ThreadsBySession({ nowMs = Date.now(), dbPath = process.env.T3_STATE_DB || t3StateDbPath() } = {}) {
  const out = new Map();
  for (const row of rawRows(dbPath)) {
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
 * @param {{ all?: boolean, nowMs?: number, dbPath?: string }} [opts] `all` keeps everything
 * @returns {object[]}
 */
export function t3OpenThreads({ all = false, nowMs = Date.now(), dbPath } = {}) {
  const threads = [...t3ThreadsBySession({ nowMs, dbPath }).values()];
  const kept = all
    ? threads
    : threads.filter(t => !t.settled && !t.snoozed && !t.archived);
  return kept.reverse();
}
