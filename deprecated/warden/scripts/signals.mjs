#!/usr/bin/env node

/**
 * collect the small, bounded set of observations that Warden needs for a tick.
 *
 * this module deliberately reports observations and freshness. It does not
 * decide whether the user is on plan or drifting.
 */

import { realpathSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { hostname as systemHostname } from 'node:os';
import { fileURLToPath } from 'node:url';

const DEFAULT_AW_URL = 'http://localhost:5600/api/0';
const DEFAULT_WINDOW_MINUTES = 15;
const DEFAULT_AW_TIMEOUT_MS = 2_000;
const DEFAULT_PEEK_TIMEOUT_MS = 1_500;
const DEFAULT_PEEK_MAX_OUTPUT = 4_000;
const DEFAULT_FRESHNESS_SECONDS = 120;
const MAX_CANDIDATE_BUCKETS = 12;
const MAX_EVENTS = 200;
const MAX_TOP_APPS = 8;
const MAX_TOP_TITLES = 12;
const MAX_LABEL_LENGTH = 160;

export const DEFAULT_PEEK_PATH = fileURLToPath(new URL('../../peek/scripts/peek.mjs', import.meta.url));

/**
 * convert an ActivityWatch timestamp or a Date-like value to milliseconds.
 * activitywatch usually uses ISO strings, while test fixtures often use epoch
 * seconds, so both forms are accepted.
 *
 * @param {unknown} value timestamp value
 * @returns {number|null} timestamp in milliseconds
 */
export function toTimestampMs(value) {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.abs(value) < 1e12 ? value * 1_000 : value;
  }
  if (typeof value === 'string' && value.trim()) {
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : null;
  }
  return null;
}

/**
 * keep a string suitable for compact JSON output.
 *
 * @param {unknown} value arbitrary value
 * @param {number} maxLength maximum number of characters
 * @returns {string} one-line bounded string
 */
export function boundedText(value, maxLength = MAX_LABEL_LENGTH) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function isoTime(ms) {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function errorText(error) {
  return boundedText(error?.message || error || 'unknown error', 240);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function bucketHost(bucket) {
  return bucket?.hostname || bucket?.host || bucket?.machine || bucket?.data?.hostname || null;
}

function bucketType(bucket) {
  return bucket?.type || bucket?.bucketType || bucket?.bucket_type || null;
}

/**
 * classify a bucket using its type first, then its name as a fallback.
 *
 * `aw-watcher-window` and `aw-awatcher` use different ids and client names,
 * but their useful API types are generally `currentwindow`/`window` and
 * `afk`. Looking at the type avoids coupling discovery to one watcher name.
 *
 * @param {Record<string, unknown>} bucket ActivityWatch bucket metadata
 * @returns {{kind: 'window'|'afk'|'unknown', id: string, type: string|null, host: string|null}}
 */
export function classifyBucket(bucket) {
  const id = String(bucket?.id || bucket?.bucket_id || bucket?.name || '');
  const type = bucketType(bucket);
  const typed = [type].filter(Boolean).map(value => String(value).toLowerCase()).join(' ');
  const fallback = [bucket?.client, bucket?.name, id]
    .filter(Boolean)
    .map(value => String(value).toLowerCase())
    .join(' ');

  let kind = 'unknown';
  if (/\bafk\b|idle/.test(typed)) kind = 'afk';
  else if (/currentwindow|window|application|\bapp\b/.test(typed)) kind = 'window';
  else if (/\bafk\b|idle/.test(fallback)) kind = 'afk';
  else if (/currentwindow|window|application|\bapp\b/.test(fallback)) kind = 'window';

  return {
    kind,
    id,
    type: type == null ? null : String(type),
    host: bucketHost(bucket) == null ? null : String(bucketHost(bucket)),
  };
}

function extractBuckets(payload) {
  if (Array.isArray(payload)) return payload.filter(item => item && typeof item === 'object');
  if (Array.isArray(payload?.buckets)) return payload.buckets.filter(item => item && typeof item === 'object');
  if (!payload || typeof payload !== 'object') return [];

  return Object.entries(payload)
    .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
    .map(([key, value]) => ({ id: value.id || key, ...value }));
}

function extractEvents(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.events)) return payload.events;
  return [];
}

function eventStartMs(event) {
  return toTimestampMs(event?.timestamp ?? event?.time ?? event?.start);
}

