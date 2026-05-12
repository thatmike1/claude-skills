#!/usr/bin/env node

/**
 * parses Codex CLI conversation history for a given date range.
 * extracts session metadata, user messages, and agent responses.
 *
 * usage: node parse-codex-sessions.mjs --from 2026-05-11 --to 2026-05-12 [--project /path/to/repo]
 * output: structured markdown to stdout
 */

import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { discoverCodexSessions, truncateText } from '../../shared/codex-parser.mjs';

const SESSIONS_DIR = join(homedir(), '.codex', 'sessions');
const MAX_MSG_LENGTH = 500;
const MAX_USER_MSGS = 10;
const MAX_AGENT_MSGS = 8;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) opts.from = args[++i];
    else if (args[i] === '--to' && args[i + 1]) opts.to = args[++i];
    else if (args[i] === '--project' && args[i + 1]) opts.project = resolve(args[++i]);
  }
  if (!opts.from || !opts.to) {
    console.error('usage: parse-codex-sessions.mjs --from YYYY-MM-DD --to YYYY-MM-DD [--project /path]');
    process.exit(1);
  }
  return opts;
}

/** formats a parsed session as markdown. */
function formatSession(parsed) {
  const lines = [];
  const firstAgent = parsed.agentMessages[0]?.text?.slice(0, 80);
  const title = parsed.threadName || parsed.userMessages[0]?.slice(0, 80) || firstAgent || parsed.sessionId;
  lines.push(`### ${title}`);
  lines.push('');

  const meta = [];
  if (parsed.cwd) meta.push(`**Project:** ${parsed.cwd}`);
  if (parsed.branch) meta.push(`**Branch:** ${parsed.branch}`);
  if (meta.length) {
    lines.push(meta.join(' | '));
    lines.push('');
  }

  if (parsed.rolloutSummary) {
    const summaryLines = parsed.rolloutSummary.split('\n')
      .filter(line => !line.startsWith('thread_id:') && !line.startsWith('updated_at:') &&
        !line.startsWith('rollout_path:') && !line.startsWith('cwd:') &&
        !line.startsWith('git_branch:'))
      .join('\n').trim();

    if (summaryLines) {
      lines.push('**Rollout summary:**');
      lines.push(truncateText(summaryLines, 800));
      lines.push('');
    }
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

  if (parsed.agentMessages.length > 0) {
    const msgs = parsed.agentMessages;
    const shown = msgs.length <= MAX_AGENT_MSGS ? msgs : msgs.slice(0, MAX_AGENT_MSGS);
    lines.push('**Agent did:**');
    for (const msg of shown) {
      const tag = msg.phase === 'final_answer' ? '[final] ' : '';
      lines.push(`- ${tag}${truncateText(msg.text, MAX_MSG_LENGTH)}`);
    }
    if (msgs.length > MAX_AGENT_MSGS) {
      lines.push(`- *...and ${msgs.length - MAX_AGENT_MSGS} more responses*`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const opts = parseArgs();

  if (!existsSync(SESSIONS_DIR)) {
    console.log('*No Codex sessions directory found.*');
    return;
  }

  const sessions = await discoverCodexSessions(opts.from, opts.to, opts.project);

  if (sessions.length === 0) {
    console.log('*No Codex sessions found matching the filters.*');
    return;
  }

  console.log(`## Codex Sessions (${sessions.length})\n`);

  for (const session of sessions) {
    console.log(formatSession(session));
    console.log('---\n');
  }
}

main().catch(err => {
  console.error('error:', err.message);
  process.exit(1);
});
