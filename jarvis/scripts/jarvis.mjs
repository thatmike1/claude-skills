#!/usr/bin/env node
/**
 * jarvis — the thread tools behind the jarvis skill. `node jarvis.mjs help`
 * lists the commands.
 */

import { t3OpenThreads } from '../../shared/t3-state.mjs';
import { lastWords, threadForSession } from './lib/t3.mjs';

const HELP = `jarvis — thread tools for the jarvis skill

  sweep                           open threads with their last words, for the settle sweep
  prompt-tail                     the paragraph to end a job's prompt with`;

// the inbox, its page, the wake service and check-ins went on 14 Oct 2026; a
// Jarvis thread still on the old instructions gets one line, not a failure
const REMOVED = ['post', 'note', 'list', 'show', 'ack', 'out', 'track', 'quiet', 'tick', 'serve', 'bind', 'send', 'status'];

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

const commands = {
  help() {
    console.log(HELP);
  },

  sweep() {
    const self = ownThread();
    const threads = t3OpenThreads().filter(t => t.threadId !== self);
    if (!threads.length) return console.log('no open threads: everything is settled');
    console.log(`# ${threads.length} open threads, newest first. Judge each: settle / needs you: <why> / running.\n`);
    threads.forEach((t, i) => {
      const words = lastWords(t.threadId, 400);
      const quiet = duration(Date.now() - Date.parse(t.updatedAt));
      console.log(`[${i + 1}] "${t.title}" · ${t.provider} ${t.model} · ${t.status} · quiet ${quiet} · ${t.project}`);
      console.log(`    thread ${t.threadId}`);
      if (words.user) console.log(`    mike/last ask: ${words.user}`);
      if (words.assistant) console.log(`    agent/last words: ${words.assistant}`);
      console.log('');
    });
  },

  'prompt-tail'() {
    console.log(`End with a final message in this shape, written for someone tired who did not watch you work, in under 150 words:

What changed: two plain sentences.
Does it work: what you ran and what passed. "Untested" is a fine answer.
You decide: the one thing Mike must decide, or "nothing".
Where: PR link, file path or page.

A PR link alone is not a report.`);
  },
};

const name = process.argv[2] || 'help';
if (REMOVED.includes(name)) {
  console.log('removed 14 Oct 2026: T3 wakes Jarvis itself, nothing to post');
  process.exit(0);
}
const command = commands[name];
if (!command) {
  console.error(`jarvis: unknown command ${name}; try help`);
  process.exit(1);
}
command();
