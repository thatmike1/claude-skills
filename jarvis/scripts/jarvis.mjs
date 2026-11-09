#!/usr/bin/env node
/**
 * jarvis — the thread tools behind the jarvis skill. `node jarvis.mjs help`
 * lists the commands.
 */

const HELP = `jarvis — thread tools for the jarvis skill

  prompt-tail                     the paragraph to end a job's prompt with`;

// the inbox, its page, the wake service and check-ins went on 14 Oct 2026; a
// Jarvis thread still on the old instructions gets one line, not a failure
const REMOVED = ['post', 'note', 'list', 'show', 'ack', 'out', 'track', 'quiet', 'tick', 'serve', 'bind', 'send', 'status'];

const commands = {
  help() {
    console.log(HELP);
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
// the settle sweep moved into its own skill on 9 Nov 2026
if (name === 'sweep') {
  console.log('moved to the settle-sweep skill: node ~/.claude/skills/settle-sweep/scripts/sweep.mjs');
  process.exit(0);
}
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
