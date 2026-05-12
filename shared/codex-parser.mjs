#!/usr/bin/env node

/**
 * shared Codex conversation discovery and parsing utilities.
 */

import { createReadStream, existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const CODEX_DIR = join(homedir(), '.codex');
const SESSIONS_DIR = join(CODEX_DIR, 'sessions');
const INDEX_FILE = join(CODEX_DIR, 'session_index.jsonl');
const SUMMARIES_DIR = join(CODEX_DIR, 'memories', 'rollout_summaries');
const DEFAULT_MAX_MESSAGE_LENGTH = 5000;

/** truncates text to the configured maximum length. */
export function truncateText(text, maxLength = DEFAULT_MAX_MESSAGE_LENGTH) {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/** generates YYYY/MM/DD session directories for each date in the range. */
export function getDateDirs(fromDate, toDate) {
  const dirs = [];
  const current = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T23:59:59`);

  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dirs.push(join(SESSIONS_DIR, String(y), m, d));
    current.setDate(current.getDate() + 1);
  }
  return dirs;
}

/** loads the Codex session index for thread name lookups. */
export function loadSessionIndex() {
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

/** finds a rollout summary for a given Codex session ID. */
export function findRolloutSummary(sessionId) {
  if (!existsSync(SUMMARIES_DIR)) return null;

  try {
    const files = readdirSync(SUMMARIES_DIR);
    for (const file of files) {
      if (file.includes(sessionId.slice(0, 8))) {
        return readFileSync(join(SUMMARIES_DIR, file), 'utf-8');
      }
    }
  } catch {}
  return null;
}

/** discovers Codex session files by date directory and optional project filter. */
export async function discoverCodexSessions(fromDate, toDate, projectFilter = null) {
  if (!existsSync(SESSIONS_DIR)) return [];

  const sessionIndex = loadSessionIndex();
  const sessions = [];
  for (const dir of getDateDirs(fromDate, toDate)) {
    if (!existsSync(dir)) continue;

    let files = [];
    try {
      files = readdirSync(dir).filter(file => file.endsWith('.jsonl'));
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = join(dir, file);
      const parsed = await parseCodexSession(filePath, sessionIndex);
      if (projectFilter && parsed.cwd && !parsed.cwd.startsWith(projectFilter)) continue;
      parsed.filePath = filePath;
      sessions.push(parsed);
    }
  }
  return sessions;
}

/** parses a single Codex session JSONL file. */
export async function parseCodexSession(filePath, sessionIndex = loadSessionIndex(), opts = {}) {
  const maxLength = opts.maxLength ?? DEFAULT_MAX_MESSAGE_LENGTH;
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
          if (text) result.userMessages.push(truncateText(text, maxLength));
        }
      }

      if (record.type === 'event_msg' && record.payload?.type === 'agent_message') {
        const msg = record.payload.message;
        if (msg?.trim()) {
          result.agentMessages.push({
            phase: record.payload.phase || 'unknown',
            text: truncateText(msg.trim(), maxLength),
          });
        }
      }
    } catch {}
  }

  return result;
}

/** checks whether content blocks contain real user input rather than injected context. */
export function isRealUserMessage(contentBlocks) {
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

/** extracts user-readable text from Codex content blocks. */
export function extractUserText(contentBlocks) {
  if (!Array.isArray(contentBlocks)) return '';

  const parts = [];
  for (const block of contentBlocks) {
    if (block.type !== 'input_text' || !block.text) continue;
    const text = block.text.trim();
    if (text.startsWith('<image')) continue;
    if (text.startsWith('</image>')) continue;
    if (text.startsWith('[tui]')) continue;
    if (text.startsWith('<skill>')) continue;
    if (text.startsWith('<turn_aborted>')) continue;
    if (text.startsWith('<command-message>')) continue;
    if (text.startsWith('<environment_context>')) continue;
    if (text) parts.push(text);
  }
  return parts.join(' ').trim();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) opts.from = args[++i];
    else if (args[i] === '--to' && args[i + 1]) opts.to = args[++i];
    else if (args[i] === '--project' && args[i + 1]) opts.project = resolve(args[++i]);
  }
  if (!opts.from || !opts.to) {
    console.error('usage: codex-parser.mjs --from YYYY-MM-DD --to YYYY-MM-DD [--project /path]');
    process.exit(1);
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  const sessions = await discoverCodexSessions(opts.from, opts.to, opts.project);
  console.log(JSON.stringify(sessions, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('error:', err.message);
    process.exit(1);
  });
}