function eventDurationSeconds(event) {
  const duration = Number(event?.duration ?? event?.data?.duration ?? 0);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function eventEndMs(event) {
  const start = eventStartMs(event);
  return start == null ? null : start + eventDurationSeconds(event) * 1_000;
}

/**
 * clip events to the requested lookback interval.
 *
 * @param {unknown[]} events ActivityWatch events
 * @param {{fromMs: number, toMs: number}} range clipping range
 * @returns {Array<{event: object, startMs: number, endMs: number, durationSeconds: number}>} clipped events
 */
export function clipEvents(events, { fromMs, toMs }) {
  if (!Array.isArray(events)) return [];
  const clipped = [];
  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    const start = eventStartMs(event);
    const end = eventEndMs(event);
    if (start == null || end == null || end <= fromMs || start >= toMs) continue;
    const overlapStart = Math.max(start, fromMs);
    const overlapEnd = Math.min(end, toMs);
    if (overlapEnd <= overlapStart) continue;
    clipped.push({
      event,
      startMs: overlapStart,
      endMs: overlapEnd,
      durationSeconds: (overlapEnd - overlapStart) / 1_000,
    });
  }
  return clipped;
}

function eventData(event) {
  return event?.data && typeof event.data === 'object' ? event.data : {};
}

function eventApp(event) {
  const data = eventData(event);
  return boundedText(data.app ?? data.application ?? data.process ?? data.app_name ?? '(unknown)');
}

function eventTitle(event) {
  const data = eventData(event);
  return boundedText(data.title ?? data.window_title ?? data.name ?? '(untitled)');
}

function rankedDurations(values, labelKey, limit) {
  return [...values.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, durationSeconds]) => ({
      [labelKey]: label,
      durationSeconds: Math.round(durationSeconds * 10) / 10,
    }));
}

/**
 * aggregate window activity into bounded app and title lists.
 *
 * @param {Array<{event: object, durationSeconds: number}>} clippedEvents clipped events
 * @returns {{totalDurationSeconds: number, apps: object[], titles: object[], eventCount: number}}
 */
export function aggregateWindowEvents(clippedEvents) {
  const apps = new Map();
  const titles = new Map();
  let totalDurationSeconds = 0;

  for (const item of clippedEvents || []) {
    const duration = Number(item.durationSeconds);
    if (!Number.isFinite(duration) || duration <= 0) continue;
    totalDurationSeconds += duration;
    apps.set(eventApp(item.event), (apps.get(eventApp(item.event)) || 0) + duration);
    titles.set(eventTitle(item.event), (titles.get(eventTitle(item.event)) || 0) + duration);
  }

  return {
    totalDurationSeconds: Math.round(totalDurationSeconds * 10) / 10,
    apps: rankedDurations(apps, 'app', MAX_TOP_APPS),
    titles: rankedDurations(titles, 'title', MAX_TOP_TITLES),
    eventCount: clippedEvents?.length || 0,
  };
}

function latestEvent(events) {
  let latest = null;
  let latestAt = null;
  let latestStartAt = null;
  for (const event of events || []) {
    const end = eventEndMs(event);
    const start = eventStartMs(event);
    const at = end ?? start;
    if (at == null || (latestAt != null && at <= latestAt)) continue;
    latest = event;
    latestAt = at;
    latestStartAt = start;
  }
  return { event: latest, latestAt, latestStartAt };
}

function afkState(event) {
  const data = eventData(event);
  const value = data.status ?? data.state ?? data.afk;
  if (typeof value === 'boolean') return value ? 'afk' : 'not-afk';
  if (value == null) return 'unknown';
  const state = String(value).toLowerCase().replace(/_/g, '-');
  if (state === 'afk' || state === 'idle') return 'afk';
  if (state === 'not-afk' || state === 'notafk' || state === 'active') return 'not-afk';
  return 'unknown';
}

function normalizeHost(value) {
  return value == null ? null : String(value).trim().toLowerCase();
}

function hostScore(candidateHost, expectedHost) {
  if (!expectedHost || !candidateHost) return 1;
  return normalizeHost(candidateHost) === normalizeHost(expectedHost) ? 2 : 0;
}

function candidateLatestAt(candidate) {
  return latestEvent(candidate.events).latestAt;
}

