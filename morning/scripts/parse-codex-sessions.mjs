#!/usr/bin/env node

/**
 * parses codex CLI conversation history for a given date range.
 * extracts session metadata, user messages, and agent responses.
 *
 * usage: node parse-codex-sessions.mjs --from 2026-05-11 --to 2026-05-12 [--project /path/to/repo]
 * output: structured markdown to stdout
 */

import { createReadStream, readdirSync, readFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { join, resolve } from 'path';
import { homedir } from 'os';

const CODEX_DIR = join(homedir(), '.codex');
const SESSIONS_DIR = join(CODEX_DIR, 'sessions');
const INDEX_FILE = join(CODEX_DIR, 'session_index.jsonl');
const SUMMARIES_DIR = join(CODEX_DIR, 'memories', 'rollout_summaries');
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

function truncate(text, max = MAX_MSG_LENGTH) {
  if (!text || text.length <= max) return text;
  return text.substring(0, max) + '...';
}

/** generates YYYY/MM/DD paths for each date in the range */
function getDateDirs(fromDate, toDate) {
  const dirs = [];
  const current = new Date(fromDate + 'T00:00:00');
  const end = new Date(toDate + 'T23:59:59');

  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dirs.push(join(SESSIONS_DIR, String(y), m, d));
    current.setDate(current.getDate() + 1);
  }
  return dirs;
}

/** loads the session index for thread name lookups */
function loadSessionIndex() {
  const index = new Map();
  if (!existsSync(INDEX_FILE)) return index;

  try {
    const lines = readFileSync(INDEX_FILE, 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
      const entry = JSON.parse(line);
      if (entry.id && entry.thread_name) {
        index.set(entry.id, entry.thread_name);
      }
    }
  } catch {}
  return index;
}

/** finds a rollout summary for a given session ID */
function findRolloutSummary(sessionId) {
  if (!existsSync(SUMMARIES_DIR)) return null;

  try {
    const files = readdirSync(SUMMARIES_DIR);
    for (const file of files) {
      if (file.includes(sessionId.substring(0, 8))) {
        return readFileSync(join(SUMMARIES_DIR, file), 'utf-8');
      }
    }
  } catch {}
  return null;
}

/** checks if user message content is real input vs system injection */
function isRealUserMessage(contentBlocks) {
  if (!Array.isArray(contentBlocks)) return false;

  for (const block of contentBlocks) {
    if (block.type !== 'input_text' || !block.text) continue;
    const text = block.text.trim();
    if (text.startsWith('# AGENTS.md')) return false;
    if (text.startsWith('<environment_context>')) return false;
    if (text.startsWith('<INSTRUCTIONS>')) return false;
    if (text.startsWith('# Codex')) return false;
    if (text.length > 0) return true;
  }
  return false;
}

/** extracts user-readable text from content blocks */
function extractUserText(contentBlocks) {
  if (!Array.isArray(contentBlocks)) return '';

  const parts = [];
  for (const block of contentBlocks) {
    if (block.type === 'input_text' && block.text) {
      const text = block.text.trim();
      if (text.startsWith('<image')) continue;
      if (text.startsWith('</image>')) continue;
      if (text.startsWith('[tui]')) continue;
      if (text.startsWith('<skill>')) continue;
      if (text.startsWith('<turn_aborted>')) continue;
      if (text.startsWith('<command-message>')) continue;
      if (text) parts.push(text);
    }
  }
  return parts.join(' ').trim();
}

/** parses a single codex session JSONL file */
async function parseSessionFile(filePath, sessionIndex) {
  const result = {
    sessionId: null,
    cwd: null,
    branch: null,
    threadName: null,
    userMessages: [],
    agentMessages: [],
    rolloutSummary: null,
  };

  const rl = createInterface({ input: createReadStream(filePath) });
  for await (const line of rl) {
    try {
      const record = JSON.parse(line);

      if (record.type === 'session_meta') {
        result.sessionId = record.payload?.id;
        result.cwd = record.payload?.cwd;
        result.branch = record.payload?.git?.branch;
        if (result.sessionId) {
          result.threadName = sessionIndex.get(result.sessionId);
          result.rolloutSummary = findRolloutSummary(result.sessionId);
        }
      }

      if (record.type === 'response_item' && record.payload?.role === 'user') {
        if (isRealUserMessage(record.payload.content)) {
          const text = extractUserText(record.payload.content);
          if (text) result.userMessages.push(text);
        }
      }

      if (record.type === 'event_msg' && record.payload?.type === 'agent_message') {
        const msg = record.payload.message;
        if (msg?.trim()) {
          result.agentMessages.push({
            phase: record.payload.phase || 'unknown',
            text: msg.trim(),
          });
        }
      }
    } catch {}
  }

  return result;
}

/** formats a parsed session as markdown */
function formatSession(parsed) {
  const lines = [];
  const firstAgent = parsed.agentMessages[0]?.text?.substring(0, 80);
  const title = parsed.threadName || parsed.userMessages[0]?.substring(0, 80) || firstAgent || parsed.sessionId;
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
      .filter(l => !l.startsWith('thread_id:') && !l.startsWith('updated_at:') &&
                   !l.startsWith('rollout_path:') && !l.startsWith('cwd:') &&
                   !l.startsWith('git_branch:'))
      .join('\n').trim();

    if (summaryLines) {
      lines.push('**Rollout summary:**');
      lines.push(truncate(summaryLines, 800));
      lines.push('');
    }
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

  if (parsed.agentMessages.length > 0) {
    const msgs = parsed.agentMessages;
    const shown = msgs.length <= MAX_AGENT_MSGS ? msgs : msgs.slice(0, MAX_AGENT_MSGS);
    lines.push('**Agent did:**');
    for (const msg of shown) {
      const tag = msg.phase === 'final_answer' ? '[final] ' : '';
      lines.push(`- ${tag}${truncate(msg.text)}`);
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

  const sessionIndex = loadSessionIndex();
  const dateDirs = getDateDirs(opts.from, opts.to);
  const sessionFiles = [];

  for (const dir of dateDirs) {
    if (!existsSync(dir)) continue;
    try {
      const files = readdirSync(dir).filter(f => f.endsWith('.jsonl'));
      for (const file of files) {
        sessionFiles.push(join(dir, file));
      }
    } catch {}
  }

  if (sessionFiles.length === 0) {
    console.log('*No Codex sessions found for this date range.*');
    return;
  }

  const sessions = [];
  for (const file of sessionFiles) {
    const parsed = await parseSessionFile(file, sessionIndex);
    if (opts.project && parsed.cwd && !parsed.cwd.startsWith(opts.project)) continue;
    sessions.push(parsed);
  }

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
