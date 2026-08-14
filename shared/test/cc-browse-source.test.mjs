import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { resolveCcbrowse, searchViaCcbrowse } from '../cc-browse-source.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FAKE = join(HERE, 'fixtures', 'fake-ccbrowse.mjs');
const FAKE_FAIL = join(HERE, 'fixtures', 'fake-ccbrowse-fail.mjs');
const FAKE_GARBAGE = join(HERE, 'fixtures', 'fake-ccbrowse-garbage.mjs');

/** builds a throwaway filesystem with a PATH dir and a fake home. */
function sandbox({ onPath = [], inHome = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cc-browse-source-'));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  for (const name of onPath) writeFileSync(join(bin, name), '');
  const home = join(root, 'home');
  mkdirSync(home);
  if (inHome) {
    const dir = join(home, 'git', 'cc-browse');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'ccbrowse.py'), '');
  }
  return { root, bin, home, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('resolution: the disable env var wins over everything', () => {
  const box = sandbox({ onPath: ['ccbrowse.py'], inHome: true });
  const resolved = resolveCcbrowse({
    env: { CC_SKILLS_NO_CCBROWSE: '1', CCBROWSE_PY: join(box.bin, 'ccbrowse.py'), PATH: box.bin },
    home: box.home,
    argv: ['node', FAKE],
  });
  assert.equal(resolved, null);
  box.cleanup();
});

test('resolution: CCBROWSE_PY outranks PATH and the home fallback', () => {
  const box = sandbox({ onPath: ['ccbrowse.py'], inHome: true });
  const explicit = join(box.root, 'explicit.py');
  writeFileSync(explicit, '');
  const resolved = resolveCcbrowse({ env: { CCBROWSE_PY: explicit, PATH: box.bin }, home: box.home });
  assert.equal(resolved.script, explicit);
  box.cleanup();
});

test('resolution: PATH outranks the home fallback', () => {
  const box = sandbox({ onPath: ['ccbrowse.py'], inHome: true });
  const resolved = resolveCcbrowse({ env: { PATH: box.bin }, home: box.home });
  assert.equal(resolved.script, join(box.bin, 'ccbrowse.py'));
  box.cleanup();
});

test('resolution: falls back to ~/git/cc-browse, then to null', () => {
  const withHome = sandbox({ inHome: true });
  assert.equal(
    resolveCcbrowse({ env: { PATH: withHome.bin }, home: withHome.home }).script,
    join(withHome.home, 'git', 'cc-browse', 'ccbrowse.py')
  );
  withHome.cleanup();

  const bare = sandbox();
  assert.equal(resolveCcbrowse({ env: { PATH: bare.bin }, home: bare.home }), null);
  bare.cleanup();
});

test('resolution: runner is uv when uv is on PATH, python3 otherwise', () => {
  const withUv = sandbox({ onPath: ['ccbrowse.py', 'uv'] });
  assert.deepEqual(resolveCcbrowse({ env: { PATH: withUv.bin }, home: withUv.home }).argv.slice(0, 2), ['uv', 'run']);
  withUv.cleanup();

  const noUv = sandbox({ onPath: ['ccbrowse.py'] });
  assert.equal(resolveCcbrowse({ env: { PATH: noUv.bin }, home: noUv.home }).argv[0], 'python3');
  noUv.cleanup();
});

test('resolution: an explicit argv short-circuits discovery', () => {
  const resolved = resolveCcbrowse({ env: {}, home: '/nonexistent', argv: ['node', FAKE] });
  assert.deepEqual(resolved.argv, ['node', FAKE]);
});

test('search maps ccbrowse rows onto the cc-search hit shape', async () => {
  const cli = resolveCcbrowse({ env: {}, argv: ['node', FAKE] });
  const hits = await searchViaCcbrowse({ query: 'materialized', limit: 5 }, cli);

  const [hit] = hits;
  assert.equal(hit.sessionId, '550bef00-dcdd-46b4-b7f2-aaa6f6acb805');
  assert.equal(hit.project, '/home/u/git/alpha');
  assert.equal(hit.date, '2026-08-14');
  assert.equal(hit.title, 'Keyword hit');
  assert.equal(hit.excerpt, 'the `MATERIALIZED` CTE is required');
  assert.equal(hit.matchCount, 3);
  assert.equal(hit.matchedOn, 'text');
  assert.equal(hit.source, 'cc-browse');
  assert.equal(hit.via, 'subagent');
  // stderr staleness warnings from the CLI are not failures
  assert.equal(hits.length, 2);
});

test('search passes query, mode and limit through to the CLI', async () => {
  const cli = resolveCcbrowse({ env: {}, argv: ['node', FAKE] });
  const hits = await searchViaCcbrowse({ query: 'retry backoff', mode: 'semantic', project: '/home/u/git/alpha', limit: 7 }, cli);
  const echoed = hits.find(h => h.sessionId === 'echo-session').title;

  assert.match(echoed, /search retry backoff/);
  assert.match(echoed, /--mode semantic/);
  assert.match(echoed, /--limit 7/);
  assert.match(echoed, /--project \/home\/u\/git\/alpha/);
  assert.equal(hits[0].matchedOn, 'semantic');
  assert.equal(hits[0].via, undefined);
});

test('search throws when the CLI exits non-zero or prints garbage', async () => {
  await assert.rejects(
    searchViaCcbrowse({ query: 'x' }, resolveCcbrowse({ env: {}, argv: ['node', FAKE_FAIL] }))
  );
  await assert.rejects(
    searchViaCcbrowse({ query: 'x' }, resolveCcbrowse({ env: {}, argv: ['node', FAKE_GARBAGE] })),
    /could not parse/
  );
});

test('search throws when cc-browse is unavailable', async () => {
  await assert.rejects(searchViaCcbrowse({ query: 'x' }, null), /not available/);
});
