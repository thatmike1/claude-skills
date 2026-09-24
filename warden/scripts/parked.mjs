#!/usr/bin/env node

/**
 * read the user's parked list and write the two fields Warden may touch on it.
 *
 * the list belongs to the overlay HUD: one JSON object per line with the user's
 * own words in `text`. Warden never edits that file itself. It may add a tidy
 * title and a bead id, and only through the HUD's own `--parked-set`, which
 * takes the file's lock. Whether Warden has already offered a bead for an item
 * is Warden's own state, kept beside its day state, so it never asks twice.
 */

import { realpathSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const defaultConfig = fileURLToPath(new URL('../config.json', import.meta.url));
const DEFAULT_LIST = '~/.local/share/overlay-hud/parked.jsonl';
const DEFAULT_OFFERED = '~/.local/state/warden/parked-offered.json';
const MAX_TIDY = 120;

/** expand a leading home-directory marker in a configured path. */
function expandHome(path) {
  return String(path).replace(/^~(?=\/|$)/, homedir());
}

/**
 * resolve where the list, the HUD's writer and the offered record live.
 *
 * @param {string} configPath warden's config.json
 * @returns {Promise<{listPath: string, cli: string|null, offeredPath: string}>}
 */
export async function loadParkedConfig(configPath = defaultConfig) {
  let config = {};
  try { config = JSON.parse(await readFile(configPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return {
    listPath: expandHome(config.parkedList || DEFAULT_LIST),
    cli: config.parkedCli ? expandHome(config.parkedCli) : null,
    offeredPath: expandHome(config.parkedOffered || DEFAULT_OFFERED),
  };
}

/**
 * the open items on the list, oldest first. a missing file is an empty list;
 * lines that do not parse are skipped, as the HUD skips them.
 *
 * @param {string} listPath the parked.jsonl file
 * @returns {Promise<Array<{id: string, text: string, tidy: string|null, bead: string|null, created: string|null}>>}
 */
export async function readOpenItems(listPath) {
  let text = '';
  try { text = await readFile(listPath, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const items = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let item;
    try { item = JSON.parse(line); } catch { continue; }
    if (!item || typeof item.id !== 'string' || typeof item.text !== 'string' || item.done) continue;
    items.push({
      id: item.id,
      text: item.text,
      tidy: typeof item.tidy === 'string' && item.tidy ? item.tidy : null,
      bead: typeof item.bead === 'string' && item.bead ? item.bead : null,
      created: typeof item.created === 'string' ? item.created : null,
    });
  }
  return items;
}

async function readOffered(offeredPath) {
  try {
    const data = JSON.parse(await readFile(offeredPath, 'utf8'));
    return data && typeof data.offered === 'object' && data.offered ? data.offered : {};
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return {};
    throw error;
  }
}

/**
 * the open items with what Warden still owes each one: a tidy title when it has
 * none, and one bead offer when it has no bead and was never offered one.
 *
 * @param {{listPath: string, offeredPath: string, cli: string|null}} config
 */
export async function listParked(config) {
  const [items, offered] = await Promise.all([readOpenItems(config.listPath), readOffered(config.offeredPath)]);
  return {
    canWrite: Boolean(config.cli),
    items: items.map(item => ({
      ...item,
      offered: Boolean(offered[item.id]),
      needsTidy: !item.tidy,
      mayOfferBead: !item.bead && !offered[item.id],
    })),
  };
}

/**
 * remember that a bead was offered for these items, whatever the answer was,
 * so the offer is never repeated. an item offered once stays offered.
 *
 * @param {string} offeredPath warden's record
 * @param {string[]} ids parked item ids
 * @param {() => Date} now clock, for tests
 */
export async function recordOffered(offeredPath, ids, now = () => new Date()) {
  if (!ids.length || ids.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}$/.test(id))) {
    throw new Error('Pass one or more parked item ids (8 hex digits).');
  }
  const offered = await readOffered(offeredPath);
  const at = now().toISOString();
  for (const id of ids) offered[id] ??= at;
  await mkdir(dirname(offeredPath), { recursive: true });
  const tmp = join(dirname(offeredPath), `.parked-offered.${process.pid}.tmp`);
  await writeFile(tmp, `${JSON.stringify({ offered }, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, offeredPath);
  return { recorded: ids.length };
}

/**
 * set an item's tidy title or bead id through the HUD, which holds the lock.
 *
 * @param {{cli: string|null}} config
 * @param {string} id parked item id
 * @param {'tidy'|'bead'} field
 * @param {string} value
 */
export async function setParkedField(config, id, field, value, runner = execute) {
  if (!config.cli) throw new Error('parkedCli is not configured, so Warden cannot write to the parked list.');
  if (field !== 'tidy' && field !== 'bead') throw new Error('Only tidy and bead can be set.');
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (field === 'tidy' && (!clean || clean.length > MAX_TIDY)) throw new Error(`A tidy title is 1 to ${MAX_TIDY} characters.`);
  if (field === 'bead' && !/^[\w.-]+$/.test(clean)) throw new Error('A bead id is letters, digits, dots and dashes.');
  try {
    await runner(config.cli, ['--parked-set', id, field, clean], { timeout: 5000, maxBuffer: 8192 });
  } catch (error) {
    if (error.code === 1) throw new Error(`No parked item with id ${id}; the user may have cleared it.`);
    throw new Error(`The HUD refused the write: ${String(error.stderr || error.message).trim()}`);
  }
  return { id, field, value: clean };
}

const USAGE = `Usage:
  node parked.mjs list                 open items, with needsTidy and mayOfferBead
  node parked.mjs tidy <id> "<title>"  write a tidy title under the user's words
  node parked.mjs bead <id> <bead-id>  link the bead filed for an item
  node parked.mjs offered <id>...      record that a bead was offered; never offer again`;

export async function main(argv = process.argv.slice(2), { configPath = defaultConfig, runner = execute } = {}) {
  const [command, ...rest] = argv;
  if (!command || command === '--help') return { usage: USAGE };
  const config = await loadParkedConfig(configPath);
  if (command === 'list') return listParked(config);
  if (command === 'tidy' && rest.length === 2) return setParkedField(config, rest[0], 'tidy', rest[1], runner);
  if (command === 'bead' && rest.length === 2) return setParkedField(config, rest[0], 'bead', rest[1], runner);
  if (command === 'offered' && rest.length) return recordOffered(config.offeredPath, rest);
  throw new Error(USAGE);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await main();
    console.log(result.usage ?? JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
