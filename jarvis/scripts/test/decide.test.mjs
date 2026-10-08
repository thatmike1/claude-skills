import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decideCheckin, decideWake, isUrgent, sortLaunched, summarize } from '../lib/decide.mjs';

const MIN = 60_000;
// a fixed weekday at 14:00 local, inside the default check-in window
const NOW = new Date(2026, 9, 8, 14, 0, 0).getTime();
const iso = ms => new Date(ms).toISOString();
const idleHome = { status: 'idle', updatedAt: iso(NOW - 10 * MIN) };
const entry = (id, over = {}) => ({ id, from: 'job', status: 'done', priority: 'normal', created: iso(NOW - MIN), ...over });

test('urgent entries: mike, now, and stuck statuses', () => {
  assert.equal(isUrgent(entry('a', { from: 'mike', status: 'note' })), true);
  assert.equal(isUrgent(entry('b', { priority: 'now' })), true);
  for (const status of ['failed', 'blocked', 'needs-you']) assert.equal(isUrgent(entry('c', { status })), true);
  assert.equal(isUrgent(entry('d')), false);
  assert.equal(isUrgent(entry('e', { status: 'silent' })), false);
});

test('an ordinary result waits while other jobs are still out', () => {
  const wake = decideWake({ now: NOW, unhandled: [entry('a')], outstanding: [{}], home: idleHome, lastWakeIds: [] });
  assert.equal(wake, null);
});

test('everything back wakes once', () => {
  const wake = decideWake({ now: NOW, unhandled: [entry('a'), entry('b')], outstanding: [], home: idleHome, lastWakeIds: [] });
  assert.equal(wake.reason, 'everything sent out is back');
  assert.deepEqual(wake.ids, ['a', 'b']);
  assert.match(wake.text, /2 new: 2 done/);
  assert.match(wake.text, /`jarvis ack a b`/);
});

test('the deadline stops the last job stranding the rest', () => {
  const old = entry('a', { created: iso(NOW - 25 * MIN) });
  const wake = decideWake({ now: NOW, unhandled: [old], outstanding: [{}], home: idleHome, lastWakeIds: [] });
  assert.match(wake.reason, /waiting 20\+ min/);
  assert.match(wake.text, /1 still running/);
});

test('urgent wakes at once even with jobs out', () => {
  const wake = decideWake({ now: NOW, unhandled: [entry('a', { status: 'failed' })], outstanding: [{}], home: idleHome, lastWakeIds: [] });
  assert.equal(wake.reason, 'needs attention');
  const note = decideWake({ now: NOW, unhandled: [entry('m', { from: 'mike', status: 'note' })], outstanding: [], home: idleHome, lastWakeIds: [] });
  assert.equal(note.reason, 'Mike wrote');
});

test('never wakes twice for the same entries, and wakes again when one is new', () => {
  const unhandled = [entry('a', { status: 'failed' })];
  assert.equal(decideWake({ now: NOW, unhandled, outstanding: [], home: idleHome, lastWakeIds: ['a'] }), null);
  const more = [...unhandled, entry('b', { status: 'blocked' })];
  const wake = decideWake({ now: NOW, unhandled: more, outstanding: [], home: idleHome, lastWakeIds: ['a'] });
  assert.deepEqual(wake.ids, ['a', 'b']);
});

test('a busy, waiting or just-active home thread is left alone', () => {
  const unhandled = [entry('a', { status: 'failed' })];
  for (const home of [{ status: 'busy', updatedAt: iso(NOW - 10 * MIN) }, { status: 'waiting', updatedAt: iso(NOW - 10 * MIN) }, { status: 'idle', updatedAt: iso(NOW - 20_000) }, null]) {
    assert.equal(decideWake({ now: NOW, unhandled, outstanding: [], home, lastWakeIds: [] }), null);
  }
});

test('launched threads: reported, stubbed, quiet and stuck', () => {
  const launchedAt = iso(NOW - 60 * MIN);
  const t = (threadId, over = {}) => ({ threadId, launchedAt, title: threadId, status: 'busy', settled: false, updatedAt: iso(NOW - MIN), ...over });
  const launched = [
    t('reported', { status: 'idle', updatedAt: iso(NOW - 30 * MIN) }),
    t('stubbed', { status: 'idle', updatedAt: iso(NOW - 30 * MIN) }),
    t('quiet', { status: 'idle', updatedAt: iso(NOW - 15 * MIN) }),
    t('just-idle', { status: 'idle', updatedAt: iso(NOW - 2 * MIN) }),
    t('stuck', { status: 'waiting' }),
    t('working'),
    t('settled', { settled: true, status: 'idle', updatedAt: iso(NOW - 30 * MIN) }),
  ];
  const entries = [entry('r', { thread: 'reported', created: iso(NOW - 20 * MIN) })];
  const { stubs, outstanding } = sortLaunched({ now: NOW, launched, entries, stubbed: { stubbed: 'x' } });
  assert.deepEqual(stubs.map(s => `${s.thread.threadId}:${s.status}`), ['quiet:silent', 'stuck:needs-you']);
  assert.deepEqual(outstanding.map(o => o.threadId), ['just-idle', 'working']);
});

test('an entry from before the launch does not count as its report', () => {
  const launched = [{ threadId: 'x', launchedAt: iso(NOW - 10 * MIN), status: 'busy', settled: false, updatedAt: iso(NOW) }];
  const entries = [entry('old', { thread: 'x', created: iso(NOW - 60 * MIN) })];
  assert.equal(sortLaunched({ now: NOW, launched, entries, stubbed: {} }).outstanding.length, 1);
});

test('summary counts read naturally', () => {
  assert.equal(summarize([entry('a'), entry('b', { status: 'needs-you' }), entry('c', { from: 'mike', status: 'note' })]), '3 new: 1 from Mike, 1 needs you, 1 done');
});

const quietBase = { now: NOW, lastActivity: iso(NOW - 3.5 * 60 * MIN), movedSinceLast: true, anyBusy: false, checkins: [], unhandledCount: 0 };

test('check-in after three quiet hours inside the window', () => {
  const c = decideCheckin(quietBase);
  assert.match(c.text, /Quiet for 3h 30m, nothing running, inbox empty/);
});

test('no check-in while busy, too soon, outside hours, or paused', () => {
  assert.equal(decideCheckin({ ...quietBase, anyBusy: true }), null);
  assert.equal(decideCheckin({ ...quietBase, lastActivity: iso(NOW - 2 * 60 * MIN) }), null);
  const evening = new Date(2026, 9, 8, 19, 0, 0).getTime();
  assert.equal(decideCheckin({ ...quietBase, now: evening, lastActivity: iso(evening - 4 * 60 * MIN) }), null);
  assert.equal(decideCheckin({ ...quietBase, quietUntil: iso(NOW + 60 * MIN) }), null);
});

test('at most two a day, never twice with nothing moving between', () => {
  const one = [iso(NOW - 4 * 60 * MIN)];
  assert.equal(decideCheckin({ ...quietBase, checkins: one, movedSinceLast: false }), null);
  assert.ok(decideCheckin({ ...quietBase, checkins: one, movedSinceLast: true }));
  const two = [iso(NOW - 5 * 60 * MIN), iso(NOW - 4 * 60 * MIN)];
  assert.equal(decideCheckin({ ...quietBase, checkins: two }), null);
  const yesterday = [iso(NOW - 26 * 60 * MIN), iso(NOW - 25 * 60 * MIN)];
  assert.ok(decideCheckin({ ...quietBase, checkins: yesterday }));
});
