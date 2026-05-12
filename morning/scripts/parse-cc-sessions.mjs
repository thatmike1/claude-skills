#!/usr/bin/env node

/**
 * parses Claude Code conversation history for a given date range.
 * extracts AI titles, user messages, and assistant text responses.
 *
 * usage: node parse-cc-sessions.mjs --from 2026-05-11 --to 2026-05-12 [--project /path/to/repo]
 * output: structured markdown to stdout
 */

import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { discoverSessions, parseSessionFile, truncateText } from '../../shared/cc-parser.mjs';

const HISTORY_FILE = join(homedir(), '.claude', 'history.jsonl');
const MAX_MSG_LENGTH = 500;
const MAX_USER_MSGS = 15;
const MAX_ASSISTANT_MSGS = 8;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) opts.from = args[++i];
    else if (args[i] === '--to' && args[i + 1]) opts.to = args[++i];
    else if (args[i] === '--project' && args[i + 1]) opts.project = resolve(args[++i]);
  }
  if (!opts.from || !opts.to) {
    console.error('usage: parse-cc-sessions.mjs --from YYYY-MM-DD --to YYYY-MM-DD [--project /path]');
    process.exit(1);
  }
  return opts;
}

/** formats a parsed session as markdown. */
function formatSession(session, parsed) {
  const lines = [];
  const title = parsed.aiTitle || session.firstPrompt || session.sessionId;
  lines.push(`### ${title}`);
  lines.push('');

  const meta = [];
  if (session.project) meta.push(`**Project:** ${session.project}`);
  if (parsed.branch) meta.push(`**Branch:** ${parsed.branch}`);
  if (meta.length) {
    lines.push(meta.join(' | '));
    lines.push('');
  }

  if (parsed.userMessages.length > 0) {
    const msgs = parsed.userMessages;
    const shown = msgs.length <= MAX_USER_MSGS ? msgs : msgs.slice(0, MAX_USER_MSGS);
    lines.push('**User said:**');
    for (const msg of shown) {
      lines.push(`- ${truncateText(msg, MAX_MSG_LENGTH)}`);
    }
    if (msgs.length > MAX_USER_MSGS) {
      lines.push(`- *...and ${msgs.length - MAX_USER_MSGS} more messages*`);
    }
    lines.push('');
  }

  if (parsed.assistantTexts.length > 0) {
    const msgs = parsed.assistantTexts;
    const shown = msgs.length <= MAX_ASSISTANT_MSGS ? msgs : msgs.slice(0, MAX_ASSISTANT_MSGS);
    lines.push('**Assistant did:**');
    for (const msg of shown) {
      lines.push(`- ${truncateText(msg, MAX_MSG_LENGTH)}`);
    }
    if (msgs.length > MAX_ASSISTANT_MSGS) {
      lines.push(`- *...and ${msgs.length - MAX_ASSISTANT_MSGS} more responses*`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const opts = parseArgs();

  if (!existsSync(HISTORY_FILE)) {
    console.error('claude code history not found at', HISTORY_FILE);
    process.exit(1);
  }

  const sessions = await discoverSessions(opts);

  if (sessions.length === 0) {
    console.log('*No Claude Code sessions found for this date range.*');
    return;
  }

  console.log(`## Claude Code Sessions (${sessions.length})\n`);

  for (const session of sessions) {
    if (!session.filePath) continue;

    const parsed = await parseSessionFile(session.filePath);
    console.log(formatSession(session, parsed));
    console.log('---\n');
  }
}

main().catch(err => {
  console.error('error:', err.message);
  process.exit(1);
});
