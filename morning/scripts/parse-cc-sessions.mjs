#!/usr/bin/env node

/**
 * parses claude code conversation history for a given date range.
 * extracts AI titles, user messages, and assistant text responses.
 *
 * usage: node parse-cc-sessions.mjs --from 2026-05-11 --to 2026-05-12 [--project /path/to/repo]
 * output: structured markdown to stdout
 */

import { createReadStream, readFileSync, readdirSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { join, resolve } from 'path';
import { homedir } from 'os';

const CLAUDE_DIR = join(homedir(), '.claude');
const HISTORY_FILE = join(CLAUDE_DIR, 'history.jsonl');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');
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

function truncate(text, max = MAX_MSG_LENGTH) {
  if (!text || text.length <= max) return text;
  return text.substring(0, max) + '...';
}

/** finds sessions in the date range from history.jsonl */
async function discoverSessions(fromMs, toMs, projectFilter) {
  const sessions = new Map();

  const rl = createInterface({ input: createReadStream(HISTORY_FILE) });
  for await (const line of rl) {
    try {
      const entry = JSON.parse(line);
      if (!entry.sessionId || !entry.timestamp) continue;

      const ts = typeof entry.timestamp === 'number' ? entry.timestamp : Date.parse(entry.timestamp);
      if (ts < fromMs || ts >= toMs) continue;

      if (projectFilter && entry.project && !entry.project.startsWith(projectFilter)) continue;

      if (!sessions.has(entry.sessionId)) {
        sessions.set(entry.sessionId, {
          sessionId: entry.sessionId,
          project: entry.project || '',
          firstPrompt: entry.display || '',
        });
      }
    } catch {}
  }

  return [...sessions.values()];
}

/** finds the JSONL file for a session ID across all project dirs */
function findSessionFile(sessionId) {
  try {
    const dirs = readdirSync(PROJECTS_DIR);
    for (const dir of dirs) {
      const filePath = join(PROJECTS_DIR, dir, `${sessionId}.jsonl`);
      if (existsSync(filePath)) return filePath;
    }
  } catch {}
  return null;
}

/** extracts signal from a session JSONL file */
async function parseSessionFile(filePath) {
  const result = {
    aiTitle: null,
    branch: null,
    userMessages: [],
    assistantTexts: [],
  };

  const rl = createInterface({ input: createReadStream(filePath) });
  for await (const line of rl) {
    try {
      const record = JSON.parse(line);

      if (record.type === 'ai-title' && record.aiTitle) {
        result.aiTitle = record.aiTitle;
      }

      if (!result.branch && record.gitBranch) {
        result.branch = record.gitBranch;
      }

      if (record.type === 'user' && typeof record.message?.content === 'string') {
        const text = record.message.content.trim();
        if (!text) continue;
        if (text.startsWith('<local-command-caveat>')) continue;
        if (text.startsWith('<command-name>')) continue;
        if (text.startsWith('<command-message>')) continue;
        if (text.startsWith('<local-command-stdout>')) continue;
        result.userMessages.push(text);
      }

      if (record.type === 'assistant' && Array.isArray(record.message?.content)) {
        for (const block of record.message.content) {
          if (block.type === 'text' && block.text?.trim()) {
            result.assistantTexts.push(block.text.trim());
          }
        }
      }
    } catch {}
  }

  return result;
}

/** formats a parsed session as markdown */
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
      lines.push(`- ${truncate(msg)}`);
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
      lines.push(`- ${truncate(msg)}`);
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
  const fromMs = new Date(opts.from + 'T00:00:00').getTime();
  const toMs = new Date(opts.to + 'T23:59:59.999').getTime();

  if (!existsSync(HISTORY_FILE)) {
    console.error('claude code history not found at', HISTORY_FILE);
    process.exit(1);
  }

  const sessions = await discoverSessions(fromMs, toMs, opts.project);

  if (sessions.length === 0) {
    console.log('*No Claude Code sessions found for this date range.*');
    return;
  }

  console.log(`## Claude Code Sessions (${sessions.length})\n`);

  for (const session of sessions) {
    const filePath = findSessionFile(session.sessionId);
    if (!filePath) continue;

    const parsed = await parseSessionFile(filePath);
    console.log(formatSession(session, parsed));
    console.log('---\n');
  }
}

main().catch(err => {
  console.error('error:', err.message);
  process.exit(1);
});