function chooseCandidate(candidates, fromMs, nowMs, expectedHost) {
  const usable = candidates.filter(candidate => !candidate.error);
  if (!usable.length) return null;

  const recent = usable.filter(candidate => {
    const latest = latestEvent(candidate.events);
    return latest.latestAt != null
      && latest.latestStartAt != null
      && latest.latestStartAt <= nowMs
      && latest.latestAt >= fromMs;
  });
  const pool = recent.length ? recent : usable;
  return [...pool].sort((a, b) => {
    const score = hostScore(b.host, expectedHost) - hostScore(a.host, expectedHost);
    if (score) return score;
    return (candidateLatestAt(b) || 0) - (candidateLatestAt(a) || 0);
  })[0];
}

function freshness(latestAt, latestStartAt, nowMs, fromMs, freshnessSeconds) {
  if (latestAt == null) return { status: 'stale', latestAt: null, ageSeconds: null };
  const current = latestStartAt != null && latestStartAt <= nowMs;
  const effectiveAt = current ? Math.min(latestAt, nowMs) : latestAt;
  const ageSeconds = Math.round((nowMs - effectiveAt) / 1_000 * 10) / 10;
  return {
    status: current && effectiveAt >= fromMs && ageSeconds <= freshnessSeconds ? 'fresh' : 'stale',
    latestAt: isoTime(effectiveAt),
    ageSeconds,
  };
}

function unavailableSignal(reason) {
  return { status: 'unavailable', reason: boundedText(reason, 240), bucketId: null, latestAt: null };
}

async function fetchJson(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const request = Promise.resolve().then(() => fetchImpl(url, { signal: controller.signal }));
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    const response = await Promise.race([request, timeout]);
    if (response == null) throw new Error('empty response');
    if (typeof response.json === 'function') {
      if (response.ok === false) throw new Error(`HTTP ${response.status || 'error'}`);
      return await response.json();
    }
    if (typeof response === 'string') return JSON.parse(response);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function readBucketEvents({ fetchImpl, awUrl, bucket, awTimeoutMs }) {
  const path = `/buckets/${encodeURIComponent(bucket.id)}/events?limit=${MAX_EVENTS}`;
  const payload = await fetchJson(fetchImpl, `${awUrl}${path}`, awTimeoutMs);
  return extractEvents(payload).slice(-MAX_EVENTS);
}

function makeSignal(bucket, events, nowMs, fromMs, expectedHost, kind, freshnessSeconds) {
  const latest = latestEvent(events);
  const clipped = clipEvents(events, { fromMs, toMs: nowMs });
  const freshnessInfo = freshness(latest.latestAt, latest.latestStartAt, nowMs, fromMs, freshnessSeconds);
  const base = {
    status: freshnessInfo.status,
    bucketId: bucket.id,
    bucketType: bucket.type,
    host: bucket.host,
    latestAt: freshnessInfo.latestAt,
    ageSeconds: freshnessInfo.ageSeconds,
    hostMatch: hostScore(bucket.host, expectedHost) === 2,
  };

  if (kind === 'window') {
    const aggregate = aggregateWindowEvents(clipped);
    return { ...base, ...aggregate, events: undefined };
  }

  const state = latest.event ? afkState(latest.event) : 'unknown';
  return {
    ...base,
    state: freshnessInfo.status === 'fresh' ? state : 'unknown',
    observedState: state,
  };
}

function cleanUndefined(value) {
  if (Array.isArray(value)) return value.map(cleanUndefined);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, cleanUndefined(item)]));
}

/**
 * run a command with both a time and output bound.
 *
 * @param {string} command executable
 * @param {string[]} args executable arguments
 * @param {{timeoutMs?: number, maxOutput?: number}} options limits
 * @returns {Promise<{stdout: string, stderr: string, code: number|null, signal: string|null, timedOut: boolean}>} result
 */
