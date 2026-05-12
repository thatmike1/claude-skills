#!/usr/bin/env node

/**
 * shared Claude Code conversation discovery and parsing utilities.
 */

import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const CLAUDE_DIR = join(homedir(), '.claude');
const HISTORY_FILE = join(CLAUDE_DIR, 'history.jsonl');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');
const DEFAULT_MAX_MESSAGE_LENGTH = 5000;

/** truncates text to the configured maximum length. */
export function truncateText(text, maxLength = DEFAULT_MAX_MESSAGE_LENGTH) {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/** decodes a Claude project directory name into a readable path-ish project name. */
export function decodeProjectName(dirname) {
  const user = homedir().split('/').pop();
  return dirname
    .replace(new RegExp(`^-home-${user}-git-`), '')
    .replace(new RegExp(`^-home-${user}-`), '~/')
    .replace(/^-/, '/')
    .replace(/-/g, '/');
}

/** finds the JSONL file for a session ID across Claude project directories. */
export function findSessionFile(sessionId) {
  try {
    for (const dir of readdirSync(PROJECTS_DIR)) {
      const filePath = join(PROJECTS_DIR, dir, `${sessionId}.jsonl`);
      if (existsSync(filePath)) return filePath;
    }
  } catch {}
  return null;
}

/** extracts the first non-meta user message from a JSONL file. */
export async function extractFirstUserMessage(filePath, maxLength = 300) {
  try {
    const rl = createInterface({ input: createReadStream(filePath) });
    for await (const line of rl) {
      try {
        const record = JSON.parse(line);
        if (record.type !== 'user' || record.isMeta) continue;

        const content = record.message?.content ?? record.message;
        if (typeof content === 'string') return truncateText(content.trim(), maxLength);
        if (Array.isArray(content)) {
          for (const item of content) {
            if (item?.type === 'text' && item.text?.trim()) {
              return truncateText(item.text.trim(), maxLength);
            }
          }
        }
      } catch {}
    }
  } catch {}
  return '';
}

/** extracts an ISO timestamp from a JSONL file, falling back to file mtime. */
export async function getTimestampFromJsonl(filePath) {
  try {
    const rl = createInterface({ input: createReadStream(filePath) });
    for await (const line of rl) {
      try {
        const record = JSON.parse(line);
        if (!record.timestamp) continue;
        return normalizeTimestamp(record.timestamp);
      } catch {}
    }
  } catch {}

  try {
    return new Date(statSync(filePath).mtimeMs).toISOString();
  } catch {
    return null;
  }
}

/** discovers sessions from Claude Code sessions-index.json files. */
export async function discoverSessionsFromIndex() {
  const sessions = [];
  if (!existsSync(PROJECTS_DIR)) return sessions;

  for (const projectDirName of readdirSync(PROJECTS_DIR).sort()) {
    const projectDir = join(PROJECTS_DIR, projectDirName);
    let stat;
    try {
      stat = statSync(projectDir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    const indexFile = join(projectDir, 'sessions-index.json');
    if (existsSync(indexFile) && statSync(indexFile).size > 10) {
      try {
        const data = JSON.parse(readFileSync(indexFile, 'utf-8'));
        const entries = Array.isArray(data) ? data : data.entries;
        if (!Array.isArray(entries)) continue;

        for (const entry of entries) {
          if (!entry.sessionId) continue;
          const filePath = entry.fullPath || join(projectDir, `${entry.sessionId}.jsonl`);
          const timestamp = entry.created || normalizeTimestamp(entry.fileMtime) || null;
          sessions.push({
            sessionId: entry.sessionId,
            project: entry.projectPath || data.originalPath || decodeProjectName(projectDirName),
            summary: entry.summary || '',
            firstPrompt: truncateText(entry.firstPrompt || '', 300),
            timestamp,
            date: timestamp ? timestamp.slice(0, 10) : 'unknown',
            filePath,
          });
        }
      } catch (err) {
        console.error(`warn: failed to read ${indexFile}: ${err.message}`);
      }
      continue;
    }

    for (const file of readdirSync(projectDir).sort()) {
      if (!file.endsWith('.jsonl') || file.startsWith('agent-')) continue;
      const filePath = join(projectDir, file);
      try {
        if (statSync(filePath).size < 100) continue;
      } catch {
        continue;
      }
      const timestamp = await getTimestampFromJsonl(filePath);
      sessions.push({
        sessionId: file.replace(/\.jsonl$/, ''),
        project: decodeProjectName(projectDirName),
        summary: '',
        firstPrompt: await extractFirstUserMessage(filePath),
        timestamp,
        date: timestamp ? timestamp.slice(0, 10) : 'unknown',
        filePath,
      });
    }
  }

  sessions.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  return sessions;
}

/** discovers sessions from Claude Code history.jsonl with date and project filtering. */
export async function discoverSessionsFromHistory(fromMs, toMs, projectFilter) {
  const sessions = new Map();
  if (!existsSync(HISTORY_FILE)) return [];

  const rl = createInterface({ input: createReadStream(HISTORY_FILE) });
  for await (const line of rl) {
    try {
      const entry = JSON.parse(line);
      if (!entry.sessionId || !entry.timestamp) continue;

      const timestamp = normalizeTimestamp(entry.timestamp);
      const ts = timestamp ? Date.parse(timestamp) : NaN;
      if (Number.isNaN(ts)) continue;
      if (fromMs != null && ts < fromMs) continue;
      if (toMs != null && ts >= toMs) continue;
      if (projectFilter && entry.project && !entry.project.startsWith(projectFilter)) continue;

      if (!sessions.has(entry.sessionId)) {
        sessions.set(entry.sessionId, {
          sessionId: entry.sessionId,
          project: entry.project || '',
          summary: '',
          firstPrompt: entry.display || '',
          timestamp,
          date: timestamp.slice(0, 10),
          filePath: findSessionFile(entry.sessionId),
        });
      }
    } catch {}
  }

  return [...sessions.values()];
}

/** discovers sessions, merging index summaries with history timestamps when available. */
export async function discoverSessions(opts = {}) {
  const projectFilter = opts.project ? resolve(opts.project) : null;
  const indexSessions = await discoverSessionsFromIndex();
  const byId = new Map(indexSessions.map(session => [session.sessionId, session]));

  if (opts.from || opts.to) {
    const fromMs = opts.from ? new Date(`${opts.from}T00:00:00`).getTime() : null;
    const toMs = opts.to ? new Date(`${opts.to}T23:59:59.999`).getTime() + 1 : null;
    const historySessions = await discoverSessionsFromHistory(fromMs, toMs, projectFilter);

    return historySessions.map(session => {
      const indexed = byId.get(session.sessionId);
      return {
        ...session,
        summary: indexed?.summary || session.summary || '',
        firstPrompt: indexed?.firstPrompt || session.firstPrompt || '',
        timestamp: session.timestamp || indexed?.timestamp || null,
        date: (session.timestamp || indexed?.timestamp || '').slice(0, 10) || 'unknown',
        filePath: session.filePath || indexed?.filePath || null,
      };
    });
  }

  return indexSessions.filter(session => {
    if (!projectFilter) return true;
    return session.project?.startsWith(projectFilter);
  });
}

/** extracts clean signal from a Claude Code session JSONL file. */
export async function parseSessionFile(filePath, opts = {}) {
  const maxLength = opts.maxLength ?? DEFAULT_MAX_MESSAGE_LENGTH;
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
        if (isClaudeUserNoise(text)) continue;
        result.userMessages.push(truncateText(text, maxLength));
      }

      if (record.type === 'assistant' && Array.isArray(record.message?.content)) {
        for (const block of record.message.content) {
          if (block.type === 'text' && block.text?.trim()) {
            result.assistantTexts.push(truncateText(block.text.trim(), maxLength));
          }
        }
      }
    } catch {}
  }

  return result;
}

function isClaudeUserNoise(text) {
  if (!text) return true;
  return [
    '<local-command-caveat>',
    '<command-name>',
    '<command-message>',
    '<local-command-stdout>',
  ].some(prefix => text.startsWith(prefix));
}

function normalizeTimestamp(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp === 'string') {
    const parsed = Date.parse(timestamp);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  if (typeof timestamp === 'number') {
    const value = timestamp > 9999999999 ? timestamp : timestamp * 1000;
    return new Date(value).toISOString();
  }
  return null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) opts.from = args[++i];
    else if (args[i] === '--to' && args[i + 1]) opts.to = args[++i];
    else if (args[i] === '--project' && args[i + 1]) opts.project = resolve(args[++i]);
  }
  return opts;
}

async function main() {
  const sessions = await discoverSessions(parseArgs());
  console.log(JSON.stringify(sessions, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('error:', err.message);
    process.exit(1);
  });
}
