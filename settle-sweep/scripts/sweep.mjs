#!/usr/bin/env node
/**
 * sweep — every open T3 thread with its last words, one block each, for the
 * settle-sweep skill to judge. Reads T3's database read-only.
 */

import { t3OpenThreads } from '../../shared/t3-state.mjs';
import { lastWords, threadForSession, threadLink } from './lib/t3.mjs';

function duration(ms) {
  const minutes = Math.floor(ms / 60_000);
  const h = Math.floor(minutes / 60);
  return h ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}

/** the T3 thread the calling agent runs in, when the harness says so. */
function ownThread() {
  const nativeId = process.env.CLAUDE_CODE_SESSION_ID || process.env.CODEX_THREAD_ID;
  return nativeId ? threadForSession(nativeId) : null;
}

const self = ownThread();
const threads = t3OpenThreads().filter(t => t.threadId !== self);
if (!threads.length) {
  console.log('no open threads: everything is settled');
  process.exit(0);
}
console.log(`# ${threads.length} open threads, newest first. Judge each: settle / needs you: <why> / running.\n`);
threads.forEach((t, i) => {
  const words = lastWords(t.threadId, 400);
  const quiet = duration(Date.now() - Date.parse(t.updatedAt));
  console.log(`[${i + 1}] "${t.title}" · ${t.provider} ${t.model} · ${t.status} · quiet ${quiet} · ${t.project}`);
  console.log(`    ${threadLink(t.threadId) || `thread ${t.threadId}`}`);
  if (words.user) console.log(`    mike/last ask: ${words.user}`);
  if (words.assistant) console.log(`    agent/last words: ${words.assistant}`);
  console.log('');
});
