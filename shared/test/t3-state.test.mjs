import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DatabaseSync } from 'node:sqlite';

import { t3OpenThreads, t3ThreadsBySession, t3StateDbPath } from '../t3-state.mjs';

const DB = join(mkdtempSync(join(tmpdir(), 't3-state-')), 'state.sqlite');
process.env.T3_STATE_DB = DB;

// the clock every fixture below is written against
const NOW = Date.parse('2026-09-10T12:00:00.000Z');
const ago = mins => new Date(NOW - mins * 60_000).toISOString();
const ahead = mins => new Date(NOW + mins * 60_000).toISOString();

/** the three tables t3-state joins, cut down to the columns it reads. */
function seed(threads) {
  const db = new DatabaseSync(DB);
  db.exec(`
    CREATE TABLE projection_threads (
      thread_id TEXT PRIMARY KEY, project_id TEXT, title TEXT, updated_at TEXT,
      latest_user_message_at TEXT, deleted_at TEXT, archived_at TEXT,
      settled_override TEXT, snoozed_until TEXT,
      pending_approval_count INTEGER DEFAULT 0,
      pending_user_input_count INTEGER DEFAULT 0,
      has_actionable_proposed_plan INTEGER DEFAULT 0);
    CREATE TABLE provider_session_runtime (
      thread_id TEXT PRIMARY KEY, provider_name TEXT, status TEXT,
      last_seen_at TEXT, resume_cursor_json TEXT, runtime_payload_json TEXT);
    CREATE TABLE projection_thread_sessions (thread_id TEXT PRIMARY KEY, status TEXT);
    CREATE TABLE projection_projects (project_id TEXT PRIMARY KEY, title TEXT);
    INSERT INTO projection_projects VALUES ('p1', 'ccChat-general');
  `);

  for (const t of threads) {
    db.prepare(`INSERT INTO projection_threads
      (thread_id, project_id, title, updated_at, latest_user_message_at, deleted_at,
       archived_at, settled_override, snoozed_until, pending_approval_count,
       pending_user_input_count, has_actionable_proposed_plan)
      VALUES (?, 'p1', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      t.id, t.title, t.updatedAt, t.updatedAt, t.deletedAt ?? null, t.archivedAt ?? null,
      t.settled ? 'settled' : null, t.snoozedUntil ?? null,
      t.approvals ?? 0, t.inputs ?? 0, t.plan ?? 0);

    db.prepare(`INSERT INTO provider_session_runtime VALUES (?, ?, ?, ?, ?, ?)`).run(
      t.id, t.provider ?? 'claudeAgent', t.turnStatus ?? 'stopped', t.updatedAt,
      JSON.stringify(t.cursor), JSON.stringify({ model: 'claude-opus-5', cwd: '/tmp/repo' }));

    db.prepare(`INSERT INTO projection_thread_sessions VALUES (?, ?)`).run(t.id, t.turnStatus ?? 'stopped');
  }
  db.close();
}

seed([
  { id: 'open-1', title: 'Open newest', updatedAt: ago(1), cursor: { resume: 'sess-open-1' } },
  { id: 'open-2', title: 'Open older', updatedAt: ago(30), cursor: { resume: 'sess-open-2' } },
  { id: 'agy-1', title: 'Antigravity thread', updatedAt: ago(10), provider: 'antigravity',
    cursor: { schemaVersion: 1, sessionId: 'sess-agy-1' } },
  // Codex calls its own session id threadId; it is not T3's thread id
  { id: 'codex-1', title: 'Codex thread', updatedAt: ago(11), provider: 'codex',
    cursor: { threadId: 'sess-codex-1' } },
  { id: 'waiting-1', title: 'Waiting on approval', updatedAt: ago(5), turnStatus: 'running',
    approvals: 1, cursor: { resume: 'sess-waiting-1' } },
  { id: 'busy-1', title: 'Mid turn', updatedAt: ago(6), turnStatus: 'running',
    cursor: { resume: 'sess-busy-1' } },
  { id: 'settled-1', title: 'Settled', updatedAt: ago(2), settled: true, cursor: { resume: 'sess-settled-1' } },
  { id: 'snoozed-1', title: 'Snoozed', updatedAt: ago(3), snoozedUntil: ahead(60),
    cursor: { resume: 'sess-snoozed-1' } },
  { id: 'woken-1', title: 'Snooze expired', updatedAt: ago(4), snoozedUntil: ago(60),
    cursor: { resume: 'sess-woken-1' } },
  { id: 'archived-1', title: 'Archived', updatedAt: ago(7), archivedAt: ago(7),
    cursor: { resume: 'sess-archived-1' } },
  { id: 'deleted-1', title: 'Deleted', updatedAt: ago(8), deletedAt: ago(8),
    cursor: { resume: 'sess-deleted-1' } },
  { id: 'nocursor-1', title: 'No session yet', updatedAt: ago(9), cursor: {} },
  // a thread resumed from another shares its session id; the newer one wins the key
  { id: 'resumed-from', title: 'Resumed from', updatedAt: ago(50), cursor: { resume: 'sess-shared' } },
  { id: 'resumed-to', title: 'Resumed to', updatedAt: ago(49), cursor: { resume: 'sess-shared' } },
]);

const open = () => t3OpenThreads({ nowMs: NOW });
const titles = rows => rows.map(r => r.title);

test('open threads hide settled, snoozed and archived ones', () => {
  assert.deepEqual(titles(open()), [
    'Open newest',
    'Snooze expired',
    'Waiting on approval',
    'Mid turn',
    'Antigravity thread',
    'Codex thread',
    'Open older',
    'Resumed to',
  ]);
});

test('--all keeps everything but still drops deleted and session-less threads', () => {
  const all = titles(t3OpenThreads({ all: true, nowMs: NOW }));
  assert.ok(all.includes('Settled'));
  assert.ok(all.includes('Snoozed'));
  assert.ok(all.includes('Archived'));
  assert.ok(!all.includes('Deleted'));
  assert.ok(!all.includes('No session yet'));
});

test('status reads waiting over busy, and busy over idle', () => {
  const by = new Map(t3OpenThreads({ all: true, nowMs: NOW }).map(t => [t.threadId, t]));
  assert.equal(by.get('waiting-1').status, 'waiting');
  assert.equal(by.get('waiting-1').asks, 1);
  assert.equal(by.get('busy-1').status, 'busy');
  assert.equal(by.get('open-1').status, 'idle');
});

test('a snooze in the past is not a snooze', () => {
  const by = new Map(t3OpenThreads({ all: true, nowMs: NOW }).map(t => [t.threadId, t]));
  assert.equal(by.get('snoozed-1').snoozed, true);
  assert.equal(by.get('snoozed-1').snoozedUntil, ahead(60));
  assert.equal(by.get('woken-1').snoozed, false);
  assert.equal(by.get('woken-1').snoozedUntil, '');
});

test('each provider files its session id under its own key', () => {
  const map = t3ThreadsBySession({ nowMs: NOW });
  assert.equal(map.get('sess-open-1').threadId, 'open-1');
  assert.equal(map.get('sess-agy-1').threadId, 'agy-1');
  assert.equal(map.get('sess-agy-1').provider, 'antigravity');
  assert.equal(map.get('sess-codex-1').threadId, 'codex-1');
  assert.equal(map.get('sess-codex-1').provider, 'codex');
  // a codex cursor's threadId never leaks into another provider's lookup
  assert.equal(map.has('codex-1'), false);
});

test('a session id shared by two threads resolves to the newer thread', () => {
  assert.equal(t3ThreadsBySession({ nowMs: NOW }).get('sess-shared').threadId, 'resumed-to');
});

test('a missing database reads as no T3 rather than an error', () => {
  const real = process.env.T3_STATE_DB;
  process.env.T3_STATE_DB = join(tmpdir(), 'definitely-not-here', 'state.sqlite');
  try {
    assert.deepEqual(t3OpenThreads(), []);
    assert.equal(t3ThreadsBySession().size, 0);
  } finally {
    process.env.T3_STATE_DB = real;
  }
});


/** seed both generations, including a stale legacy running flag and a handoff. */
function v2Fixture() {
  const baseDir = mkdtempSync(join(tmpdir(), 't3-state-v2-'));
  const path = join(baseDir, 'statev2.sqlite');
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE projection_projects (project_id TEXT, title TEXT);
    INSERT INTO projection_projects VALUES ('p', 'live project');
    CREATE TABLE provider_session_runtime (thread_id TEXT, provider_name TEXT,
      last_seen_at TEXT, resume_cursor_json TEXT, runtime_payload_json TEXT);
    CREATE TABLE projection_thread_sessions (thread_id TEXT, status TEXT);
    CREATE TABLE projection_threads (thread_id TEXT, project_id TEXT, title TEXT,
      updated_at TEXT, latest_user_message_at TEXT, settled_override TEXT,
      snoozed_until TEXT, archived_at TEXT, deleted_at TEXT, pending_approval_count INTEGER,
      pending_user_input_count INTEGER, has_actionable_proposed_plan INTEGER);
    CREATE TABLE orchestration_v2_projection_threads (thread_id TEXT, project_id TEXT,
      title TEXT, updated_at TEXT, active_provider_thread_id TEXT,
      archived_at TEXT, deleted_at TEXT, payload_json TEXT);
    CREATE TABLE orchestration_v2_projection_provider_threads (provider_thread_id TEXT,
      thread_id TEXT, provider TEXT, provider_session_id TEXT, updated_at TEXT, payload_json TEXT);
    CREATE TABLE orchestration_v2_projection_provider_sessions (provider_session_id TEXT,
      model TEXT, payload_json TEXT);
    CREATE TABLE orchestration_v2_projection_runs (thread_id TEXT, ordinal INTEGER, status TEXT);
    CREATE TABLE orchestration_v2_projection_messages (thread_id TEXT, role TEXT, updated_at TEXT);
    CREATE TABLE orchestration_v2_projection_runtime_requests (thread_id TEXT, status TEXT);
    CREATE TABLE orchestration_v2_projection_turn_items (thread_id TEXT, type TEXT, status TEXT);
    CREATE TABLE orchestration_v2_projection_plans (thread_id TEXT, kind TEXT, status TEXT);
    INSERT INTO projection_threads VALUES
      ('legacy', 'p', 'frozen title', '2026-10-01', NULL, NULL, NULL, NULL, NULL, 1, 0, 0),
      ('handoff', 'p', 'old handoff', '2026-10-01', NULL, NULL, NULL, NULL, NULL, 0, 0, 0);
    INSERT INTO provider_session_runtime VALUES
      ('legacy', 'claudeAgent', NULL, '{"resume":"legacy-session"}', '{"cwd":"/legacy"}'),
      ('handoff', 'claudeAgent', NULL, '{"resume":"old-session"}', '{}');
    INSERT INTO projection_thread_sessions VALUES ('legacy', 'running'), ('handoff', 'running');
    INSERT INTO orchestration_v2_projection_threads VALUES
      ('legacy', 'p', 'live legacy title', '2026-10-12', NULL, NULL, NULL, '{}'),
      ('handoff', 'p', 'handoff', '2026-10-13', 'active', NULL, NULL, '{}'),
      ('new', 'p', 'new V2 thread', '2026-10-14', NULL, NULL, NULL, '{}');
    INSERT INTO orchestration_v2_projection_provider_threads VALUES
      ('active', 'handoff', 'codex', 'matched-session', '2026-10-12',
       '{"nativeThreadRef":{"nativeId":"current-session"}}'),
      ('newer-inactive', 'handoff', 'claudeAgent', 'other-session', '2026-10-13',
       '{"nativeThreadRef":{"nativeId":"inactive-session"}}'),
      ('new-provider', 'new', 'claudeAgent', 'new-session', '2026-10-14',
       '{"nativeThreadRef":{"nativeId":"brand-new-session"}}');
    INSERT INTO orchestration_v2_projection_provider_sessions VALUES
      ('matched-session', 'live-model', '{"cwd":"/current"}'),
      ('other-session', 'wrong-model', '{"cwd":"/wrong"}'),
      ('new-session', 'new-model', '{"cwd":"/new"}');
    INSERT INTO orchestration_v2_projection_runs VALUES ('handoff', 1, 'running'), ('new', 1, 'waiting');
  `);
  db.close();
  return { dbPath: path };
}

test('V2 uses active native identities and matching session metadata, with V1 identity fallback', () => {
  const opts = v2Fixture();
  const map = t3ThreadsBySession(opts);
  assert.equal(map.has('old-session'), false);
  assert.equal(map.has('inactive-session'), false);
  assert.equal(map.get('current-session').cwd, '/current');
  assert.equal(map.get('current-session').model, 'live-model');
  assert.equal(map.get('current-session').status, 'busy');
  assert.equal(map.get('legacy-session').title, 'live legacy title');
  assert.equal(map.get('legacy-session').status, 'idle');
  assert.equal(map.get('legacy-session').asks, 0);
  assert.equal(map.get('brand-new-session').status, 'waiting');
});

test('V2 live filtering and pending requests override frozen legacy state', () => {
  const opts = v2Fixture();
  const db = new DatabaseSync(opts.dbPath);
  db.exec(`
    UPDATE orchestration_v2_projection_threads SET payload_json = '{"settledAt":"2026-10-12"}'
      WHERE thread_id = 'legacy';
    INSERT INTO orchestration_v2_projection_runtime_requests VALUES ('handoff', 'pending');
    UPDATE orchestration_v2_projection_threads SET deleted_at = '2026-10-12' WHERE thread_id = 'new';
  `);
  db.close();
  assert.deepEqual(t3OpenThreads(opts).map(t => t.sessionId), ['current-session']);
  assert.equal(t3OpenThreads(opts)[0].status, 'waiting');
  assert.equal(t3OpenThreads({ ...opts, all: true }).length, 2);
});

test('V2 falls back to newest native provider thread when active identity is absent', () => {
  const opts = v2Fixture();
  const db = new DatabaseSync(opts.dbPath);
  db.exec("UPDATE orchestration_v2_projection_threads SET active_provider_thread_id = NULL WHERE thread_id = 'handoff'");
  db.close();
  assert.equal(t3ThreadsBySession(opts).get('inactive-session').cwd, '/wrong');
});

test('database selection prefers statev2.sqlite and otherwise uses state.sqlite', () => {
  const root = mkdtempSync(join(tmpdir(), 't3-path-'));
  assert.equal(t3StateDbPath(root), join(root, 'userdata', 'state.sqlite'));
  // use a real sqlite file, independent of the explicit test database override
  mkdirSync(join(root, 'userdata'));
  new DatabaseSync(join(root, 'userdata', 'statev2.sqlite')).close();
  assert.equal(t3StateDbPath(root), join(root, 'userdata', 'statev2.sqlite'));
});
