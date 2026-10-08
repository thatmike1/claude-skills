import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

process.env.JARVIS_HOME = mkdtempSync(join(tmpdir(), 'jarvis-test-'));
const { ack, dirs, formatEntry, list, parseEntry, post } = await import('../lib/inbox.mjs');

test('post writes one file per entry and lists it back', () => {
  const a = post({ from: 'job', status: 'done', body: 'What changed: x.\n\nWhere: /tmp/x', thread: 't1', title: 'job one' });
  const b = post({ from: 'job', status: 'needs-you', priority: 'now', body: 'decide y' });
  const files = readdirSync(dirs().inbox);
  assert.equal(files.length, 2);
  const all = list();
  assert.deepEqual(all.map(e => e.id).sort(), [a.id, b.id].sort());
  const got = all.find(e => e.id === b.id);
  assert.equal(got.priority, 'now');
  assert.equal(got.handled, false);
  assert.equal(all.find(e => e.id === a.id).body, 'What changed: x.\n\nWhere: /tmp/x');
});

test('a retried post with the same id is a no-op', () => {
  const before = list().length;
  post({ from: 'service', status: 'silent', body: 'stub', id: 'stub01' });
  post({ from: 'service', status: 'silent', body: 'stub again', id: 'stub01' });
  assert.equal(list().length, before + 1);
  assert.equal(list().find(e => e.id === 'stub01').body, 'stub');
});

test('bad input is refused', () => {
  assert.throws(() => post({ from: 'job', status: 'great', body: 'x' }), /status/);
  assert.throws(() => post({ from: 'nobody', status: 'done', body: 'x' }), /from/);
  assert.throws(() => post({ from: 'job', status: 'done', body: '  ' }), /body/);
});

test('ack marks handled without touching the entry', () => {
  const e = post({ from: 'job', status: 'done', body: 'z' });
  const missing = ack([e.id, 'nope']);
  assert.deepEqual(missing, ['nope']);
  assert.equal(list().find(x => x.id === e.id).handled, true);
});

test('a file Mike writes by hand is his note', () => {
  writeFileSync(join(dirs().inbox, 'zz-by-hand.md'), 'remember the size chart thing\n');
  const e = list().find(x => x.file === 'zz-by-hand.md');
  assert.equal(e.from, 'mike');
  assert.equal(e.status, 'note');
  assert.equal(e.id, 'zz-by-hand');
  assert.ok(e.created);
});

test('front matter round-trips and flattens newlines in values', () => {
  const text = formatEntry({ id: 'x1', from: 'job', status: 'done', title: 'two\nlines', body: 'b' });
  const back = parseEntry(text);
  assert.equal(back.title, 'two lines');
  assert.equal(back.body, 'b');
});