export function runProcess(command, args, { timeoutMs = DEFAULT_PEEK_TIMEOUT_MS, maxOutput = DEFAULT_PEEK_MAX_OUTPUT } = {}) {
  return new Promise(resolve => {
    let child;
    let stdout = '';
    let stderr = '';
    let total = 0;
    let timedOut = false;
    let finished = false;
    let killTimer;
    const finish = (result = {}) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutTimer);
      clearTimeout(killTimer);
      resolve({ stdout, stderr, code: null, signal: null, timedOut, ...result });
    };
    const append = (target, chunk) => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      const remaining = Math.max(0, maxOutput - total);
      const clipped = text.slice(0, remaining);
      total += clipped.length;
      if (target === 'stdout') stdout += clipped;
      else stderr += clipped;
    };

    try {
      child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout?.on('data', chunk => append('stdout', chunk));
      child.stderr?.on('data', chunk => append('stderr', chunk));
      child.once('error', error => finish({ error: errorText(error) }));
      child.once('close', (code, signal) => finish({ code, signal }));
      var timeoutTimer = setTimeout(() => {
        timedOut = true;
        try { child.kill('SIGTERM'); } catch { /* process already exited */ }
        killTimer = setTimeout(() => finish({ code: null, signal: 'SIGTERM' }), 100);
      }, timeoutMs);
    } catch (error) {
      finish({ error: errorText(error) });
    }
  });
}

/**
 * reduce `peek live` output to a short, line-oriented active-session summary.
 *
 * @param {unknown} output raw command output
 * @param {number} maxOutput maximum output characters
 * @returns {{summary: string, truncated: boolean}} bounded summary
 */
