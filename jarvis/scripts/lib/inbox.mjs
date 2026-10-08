/**
 * inbox — Jarvis's inbox: one markdown file per entry in `~/.jarvis/inbox/`.
 *
 * One file per entry is the whole concurrency story: a writer creates a temp
 * file and renames it into place, so two jobs posting at once never touch the
 * same bytes, and Mike can open the folder in an editor. Nothing rewrites an
 * entry after it lands. "Jarvis has dealt with this" is a separate empty marker
 * file in `handled/`, so reading an entry and resolving it stay two acts.
 */

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const STATUSES = ['done', 'blocked', 'failed', 'needs-you', 'note', 'silent'];
export const AUTHORS = ['mike', 'jarvis', 'job', 'service'];
const FIELDS = ['id', 'created', 'from', 'status', 'priority', 'thread', 'title', 'reconstructed'];

/** the data root; JARVIS_HOME lets tests and a second install use their own. */
export function jarvisHome() {
  return process.env.JARVIS_HOME || join(homedir(), '.jarvis');
}

/** create the folders an install needs and return their paths. */
export function dirs() {
  const root = jarvisHome();
  const out = { root, inbox: join(root, 'inbox'), handled: join(root, 'handled'), tmp: join(root, 'tmp') };
  for (const dir of Object.values(out)) mkdirSync(dir, { recursive: true });
  return out;
}

/** write a file atomically: temp name in the same filesystem, then rename. */
export function writeAtomic(path, text) {
  const { tmp } = dirs();
  const scratch = join(tmp, `${process.pid}-${randomBytes(4).toString('hex')}`);
  writeFileSync(scratch, text);
  renameSync(scratch, path);
}

/** a sortable local-free timestamp for file names: 20261008-184501. */
function stamp(iso) {
  return iso.replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

/** a short id; ids only need to be unique within one person's inbox. */
export function newId() {
  return randomBytes(3).toString('hex');
}

/**
 * serialize an entry as front matter plus body. Values are single-line; a
 * newline in one would end the field, so it is flattened to a space.
 */
export function formatEntry(entry) {
  const head = FIELDS
    .filter(key => entry[key] !== undefined && entry[key] !== '' && entry[key] !== false)
    .map(key => `${key}: ${String(entry[key]).replace(/\s*\n\s*/g, ' ')}`);
  return `---\n${head.join('\n')}\n---\n${(entry.body || '').trim()}\n`;
}

/** parse what formatEntry wrote; tolerant of hand-written files from Mike. */
export function parseEntry(text, fallbackId = '') {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const entry = { body: (match ? match[2] : text).trim() };
  if (match) {
    for (const line of match[1].split('\n')) {
      const at = line.indexOf(':');
      if (at > 0) entry[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
  }
  entry.id ||= fallbackId;
  // a file Mike drops in by hand has no `from`; anything without one is his
  entry.from ||= 'mike';
  entry.status ||= 'note';
  entry.priority ||= 'normal';
  entry.reconstructed = entry.reconstructed === 'true';
  return entry;
}

/**
 * add an entry and return it with its id and file name.
 *
 * A caller-supplied id makes a retry idempotent: posting the same id twice
 * keeps the first and returns it.
 *
 * @param {{ from: string, status: string, body: string, priority?: string,
 *   thread?: string, title?: string, id?: string, reconstructed?: boolean,
 *   created?: string }} input
 */
export function post(input) {
  if (!AUTHORS.includes(input.from)) throw new Error(`from must be one of ${AUTHORS.join(', ')}`);
  if (!STATUSES.includes(input.status)) throw new Error(`status must be one of ${STATUSES.join(', ')}`);
  if (!input.body?.trim()) throw new Error('an entry needs a body');
  const priority = input.priority || 'normal';
  if (!['normal', 'now'].includes(priority)) throw new Error('priority is normal or now');
  const id = input.id || newId();
  const existing = list().find(e => e.id === id);
  if (existing) return existing;
  const created = input.created || new Date().toISOString();
  const entry = { ...input, id, created, priority };
  const file = `${stamp(created)}-${id}.md`;
  writeAtomic(join(dirs().inbox, file), formatEntry(entry));
  return { ...parseEntry(formatEntry(entry)), file };
}

/** every entry, oldest first, each with `handled` and its file name. */
export function list() {
  const { inbox, handled } = dirs();
  const done = new Set(readdirSync(handled));
  return readdirSync(inbox)
    .filter(name => name.endsWith('.md'))
    .sort()
    .map(file => {
      const entry = parseEntry(readFileSync(join(inbox, file), 'utf8'), file.replace(/\.md$/, ''));
      // a hand-written file carries no timestamp; when it landed stands in
      entry.created ||= statSync(join(inbox, file)).mtime.toISOString();
      return { ...entry, file, handled: done.has(entry.id) };
    });
}

/** mark entries as dealt with by Jarvis; unknown ids are reported back. */
export function ack(ids) {
  const { handled } = dirs();
  const known = new Set(list().map(e => e.id));
  const missing = [];
  for (const id of ids) {
    if (!known.has(id)) { missing.push(id); continue; }
    const marker = join(handled, id);
    if (!existsSync(marker)) writeFileSync(marker, new Date().toISOString());
  }
  return missing;
}
