import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { listParked, main, readOpenItems, recordOffered, setParkedField } from './parked.mjs';

async function fixture(lines) {
  const dir = await mkdtemp(join(tmpdir(), 'warden-parked-'));
  const listPath = join(dir, 'parked.jsonl');
  await writeFile(listPath, lines.map(line => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n') + '\n');
  return { dir, listPath, offeredPath: join(dir, 'state', 'parked-offered.json'), cli: '/fake/overlay-hud-v2' };
}

const OPEN = { id: 'aaaa0001', text: 'call the vet', created: '2026-09-24T10:00:00+02:00', done: null };
const TIDIED = { id: 'aaaa0002', text: 'jindra thing', tidy: 'Reply to Jindra', bead: 'ccChat-general-q3x', done: null };
const TICKED = { id: 'aaaa0003', text: 'done already', done: '2026-09-24T11:00:00+02:00' };

test('lists open items only, skipping ticked ones and lines that do not parse', async () => {
  const config = await fixture([OPEN, 'not json', TICKED, TIDIED]);
  const items = await readOpenItems(config.listPath);
  assert.deepEqual(items.map(item => item.id), ['aaaa0001', 'aaaa0002']);
  assert.equal(items[1].tidy, 'Reply to Jindra');
});

test('a missing list is empty, not an error', async () => {
  const config = await fixture([]);
  assert.deepEqual(await readOpenItems(join(config.dir, 'nope.jsonl')), []);
});

test('an offer is made once per item and never again, whatever the answer', async () => {
  const config = await fixture([OPEN, TIDIED]);
  let listed = await listParked(config);
  assert.deepEqual(listed.items.map(item => [item.id, item.needsTidy, item.mayOfferBead]), [
    ['aaaa0001', true, true],
    ['aaaa0002', false, false],
  ]);
  await recordOffered(config.offeredPath, ['aaaa0001'], () => new Date('2026-09-24T12:00:00Z'));
  await recordOffered(config.offeredPath, ['aaaa0001'], () => new Date('2026-09-25T12:00:00Z'));
  listed = await listParked(config);
  assert.equal(listed.items[0].mayOfferBead, false);
  const saved = JSON.parse(await readFile(config.offeredPath, 'utf8'));
  assert.equal(saved.offered.aaaa0001, '2026-09-24T12:00:00.000Z');
});

test('writes go through the HUD with the field and the cleaned value', async () => {
  const config = await fixture([OPEN]);
  const calls = [];
  const runner = async (file, args) => { calls.push([file, ...args]); return { stdout: '' }; };
  await setParkedField(config, 'aaaa0001', 'tidy', '  Call the vet:\n Sora ', runner);
  await setParkedField(config, 'aaaa0001', 'bead', 'ccChat-general-abc', runner);
  assert.deepEqual(calls, [
    ['/fake/overlay-hud-v2', '--parked-set', 'aaaa0001', 'tidy', 'Call the vet: Sora'],
    ['/fake/overlay-hud-v2', '--parked-set', 'aaaa0001', 'bead', 'ccChat-general-abc'],
  ]);
});

test('Warden cannot touch the words, and says so plainly without a writer', async () => {
  const config = await fixture([OPEN]);
  const runner = async () => ({ stdout: '' });
  await assert.rejects(setParkedField(config, 'aaaa0001', 'text', 'rewritten', runner), /Only tidy and bead/);
  await assert.rejects(setParkedField({ ...config, cli: null }, 'aaaa0001', 'tidy', 'x', runner), /parkedCli/);
  await assert.rejects(setParkedField(config, 'aaaa0001', 'bead', 'no spaces allowed', runner), /bead id/);
  const gone = async () => { throw Object.assign(new Error('exit 1'), { code: 1 }); };
  await assert.rejects(setParkedField(config, 'aaaa0001', 'tidy', 'x', gone), /cleared it/);
});

test('the command line reads the configured paths', async () => {
  const config = await fixture([OPEN]);
  const configPath = join(config.dir, 'config.json');
  await writeFile(configPath, JSON.stringify({ parkedList: config.listPath, parkedOffered: config.offeredPath }));
  const listed = await main(['list'], { configPath });
  assert.equal(listed.canWrite, false);
  assert.equal(listed.items.length, 1);
  await assert.rejects(main(['offered', 'not-an-id'], { configPath }), /8 hex digits/);
});
