import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateWindowEvents,
  clipEvents,
  classifyBucket,
  collectSignals,
} from './signals.mjs';

const NOW = Date.parse('2026-09-15T12:00:00.000Z');

function fakeAw({ buckets, events = {}, fail = false }) {
  return async url => {
    if (fail) throw new Error('ActivityWatch is down');
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/buckets/')) {
      return { ok: true, json: async () => buckets };
    }
    const match = parsed.pathname.match(/\/buckets\/([^/]+)\/events$/);
    if (!match) throw new Error(`unexpected URL: ${url}`);
    return { ok: true, json: async () => events[decodeURIComponent(match[1])] || [] };
  };
}

function event(timestamp, duration, data) {
  return { timestamp, duration, data };
}

test('clips overlapping events to the lookback and now, then aggregates bounded durations', () => {
  const clipped = clipEvents([
    event('2026-09-15T11:40:00Z', 600, { app: 'editor', title: 'first' }),
    event('2026-09-15T11:49:00Z', 600, { app: 'editor', title: 'second' }),
    event('2026-09-15T11:59:30Z', 120, { app: 'browser', title: 'late' }),
    event('2026-09-15T11:00:00Z', 60, { app: 'old', title: 'outside' }),
  ], { fromMs: NOW - 15 * 60_000, toMs: NOW });

  assert.deepEqual(clipped.map(item => item.durationSeconds), [300, 600, 30]);
  assert.deepEqual(aggregateWindowEvents(clipped), {
    totalDurationSeconds: 930,
    apps: [
      { app: 'editor', durationSeconds: 900 },
      { app: 'browser', durationSeconds: 30 },
    ],
    titles: [
      { title: 'second', durationSeconds: 600 },
      { title: 'first', durationSeconds: 300 },
      { title: 'late', durationSeconds: 30 },
    ],
    eventCount: 3,
  });
});
test('discovers aw-awatcher by bucket type and prefers a recent bucket over a stale one', async () => {
  assert.equal(classifyBucket({ id: 'aw-awatcher_window_box', type: 'currentwindow' }).kind, 'window');
  assert.equal(classifyBucket({ id: 'aw-awatcher_afk_box', type: 'afk' }).kind, 'afk');

  const buckets = [
    { id: 'old-window', type: 'currentwindow', hostname: 'workstation' },
    { id: 'fresh-window', type: 'currentwindow', hostname: 'other-host' },
  ];
  const result = await collectSignals({
    now: NOW,
    hostname: 'workstation',
    noPeek: true,
    fetchImpl: fakeAw({
      buckets,
      events: {
        'old-window': [event('2026-09-15T10:00:00Z', 30, { app: 'stale' })],
        'fresh-window': [event('2026-09-15T11:58:00Z', 120, { app: 'fresh', title: 'T3' })],
      },
    }),
  });

  assert.equal(result.activityWatch.window.bucketId, 'fresh-window');
  assert.equal(result.activityWatch.window.status, 'fresh');
  assert.deepEqual(result.activityWatch.window.apps, [{ app: 'fresh', durationSeconds: 120 }]);
});

test('reports stale AFK state without presenting it as current', async () => {
  const result = await collectSignals({
    now: NOW,
    hostname: 'workstation',
    noPeek: true,
    fetchImpl: fakeAw({
      buckets: [
        { id: 'window', type: 'currentwindow', hostname: 'workstation' },
        { id: 'afk', type: 'afk', hostname: 'workstation' },
      ],
      events: {
        window: [event('2026-09-15T11:58:00Z', 60, { app: 'editor' })],
        afk: [event('2026-09-15T11:00:00Z', 0, { status: 'afk' })],
      },
    }),
  });

  assert.equal(result.activityWatch.window.status, 'fresh');
  assert.equal(result.activityWatch.afk.status, 'stale');
  assert.equal(result.activityWatch.afk.observedState, 'afk');
  assert.equal(result.activityWatch.afk.state, 'unknown');
  assert.equal(result.activityWatch.status, 'partial');
});

test('separates lookback coverage from freshness', async () => {
  const result = await collectSignals({
    now: NOW,
    hostname: 'workstation',
    noPeek: true,
    fetchImpl: fakeAw({
      buckets: [
        { id: 'window', type: 'currentwindow', hostname: 'workstation' },
        { id: 'afk', type: 'afk', hostname: 'workstation' },
      ],
      events: {
        window: [event('2026-09-15T11:50:00Z', 30, { app: 'editor', title: 'old observation' })],
        afk: [event('2026-09-15T11:50:00Z', 0, { status: 'afk' })],
      },
    }),
  });

  assert.equal(result.activityWatch.window.status, 'stale');
  assert.deepEqual(result.activityWatch.window.apps, [{ app: 'editor', durationSeconds: 30 }]);
  assert.equal(result.activityWatch.afk.status, 'stale');
  assert.equal(result.activityWatch.afk.state, 'unknown');
  assert.equal(result.activityWatch.afk.observedState, 'afk');
  assert.equal(result.activityWatch.status, 'stale');
});

test('reports missing ActivityWatch honestly and bounds a timed out peek', async () => {
  const result = await collectSignals({
    now: NOW,
    awUrl: 'http://test.invalid/api/0',
    processRunner: async () => ({ timedOut: true }),
    fetchImpl: fakeAw({ buckets: [], fail: true }),
  });

  assert.equal(result.activityWatch.status, 'unavailable');
  assert.match(result.activityWatch.reason, /down/);
  assert.deepEqual(result.peek, { status: 'timeout', reason: 'peek timed out after 1500ms' });
});

test('keeps a successful peek as a short summary and can disable it', async () => {
  const calls = [];
  const processRunner = async (command, args, options) => {
    calls.push({ command, args, options });
    return { stdout: `${'cc t3 active\n'.repeat(100)}tail`, code: 0 };
  };
  const result = await collectSignals({
    now: NOW,
    noPeek: false,
    maxPeekOutput: 80,
    processRunner,
    fetchImpl: fakeAw({ buckets: [] }),
  });

  assert.equal(calls[0].command, 'node');
  assert.deepEqual(calls[0].args.slice(1), ['live']);
  assert.equal(result.peek.status, 'ok');
  assert.ok(result.peek.summary.length <= 80);
  assert.equal(result.peek.truncated, true);

  const disabled = await collectSignals({
    now: NOW,
    noPeek: true,
    processRunner: async () => { throw new Error('must not run'); },
    fetchImpl: fakeAw({ buckets: [] }),
  });
  assert.deepEqual(disabled.peek, { status: 'disabled' });
});
