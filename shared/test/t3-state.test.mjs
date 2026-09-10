import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DatabaseSync } from 'node:sqlite';

import { t3OpenThreads, t3ThreadsBySession } from '../t3-state.mjs';

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
