#!/usr/bin/env node
/**
 * build — join a run's facts (from gather.mjs) and the agent's judgments into
 * one self-contained page, written into the run folder and to latest.html one
 * level up. That stable address matters: the page keeps the threads he hid in
 * localStorage, which a browser keys by the file's address.
 *
 *   node build.mjs <run folder> [shell-<name>.html]
 *
 * A thread with no judgment lands under "Nothing to do" marked "Not read in
 * this run", so a missed thread shows instead of silently vanishing. A second
 * argument picks another shell for the same data when trying a new look; its
 * page lands at latest-<name>.html.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const run = resolve(process.argv[2] || '.');
const facts = JSON.parse(readFileSync(join(run, 'facts.json'), 'utf8'));
const judgments = JSON.parse(readFileSync(join(run, 'judgments.json'), 'utf8')).threads || {};

const threads = facts.threads.map(t => {
  const j = judgments[t.threadId];
  const running = ['running', 'starting', 'queued', 'preparing'].includes(t.status);
  return {
    threadId: t.threadId,
    link: t.link,
    title: t.title,
    sidebarIndex: t.sidebarIndex,
    lastActivity: t.lastActivity,
    kind: j?.kind || (running ? 'running' : 'none'),
    about: j?.about || '',
    you: j ? j.you || '' : 'Not read in this run.',
    happened: j?.happened || '',
    context: j?.context || '',
    links: j?.links || [],
  };
});

// `</` inside the JSON would close the script tag early
const json = JSON.stringify({ generatedAt: facts.generatedAt, threads }).replace(/<\//g, '<\\/');
const shell = process.argv[3] || 'shell.html';
const variant = shell.replace(/^shell-?/, '').replace(/\.html$/, '');
const html = readFileSync(join(here, shell), 'utf8').replace('/*DATA*/', () => json);
const page = variant ? `latest-${variant}.html` : 'latest.html';
writeFileSync(join(run, variant ? `index-${variant}.html` : 'index.html'), html);
writeFileSync(join(run, '..', page), html);
console.log(resolve(run, '..', page));