export function summarizePeekOutput(output, maxOutput = DEFAULT_PEEK_MAX_OUTPUT) {
  const raw = String(output ?? '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
  const lines = raw.split(/\r?\n/).map(line => boundedText(line, 320)).filter(Boolean);
  const summary = boundedText(lines.join('\n'), maxOutput);
  return { summary, truncated: summary.length < raw.trim().length };
}

async function collectPeek({ enabled, peekPath, processRunner, timeoutMs, maxOutput }) {
  if (!enabled) return { status: 'disabled' };
  try {
    const result = await processRunner('node', [peekPath, 'live'], { timeoutMs, maxOutput });
    if (typeof result === 'string') return { status: 'ok', ...summarizePeekOutput(result, maxOutput) };
    if (result?.timedOut) return { status: 'timeout', reason: `peek timed out after ${timeoutMs}ms` };
    if (result?.error) return { status: 'unavailable', reason: boundedText(result.error, 240) };
    if (result?.code != null && result.code !== 0) {
      return { status: 'unavailable', reason: boundedText(result.stderr || `peek exited with code ${result.code}`, 240) };
    }
    const summary = summarizePeekOutput(result?.stdout ?? result?.output ?? '', maxOutput);
    return { status: 'ok', ...summary };
  } catch (error) {
    return { status: 'unavailable', reason: errorText(error) };
  }
}

function overallAwStatus(windowSignal, afkSignal) {
  const statuses = [windowSignal.status, afkSignal.status];
  if (statuses.every(status => status === 'fresh')) return 'ok';
  if (statuses.some(status => status === 'fresh')) return 'partial';
  if (statuses.some(status => status === 'stale')) return 'stale';
  return 'unavailable';
}

/**
 * collect bounded ActivityWatch and optional peek evidence for one Warden tick.
 *
 * @param {object} options collector options
 * @param {Date|string|number} [options.now] fixed observation time
 * @param {number} [options.windowMinutes=15] lookback interval
 * @param {string} [options.awUrl] ActivityWatch API base URL
 * @param {string} [options.hostname] expected local bucket hostname
 * @param {boolean} [options.noPeek=false] disable peek subprocess
 * @param {string} [options.peekPath] path to sibling peek script
 * @param {Function} [options.fetchImpl] injected fetch implementation
 * @param {Function} [options.processRunner] injected process runner
 * @returns {Promise<object>} bounded evidence object
 */
export async function collectSignals({
  now = Date.now(),
  windowMinutes = DEFAULT_WINDOW_MINUTES,
  awUrl = DEFAULT_AW_URL,
  hostname = systemHostname(),
  noPeek = false,
  peekPath = DEFAULT_PEEK_PATH,
  fetch: fetchOption,
  fetchImpl = fetchOption ?? globalThis.fetch,
  processRunner = runProcess,
  awTimeoutMs = DEFAULT_AW_TIMEOUT_MS,
  freshnessSeconds = DEFAULT_FRESHNESS_SECONDS,
  peekTimeoutMs = DEFAULT_PEEK_TIMEOUT_MS,
  maxPeekOutput = DEFAULT_PEEK_MAX_OUTPUT,
} = {}) {
  const nowMs = toTimestampMs(now) ?? Date.now();
  const minutes = positiveNumber(windowMinutes, DEFAULT_WINDOW_MINUTES);
  const freshnessWindowSeconds = positiveNumber(freshnessSeconds, DEFAULT_FRESHNESS_SECONDS);
  const fromMs = nowMs - minutes * 60_000;
  const baseUrl = String(awUrl || DEFAULT_AW_URL).replace(/\/+$/, '');
  const result = {
    observedAt: isoTime(nowMs),
    lookback: { from: isoTime(fromMs), to: isoTime(nowMs), minutes },
    activityWatch: {
      status: 'unavailable',
      url: baseUrl,
      window: unavailableSignal('ActivityWatch unavailable'),
      afk: unavailableSignal('ActivityWatch unavailable'),
    },
    peek: await collectPeek({
      enabled: !noPeek,
      peekPath,
      processRunner,
      timeoutMs: peekTimeoutMs,
      maxOutput: maxPeekOutput,
    }),
  };

  if (typeof fetchImpl !== 'function') {
    result.activityWatch.reason = 'fetch is unavailable';
    return cleanUndefined(result);
  }

  let buckets;
  try {
    buckets = extractBuckets(await fetchJson(fetchImpl, `${baseUrl}/buckets/`, awTimeoutMs));
  } catch (error) {
    result.activityWatch.reason = errorText(error);
    return cleanUndefined(result);
  }

  const candidates = buckets
    .map(bucket => ({ bucket, ...classifyBucket(bucket) }))
    .filter(candidate => candidate.id && (candidate.kind === 'window' || candidate.kind === 'afk'))
    .sort((a, b) => hostScore(b.host, hostname) - hostScore(a.host, hostname))
    .slice(0, MAX_CANDIDATE_BUCKETS);

  const loaded = await Promise.all(candidates.map(async candidate => {
    try {
      const events = await readBucketEvents({ fetchImpl, awUrl: baseUrl, bucket: candidate, awTimeoutMs });
      return { ...candidate, events, error: null };
    } catch (error) {
      return { ...candidate, events: [], error: errorText(error) };
    }
  }));

  const windowCandidates = loaded.filter(candidate => candidate.kind === 'window');
  const afkCandidates = loaded.filter(candidate => candidate.kind === 'afk');
  const selectedWindow = chooseCandidate(windowCandidates, fromMs, nowMs, hostname);
  const selectedAfk = chooseCandidate(afkCandidates, fromMs, nowMs, hostname);

  if (selectedWindow) {
    result.activityWatch.window = makeSignal(selectedWindow, selectedWindow.events, nowMs, fromMs, hostname, 'window', freshnessWindowSeconds);
  } else if (windowCandidates.length && windowCandidates.every(candidate => candidate.error)) {
    result.activityWatch.window = unavailableSignal(windowCandidates[0].error);
  } else {
    result.activityWatch.window = unavailableSignal('no window bucket found');
  }

  if (selectedAfk) {
    result.activityWatch.afk = makeSignal(selectedAfk, selectedAfk.events, nowMs, fromMs, hostname, 'afk', freshnessWindowSeconds);
  } else if (afkCandidates.length && afkCandidates.every(candidate => candidate.error)) {
    result.activityWatch.afk = unavailableSignal(afkCandidates[0].error);
  } else {
    result.activityWatch.afk = unavailableSignal('no AFK bucket found');
  }

  result.activityWatch.status = overallAwStatus(result.activityWatch.window, result.activityWatch.afk);
  return cleanUndefined(result);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--no-peek') options.noPeek = true;
    else if (arg === '--aw-url') options.awUrl = argv[++index];
    else if (arg === '--window-minutes') options.windowMinutes = Number(argv[++index]);
    else if (arg === '--peek-path') options.peekPath = argv[++index];
    else if (arg === '--now') options.now = argv[++index];
    else if (arg === '--peek-timeout-ms') options.peekTimeoutMs = Number(argv[++index]);
    else if (arg === '--help') options.help = true;
  }
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write('usage: signals.mjs [--aw-url URL] [--window-minutes N] [--no-peek] [--peek-path PATH]\n');
    return;
  }
  const result = await collectSignals(options);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  main().catch(error => {
    process.stdout.write(`${JSON.stringify({ error: errorText(error) })}\n`);
    process.exitCode = 1;
  });
}
