#!/usr/bin/env node
/**
 * renders a wonder pill mind map to a standalone html file and prints its path.
 *
 * usage:
 *   node render-map.mjs <data.json> [--out-dir <dir>] [--open]
 *
 * the data file is { topic, nodes, edges } as specified in references/mindmap.md.
 * output lands in <repo-root>/wonder-pill/<slug-of-topic>-<yyyy-mm-dd>.html.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SHELL = join(here, '..', 'assets', 'map-shell.html');

const NODE_TYPES = new Set(['topic', 'branch', 'feral', 'tendril', 'seed', 'scrapped']);
const EDGE_STYLES = new Set(['solid', 'dotted', 'cross']);

const args = process.argv.slice(2);
const dataPath = args.find((a) => !a.startsWith('--'));
const outFlag = args.indexOf('--out-dir');
const shouldOpen = args.includes('--open');

if (!dataPath) {
  console.error('usage: render-map.mjs <data.json> [--out-dir <dir>] [--open]');
  process.exit(2);
}

/** kebab-case slug, trimmed to something that still reads as the topic */
function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 6)
    .join('-') || 'wondering';
}

/** nearest enclosing git repo, falling back to the working directory */
function repoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
}

const data = JSON.parse(readFileSync(dataPath, 'utf8'));
if (!data.topic || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
  console.error('data file needs { topic, nodes: [...], edges: [...] }');
  process.exit(1);
}

const ids = new Set();
const problems = [];
for (const n of data.nodes) {
  if (!Array.isArray(n) || n.length < 6) { problems.push(`node is not a tuple of at least 6 fields: ${JSON.stringify(n)}`); continue; }
  const [id, type, x, y, w, title] = n;
  if (ids.has(id)) problems.push(`duplicate node id: ${id}`);
  ids.add(id);
  if (!NODE_TYPES.has(type)) problems.push(`unknown node type "${type}" on ${id} (use ${[...NODE_TYPES].join(', ')})`);
  if ([x, y, w].some((v) => typeof v !== 'number')) problems.push(`x, y, w must be numbers on ${id}`);
  if (x < 0 || y < 0 || x + w > 2000 || y > 1290) problems.push(`${id} sits outside the 2000x1350 canvas`);
  if (!title) problems.push(`${id} has no title`);
  if (type === 'scrapped' && (!n[6] || !n[7] || !n[8])) problems.push(`scrapped node ${id} needs all three of derivation, flaw, judgment`);
  if ((type === 'branch' || type === 'feral') && !n[6]) problems.push(`${type} node ${id} needs its premise as field 7`);
}
for (const e of data.edges) {
  if (!Array.isArray(e) || e.length < 2) { problems.push(`edge is not a tuple: ${JSON.stringify(e)}`); continue; }
  const [from, to, style] = e;
  if (!ids.has(from)) problems.push(`edge from unknown node: ${from}`);
  if (!ids.has(to)) problems.push(`edge to unknown node: ${to}`);
  if (style && !EDGE_STYLES.has(style)) problems.push(`unknown edge style "${style}" (use ${[...EDGE_STYLES].join(', ')})`);
}

// boxes are laid out by hand, so warn on the failure mode the spec names: clusters colliding.
const HEIGHTS = data.nodes.map((n) => {
  const w = n[4];
  const chars = (String(n[5]).length + String(n[6] ?? '').length);
  const perLine = Math.max(8, Math.floor((w - 20) / 6.4));
  return 22 + Math.ceil(chars / perLine) * 17;
});
const warnings = [];
for (let i = 0; i < data.nodes.length; i++) {
  for (let j = i + 1; j < data.nodes.length; j++) {
    const a = data.nodes[i], b = data.nodes[j];
    const overlapX = a[2] < b[2] + b[4] && b[2] < a[2] + a[4];
    const overlapY = a[3] < b[3] + HEIGHTS[j] && b[3] < a[3] + HEIGHTS[i];
    if (overlapX && overlapY) warnings.push(`nodes ${a[0]} and ${b[0]} probably overlap`);
  }
}

if (problems.length) {
  console.error('map data rejected:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}

const shell = readFileSync(SHELL, 'utf8');
const payload = JSON.stringify({ topic: data.topic, nodes: data.nodes, edges: data.edges }, null, 1);
const summary = `A mind map of ${data.nodes.length} nodes wondering about ${data.topic}: branches invert a named premise, tendrils follow them outward, seeds show where a thought came from, scrapped threads sit detached at the edges. The written wonderings below the map say the same thing linearly.`;

const html = shell
  .replaceAll('__WP_TOPIC__', escapeHtml(data.topic))
  .replaceAll('__WP_TOPIC_H1__', escapeHtml(data.topic))
  .replaceAll('__WP_SR__', escapeHtml(summary))
  .replace('/*__WP_DATA__*/ null', payload);

/** escape for interpolation into html text and attributes */
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const outDir = outFlag >= 0 ? resolve(args[outFlag + 1]) : join(repoRoot(), 'wonder-pill');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const date = new Date().toISOString().slice(0, 10);
const outPath = join(outDir, `${slugify(data.topic)}-${date}.html`);
writeFileSync(outPath, html);

for (const w of warnings) console.error('warning: ' + w);
console.log(outPath);

if (shouldOpen) {
  spawn('xdg-open', [outPath], { detached: true, stdio: 'ignore' }).unref();
}
