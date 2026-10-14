/**
 * t3 — what Jarvis needs from T3 Code beyond the shared roster reader: the
 * thread a session runs in, and the last words of a thread.
 *
 * Reads go straight to T3's Orchestrator V2 tables in `statev2.sqlite`,
 * read-only, so T3 stays the only writer of its database.
 */

import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

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
