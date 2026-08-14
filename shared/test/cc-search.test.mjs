import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseSessionFile } from '../cc-parser.mjs';
import { searchParsedSessions, searchSessions, formatHits } from '../cc-search.mjs';

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

// --- cc-browse accelerator -------------------------------------------------

const FIXTURE_PROJECTS = join(HERE, 'fixtures', 'projects');
const FAKE_CCBROWSE = { argv: ['node', join(HERE, 'fixtures', 'fake-ccbrowse.mjs')] };
const FAKE_CCBROWSE_FAIL = { argv: ['node', join(HERE, 'fixtures', 'fake-ccbrowse-fail.mjs')] };

/** slow-path search over the fixture corpus, with the accelerator injected. */
function search(extra = {}) {
  return searchSessions({
    query: 'widget layout',
    global: true,
    projectsDir: FIXTURE_PROJECTS,
    ccbrowse: FAKE_CCBROWSE,
    ...extra,
  });
}

test('accelerator answers a plain keyword search', async () => {
  const hits = await search();
  assert.ok(hits.every(h => h.source === 'cc-browse'));
  assert.equal(hits[0].sessionId, '550bef00-dcdd-46b4-b7f2-aaa6f6acb805');
});

test('accelerator failure falls back to the full scan', async () => {
  const hits = await search({ ccbrowse: FAKE_CCBROWSE_FAIL });
  assert.ok(hits.length > 0);
  assert.ok(hits.every(h => h.source !== 'cc-browse'));
  assert.ok(hits.some(h => h.text.includes('widget layout')));
});

test('--no-accelerate forces the full scan', async () => {
  const hits = await search({ accelerate: false });
  assert.ok(hits.length > 0);
  assert.ok(hits.every(h => h.source !== 'cc-browse'));
});

test('regex, case sensitivity, wider scopes and date ranges bypass the accelerator', async () => {
  const cases = [
    { query: 'widget.*layout', regex: true },
    { caseSensitive: true },
    { scope: 'actions' },
    { scope: 'all' },
    { from: '2999-01-01', to: '2999-01-02' },
    { to: '1999-01-01' },
  ];
  for (const extra of cases) {
    const hits = await search(extra);
    assert.ok(hits.every(h => h.source !== 'cc-browse'), `accelerator should be skipped for ${JSON.stringify(extra)}`);
  }
});

test('mode: both merges semantic hits after keyword hits, deduped by session', async () => {
  const hits = await search({ mode: 'both' });
  const ids = hits.map(h => h.sessionId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(hits[0].matchedOn, 'text');
  assert.ok(hits.every(h => h.source === 'cc-browse'));
});

test('mode: semantic without the accelerator falls back to a keyword scan', async () => {
  const hits = await search({ mode: 'semantic', accelerate: false });
  assert.ok(hits.length > 0);
  assert.ok(hits.every(h => h.source !== 'cc-browse'));
});

test('formatHits renders accelerator hits without seq or full text', async () => {
  const hits = await search();
  const md = formatHits(hits, { query: 'widget layout' });
  assert.match(md, /Keyword hit/);
  assert.match(md, /3 matches/);
  assert.match(md, /via subagent/);
  assert.doesNotMatch(md, /msg #/);
});
