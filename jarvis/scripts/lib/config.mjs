/**
 * config — Jarvis's settings and the service's memory, each with one writer.
 *
 * `config.json` is written only by the CLI (bind, quiet) and read by the service
 * on every tick, so a change lands without a restart. `service.json` is written
 * only by the service. Neither is ever written by both.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DEFAULTS } from './decide.mjs';
import { dirs, writeAtomic } from './inbox.mjs';

export const DEFAULT_PORT = 1355;

// Warden's credential for T3's API on this machine; Jarvis reuses it by path
const WARDEN_TOKEN = join(homedir(), '.local', 'state', 'warden', 't3-token');

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

/** settings with defaults filled in. */
export function loadConfig() {
  const raw = readJson(join(dirs().root, 'config.json'), {});
  return {
    port: DEFAULT_PORT,
    tokenFile: existsSync(WARDEN_TOKEN) ? WARDEN_TOKEN : '',
    deadlineMinutes: DEFAULTS.deadlineMinutes,
    silentMinutes: DEFAULTS.silentMinutes,
    ...raw,
    checkins: { ...DEFAULTS.checkins, ...(raw.checkins || {}) },
  };
}

/** merge a change into config.json; CLI only. */
export function saveConfig(change) {
  const path = join(dirs().root, 'config.json');
  writeAtomic(path, `${JSON.stringify({ ...readJson(path, {}), ...change }, null, 2)}\n`);
}

/** the service's own memory: stubs written, the last wake, check-ins sent. */
export function loadServiceState() {
  return {
    stubbed: {},
    lastWakeIds: [],
    wakes: [],
    checkins: [],
    ...readJson(join(dirs().root, 'service.json'), {}),
  };
}

/** persist the service's memory; service only. Keeps the logs short. */
export function saveServiceState(state) {
  const trimmed = { ...state, wakes: state.wakes.slice(-50), checkins: state.checkins.slice(-20) };
  writeAtomic(join(dirs().root, 'service.json'), `${JSON.stringify(trimmed, null, 2)}\n`);
}
