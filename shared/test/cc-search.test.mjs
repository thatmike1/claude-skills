import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseSessionFile } from '../cc-parser.mjs';
import { searchParsedSessions } from '../cc-search.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASIC = join(HERE, 'fixtures', 'session-basic.jsonl');

/** parse the fixture with everything captured so scope gating (not data) is what's tested. */
async function load() {
  const parsed = await parseSessionFile(BASIC, { maxLength: Infinity, includeTools: true, includeThinking: true });
  parsed.project = 'demo';
  parsed.date = '2026-06-01';
  return [parsed];
}

test('keyword search finds a message and returns its full text', async () => {
  const sessions = await load();
  const hits = searchParsedSessions(sessions, { query: 'REQUIREMENTS' });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].matchedOn, 'text');
  assert.equal(hits[0].text, 'REQUIREMENTS: must support dark mode and SSO login');
  assert.equal(hits[0].role, 'user');
});

test('search is case-insensitive by default', async () => {
  const sessions = await load();
  assert.equal(searchParsedSessions(sessions, { query: 'requirements' }).length, 1);
  assert.equal(searchParsedSessions(sessions, { query: 'requirements', caseSensitive: true }).length, 0);
});

test('regex search matches', async () => {
  const sessions = await load();
  const hits = searchParsedSessions(sessions, { query: 'REQUIRE.*SSO', regex: true });
  assert.equal(hits.length, 1);
});

test('scope: messages does NOT match tool calls; scope: actions does', async () => {
  const sessions = await load();
  // "npm run migrate" only exists inside a Bash tool_use input
  assert.equal(searchParsedSessions(sessions, { query: 'npm run migrate', scope: 'messages' }).length, 0);
  const actionHits = searchParsedSessions(sessions, { query: 'npm run migrate', scope: 'actions' });
  assert.equal(actionHits.length, 1);
  assert.equal(actionHits[0].matchedOn, 'tool');
});

test('scope: all matches thinking; narrower scopes do not', async () => {
  const sessions = await load();
  assert.equal(searchParsedSessions(sessions, { query: 'secret plan', scope: 'messages' }).length, 0);
  assert.equal(searchParsedSessions(sessions, { query: 'secret plan', scope: 'actions' }).length, 0);
  const hits = searchParsedSessions(sessions, { query: 'secret plan', scope: 'all' });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].matchedOn, 'thinking');
});

test('context returns neighbouring messages', async () => {
  const sessions = await load();
  const [hit] = searchParsedSessions(sessions, { query: 'REQUIREMENTS', context: 1 });
  assert.ok(hit.context.length >= 1);
  assert.ok(hit.context.some(c => c.text.includes('migration')));
});

test('limit caps the number of hits', async () => {
  const sessions = await load();
  // "the" appears in several messages; limit to 1
  const hits = searchParsedSessions(sessions, { query: 'the', limit: 1 });
  assert.equal(hits.length, 1);
});

test('hit carries session pointer fields', async () => {
  const sessions = await load();
  const [hit] = searchParsedSessions(sessions, { query: 'REQUIREMENTS' });
  assert.ok(hit.filePath.endsWith('session-basic.jsonl'));
  assert.equal(hit.date, '2026-06-01');
  assert.equal(typeof hit.seq, 'number');
});
