import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// a minimal statev2.sqlite with only the columns Jarvis reads
const base = mkdtempSync(join(tmpdir(), 'jarvis-t3-'));
mkdirSync(join(base, 'userdata'));
process.env.T3_BASE_DIR = base;
const db = new DatabaseSync(join(base, 'userdata', 'statev2.sqlite'));
db.exec(`
  CREATE TABLE orchestration_v2_projection_threads (thread_id TEXT, title TEXT, created_at TEXT, deleted_at TEXT, payload_json TEXT);
  CREATE TABLE orchestration_v2_projection_runs (thread_id TEXT, ordinal INTEGER, status TEXT);
  CREATE TABLE orchestration_v2_projection_runtime_requests (thread_id TEXT, status TEXT);
  CREATE TABLE orchestration_v2_projection_turn_items (thread_id TEXT, type TEXT, status TEXT);
  CREATE TABLE orchestration_v2_projection_plans (thread_id TEXT, kind TEXT, status TEXT);
  CREATE TABLE orchestration_v2_projection_messages (thread_id TEXT, role TEXT, streaming INTEGER, created_at TEXT, payload_json TEXT);
  CREATE TABLE orchestration_v2_projection_provider_threads (thread_id TEXT, updated_at TEXT, payload_json TEXT);
`);
const thread = (id, payload = {}) => db.prepare('INSERT INTO orchestration_v2_projection_threads VALUES (?, ?, ?, NULL, ?)')
  .run(id, `title ${id}`, '2026-10-12T10:00:00.000Z', JSON.stringify(payload));
const message = (id, role, text, at, streaming = 0) => db.prepare('INSERT INTO orchestration_v2_projection_messages VALUES (?, ?, ?, ?, ?)')
  .run(id, role, streaming, at, JSON.stringify({ text }));
thread('home');
thread('busy');
thread('asking');
thread('done', { settledOverride: 'settled' });
db.prepare('INSERT INTO orchestration_v2_projection_runs VALUES (?, ?, ?)').run('busy', 1, 'completed');
db.prepare('INSERT INTO orchestration_v2_projection_runs VALUES (?, ?, ?)').run('busy', 2, 'running');
db.prepare('INSERT INTO orchestration_v2_projection_runtime_requests VALUES (?, ?)').run('asking', 'pending');
message('home', 'user', 'hi jarvis', '2026-10-12T11:00:00.000Z');
message('home', 'assistant', 'hello', '2026-10-12T11:00:05.000Z');
message('busy', 'user', 'port the thing', '2026-10-12T11:10:00.000Z');
message('busy', 'assistant', 'half written', '2026-10-12T11:20:00.000Z', 1);
db.prepare('INSERT INTO orchestration_v2_projection_provider_threads VALUES (?, ?, ?)')
  .run('home', '2026-10-12T11:00:00.000Z', JSON.stringify({ nativeThreadRef: { nativeId: 'session-abc' } }));
db.close();

const { activity, anyThreadBusy, lastWords, threadForSession, threadInfo } = await import('../lib/t3.mjs');

test('threadInfo reads status from the latest run and open asks', () => {
  assert.equal(threadInfo('home').status, 'idle');
  assert.equal(threadInfo('busy').status, 'busy');
  assert.equal(threadInfo('asking').status, 'waiting');
  assert.equal(threadInfo('done').settled, true);
  assert.equal(threadInfo('home').updatedAt, '2026-10-12T11:00:05.000Z');
  assert.equal(threadInfo('missing'), null);
});

test('threadForSession maps a native session id to its thread', () => {
  assert.equal(threadForSession('session-abc'), 'home');
  assert.equal(threadForSession('nope'), null);
});

test('lastWords skips a message still streaming', () => {
  const words = lastWords('busy');
  assert.equal(words.user, 'port the thing');
  assert.equal(words.assistant, '');
});

test('activity separates Jarvis home from everything else', () => {
  assert.deepEqual(activity('home'), {
    lastAll: '2026-10-12T11:20:00.000Z',
    lastOthers: '2026-10-12T11:20:00.000Z',
    homeLastUser: '2026-10-12T11:00:00.000Z',
  });
  assert.equal(anyThreadBusy(), true);
});

test.after(() => rmSync(base, { recursive: true, force: true }));
