import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const scripts = join(dirname(fileURLToPath(import.meta.url)), '..');

// a minimal statev2.sqlite with only the columns gather reads
const base = mkdtempSync(join(tmpdir(), 'thread-explainer-'));
const dbPath = join(base, 'statev2.sqlite');
const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE projection_projects (project_id TEXT, title TEXT);
  CREATE TABLE orchestration_v2_projection_threads (thread_id TEXT, project_id TEXT, title TEXT, created_at TEXT, archived_at TEXT, deleted_at TEXT, payload_json TEXT);
  CREATE TABLE orchestration_v2_projection_runs (thread_id TEXT, ordinal INTEGER, status TEXT, requested_at TEXT, completed_at TEXT);
  CREATE TABLE orchestration_v2_projection_messages (thread_id TEXT, role TEXT, streaming INTEGER, created_at TEXT, payload_json TEXT);
  CREATE TABLE orchestration_v2_projection_provider_threads (thread_id TEXT, updated_at TEXT, payload_json TEXT);
  INSERT INTO projection_projects VALUES ('p', 'home');
`);
const thread = (id, created, payload = {}) => db.prepare('INSERT INTO orchestration_v2_projection_threads VALUES (?, ?, ?, ?, NULL, NULL, ?)')
  .run(id, 'p', `title ${id}`, created, JSON.stringify(payload));
const run = (id, status, at) => db.prepare('INSERT INTO orchestration_v2_projection_runs VALUES (?, 1, ?, ?, ?)').run(id, status, at, at);
const say = (id, role, text, at, createdBy = 'user') => db.prepare('INSERT INTO orchestration_v2_projection_messages VALUES (?, ?, 0, ?, ?)')
  .run(id, role, at, JSON.stringify(role === 'user' ? { text, createdBy } : { text }));

thread('pinned-b', '2026-10-20T08:00:00.000Z', { pinnedAt: '2026-10-20T08:00:00.000Z', pinOrderKey: 'b' });
thread('pinned-a', '2026-10-20T09:00:00.000Z', { pinnedAt: '2026-10-20T09:00:00.000Z', pinOrderKey: 'a' });
thread('older', '2026-10-21T08:00:00.000Z');
thread('newer', '2026-10-21T09:00:00.000Z');
thread('self', '2026-10-21T10:00:00.000Z');
thread('snoozed', '2026-10-22T12:00:00.000Z', { snoozedUntil: '2999-01-01T00:00:00.000Z' });
thread('settled', '2026-10-22T12:00:00.000Z', { settledAt: '2026-10-22T12:30:00.000Z' });
thread('child', '2026-10-22T12:00:00.000Z', { lineage: { parentThreadId: 'newer', relationshipToParent: 'subagent' } });
run('older', 'completed', '2026-10-22T11:00:00.000Z');
run('newer', 'completed', '2026-10-22T10:00:00.000Z');
run('child', 'running', '2026-10-22T12:00:00.000Z');
const session = (id, nativeId) => db.prepare('INSERT INTO orchestration_v2_projection_provider_threads VALUES (?, ?, ?)')
  .run(id, '2026-10-22T12:00:00.000Z', JSON.stringify({ nativeThreadRef: { nativeId } }));
session('self', 'session-me');
session('child', 'session-child');

// a T3 notice lands after the agent's reply; it is not Mike talking
say('older', 'user', 'please sort the tabs into shelves for me', '2026-10-22T10:00:00.000Z');
say('older', 'assistant', `Shelves are up at /home/nobody/shelves.html and the cut is /home/nobody/cut.mp4. ${'progress line. '.repeat(400)}Which shelf goes first?`, '2026-10-22T10:05:00.000Z');
say('older', 'user', 'Delegated task reached a terminal state: completed', '2026-10-22T10:06:00.000Z', 'agent');

// a Jarvis thread keeps four of his messages, not two
say('pinned-a', 'user', '$jarvis read the overnight notes and tell me what happened', '2026-10-21T09:00:00.000Z');
for (let i = 1; i <= 5; i++) {
  say('pinned-a', 'user', `long message number ${i} with real words in it`, `2026-10-22T0${i}:00:00.000Z`);
  say('pinned-a', 'assistant', `answer ${i}`, `2026-10-22T0${i}:10:00.000Z`);
}
db.close();

/** run gather as the agent of one session, returning its facts. */
function gather(out, sessionId) {
  execFileSync('node', [join(scripts, 'gather.mjs'), '--out', out], {
    env: { ...process.env, T3_STATE_DB: dbPath, CLAUDE_CODE_SESSION_ID: sessionId },
  });
  return JSON.parse(readFileSync(join(out, 'facts.json'), 'utf8'));
}
const out = join(base, 'run');
const facts = gather(out, 'session-me');
const byId = Object.fromEntries(facts.threads.map(t => [t.threadId, t]));

test('threads come in sidebar order, numbered with the calling thread counted', () => {
  assert.deepEqual(facts.threads.map(t => `${t.sidebarIndex} ${t.threadId}`),
    ['1 pinned-a', '2 pinned-b', '3 older', '4 newer']);
});

test('settled, snoozed and subagent threads are left out', () => {
  for (const id of ['settled', 'snoozed', 'child', 'self']) assert.equal(byId[id], undefined);
});

test('a T3 notice does not count as Mike having the last word', () => {
  assert.equal(byId.older.lastWordIsMike, false);
  assert.deepEqual(byId.older.exchanges.map(e => e.mike), ['please sort the tabs into shelves for me']);
});

test('pages and files of any type are picked up from replies', () => {
  assert.deepEqual(byId.older.artifacts.map(a => a.ref), ['/home/nobody/shelves.html', '/home/nobody/cut.mp4']);
});

test('a long reply keeps its ending, where the question sits', () => {
  const reply = byId.older.exchanges[0].reply;
  assert.ok(reply.length < 1700);
  assert.match(reply, /\[…\] .*Which shelf goes first\?$/);
});

test('an agent delegated from a thread leaves that thread out', () => {
  const ids = gather(join(base, 'run-child'), 'session-child').threads.map(t => t.threadId);
  assert.deepEqual(ids, ['pinned-a', 'pinned-b', 'older', 'self']);
});

test('a Jarvis thread carries four exchanges, each with its answer', () => {
  assert.equal(byId['pinned-a'].jarvis, true);
  assert.deepEqual(byId['pinned-a'].exchanges.map(e => e.reply), ['answer 2', 'answer 3', 'answer 4', 'answer 5']);
  assert.equal(byId.older.jarvis, false);
});

test('running delegated agents are listed under their parent', () => {
  assert.deepEqual(byId.newer.children.running, ['title child']);
});

test('read.md has a section per thread', () => {
  const read = readFileSync(join(out, 'read.md'), 'utf8');
  assert.match(read, /^## 3 · title older$/m);
  assert.match(read, /\(missing on disk\)/);
  assert.doesNotMatch(read, /Delegated task reached/);
});

test('build marks a thread nobody judged instead of dropping it', () => {
  writeFileSync(join(out, 'judgments.json'), JSON.stringify({ threads: { older: { kind: 'look', about: 'tabs', you: 'Open the shelves.' } } }));
  execFileSync('node', [join(scripts, 'build.mjs'), out]);
  const html = readFileSync(join(base, 'latest.html'), 'utf8');
  const data = JSON.parse(html.match(/<script id="data" type="application\/json">(.*?)<\/script>/s)[1]);
  const kinds = Object.fromEntries(data.threads.map(t => [t.threadId, [t.kind, t.you]]));
  assert.deepEqual(kinds.older, ['look', 'Open the shelves.']);
  assert.deepEqual(kinds.newer, ['none', 'Not read in this run.']);
});

test.after(() => rmSync(base, { recursive: true, force: true }));
