#!/usr/bin/env node

/**
 * shared Claude Code conversation discovery and parsing utilities.
 *
 * the parser turns a session JSONL into a structured record:
 *   { sessionId, project, date, branch, model, aiTitle, filePath,
 *     messages: [ { seq, role, ts, text, tools?, thinking? } ] }
 * legacy flat fields (userMessages / assistantTexts) are derived from
 * `messages` so existing consumers keep working unchanged.
 */

import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, join, resolve } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const CLAUDE_DIR = join(homedir(), '.claude');
const HISTORY_FILE = join(CLAUDE_DIR, 'history.jsonl');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');
const DEFAULT_MAX_MESSAGE_LENGTH = 5000;

/** prefixes that mark a user "message" as harness noise rather than real input. */
export const DEFAULT_NOISE_PREFIXES = [
  '<local-command-caveat>',
  '<command-name>',
  '<command-message>',
  '<local-command-stdout>',
  '<task-notification>',
];

/** truncates text to the configured maximum length (Infinity / 0 disables it). */
export function truncateText(text, maxLength = DEFAULT_MAX_MESSAGE_LENGTH) {
  if (!text) return text;
  if (!maxLength || maxLength === Infinity || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/** checks whether a user text is harness noise (command tags, notifications, empty). */
export function isNoise(text, prefixes = DEFAULT_NOISE_PREFIXES) {
  if (!text) return true;
  return prefixes.some(prefix => text.startsWith(prefix));
}

/**
 * extracts human-readable text from a record's `message.content`, handling both
 * the string form and the array-of-blocks form. only `text` blocks contribute —
 * tool_result / image / tool_use blocks are ignored here. this is the single
 * extractor used everywhere, so array-content user messages are never dropped.
 */
export function extractMessageText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  const parts = [];
  for (const block of content) {
    if (block?.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
      parts.push(block.text);
    }
  }
  return parts.join('\n');
}

/** collects tool_use blocks from assistant content as {name, input}. */
function extractToolUses(content) {
  if (!Array.isArray(content)) return [];
  const tools = [];
  for (const block of content) {
    if (block?.type === 'tool_use' && block.name) {
      tools.push({ name: block.name, input: block.input ?? {} });
    }
  }
  return tools;
}

/** collects thinking blocks from assistant content as a single string. */
function extractThinking(content) {
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const block of content) {
    if (block?.type === 'thinking' && block.thinking?.trim()) parts.push(block.thinking);
  }
  return parts.join('\n');
}

/** encodes an absolute path into its Claude project directory name (/ -> -). */
function encodeProjectDir(absPath) {
  return absPath.replace(/\//g, '-');
}

/**
 * checks whether a discovered session belongs to a project filter, robust to
 * whether the project came from a sessions-index.json (absolute path) or the
 * fallback decode (slash-form). matches on the absolute path prefix OR the
 * encoded project directory name.
 */
export function projectMatches(session, projectFilter) {
  if (!projectFilter) return true;
  if (session.project && String(session.project).startsWith(projectFilter)) return true;
  if (session.projectDir && session.projectDir === encodeProjectDir(projectFilter)) return true;
  return false;
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

/** extracts the first non-meta, non-noise user message from a JSONL file. */
export async function extractFirstUserMessage(filePath, maxLength = 300) {
  try {
    const rl = createInterface({ input: createReadStream(filePath) });
    for await (const line of rl) {
      try {
        const record = JSON.parse(line);
        if (record.type !== 'user' || record.isMeta) continue;
        const text = extractMessageText(record.message?.content).trim();
        if (text && !isNoise(text)) return truncateText(text, maxLength);
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
            projectDir: projectDirName,
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
        projectDir: projectDirName,
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
  const projectFilter = !opts.global && opts.project ? resolve(opts.project) : null;
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

  return indexSessions.filter(session => projectMatches(session, projectFilter));
}

/**
 * extracts a structured record from a Claude Code session JSONL file.
 *
 * @param {string} filePath
 * @param {object} [opts]
 * @param {number} [opts.maxLength=5000]   per-message truncation; Infinity = none
 * @param {?number} [opts.maxUserMessages] cap on user messages kept (null = all)
 * @param {?number} [opts.maxAssistantMessages] cap on assistant messages kept
 * @param {string[]} [opts.roles]          roles to include (default user+assistant)
 * @param {boolean} [opts.includeTools=true] capture tool_use blocks as message.tools
 * @param {boolean} [opts.includeThinking=false] capture thinking blocks
 * @param {string[]} [opts.noiseFilters]   user-message prefixes to drop
 */
export async function parseSessionFile(filePath, opts = {}) {
  const {
    maxLength = DEFAULT_MAX_MESSAGE_LENGTH,
    maxUserMessages = null,
    maxAssistantMessages = null,
    roles = ['user', 'assistant'],
    includeTools = true,
    includeThinking = false,
    noiseFilters = DEFAULT_NOISE_PREFIXES,
  } = opts;

  const result = {
    sessionId: basename(filePath).replace(/\.jsonl$/, ''),
    project: null,
    date: null,
    branch: null,
    model: null,
    aiTitle: null,
    filePath,
    messages: [],
    userMessages: [],
    assistantTexts: [],
  };

  let order = 0;
  const rl = createInterface({ input: createReadStream(filePath) });
  for await (const line of rl) {
    try {
      const record = JSON.parse(line);

      if (record.type === 'ai-title' && record.aiTitle) result.aiTitle = record.aiTitle;
      if (!result.branch && record.gitBranch) result.branch = record.gitBranch;
      if (!result.project && record.cwd) result.project = record.cwd;
      if (!result.date && record.timestamp) {
        const ts = normalizeTimestamp(record.timestamp);
        if (ts) result.date = ts.slice(0, 10);
      }

      const ts = record.timestamp ? normalizeTimestamp(record.timestamp) : null;

      if (record.type === 'user' && !record.isMeta && roles.includes('user')) {
        const text = extractMessageText(record.message?.content).trim();
        if (!text || isNoise(text, noiseFilters)) continue;
        result.messages.push({ seq: order++, role: 'user', ts, text: truncateText(text, maxLength) });
      } else if (record.type === 'assistant' && roles.includes('assistant')) {
        if (!result.model && record.message?.model) result.model = record.message.model;
        const content = record.message?.content;
        const text = extractMessageText(content).trim();
        const tools = includeTools ? extractToolUses(content) : [];
        const thinking = includeThinking ? extractThinking(content).trim() : '';
        if (!text && !tools.length && !thinking) continue;
        const msg = { seq: order++, role: 'assistant', ts, text: truncateText(text, maxLength) };
        if (tools.length) msg.tools = tools;
        if (thinking) msg.thinking = truncateText(thinking, maxLength);
        result.messages.push(msg);
      }
    } catch {}
  }

  // apply per-role caps, keeping the first N of each role in original order
  if (maxUserMessages != null || maxAssistantMessages != null) {
    let users = 0;
    let assistants = 0;
    result.messages = result.messages.filter(msg => {
      if (msg.role === 'user') {
        if (maxUserMessages != null && users >= maxUserMessages) return false;
        users++;
        return true;
      }
      if (msg.role === 'assistant') {
        if (maxAssistantMessages != null && assistants >= maxAssistantMessages) return false;
        assistants++;
        return true;
      }
      return true;
    });
  }

  // legacy flat fields derived from messages (kept for existing consumers)
  result.userMessages = result.messages.filter(m => m.role === 'user').map(m => m.text);
  result.assistantTexts = result.messages.filter(m => m.role === 'assistant' && m.text).map(m => m.text);

  return result;
}

/** cheap single-pass stats for a session file — counts without retaining bodies. */
async function scanSessionStats(filePath) {
  const stats = {
    branch: null, model: null, aiTitle: null,
    messageCount: 0, userCount: 0, assistantCount: 0, toolCounts: {},
  };
  try {
    const rl = createInterface({ input: createReadStream(filePath) });
    for await (const line of rl) {
      try {
        const record = JSON.parse(line);
        if (record.type === 'ai-title' && record.aiTitle) stats.aiTitle = record.aiTitle;
        if (!stats.branch && record.gitBranch) stats.branch = record.gitBranch;

        if (record.type === 'user' && !record.isMeta) {
          const text = extractMessageText(record.message?.content).trim();
          if (text && !isNoise(text)) { stats.userCount++; stats.messageCount++; }
        } else if (record.type === 'assistant') {
          if (!stats.model && record.message?.model) stats.model = record.message.model;
          const content = record.message?.content;
          const text = extractMessageText(content).trim();
          const tools = extractToolUses(content);
          if (text || tools.length) { stats.assistantCount++; stats.messageCount++; }
          for (const tool of tools) stats.toolCounts[tool.name] = (stats.toolCounts[tool.name] || 0) + 1;
        }
      } catch {}
    }
  } catch {}
  return stats;
}

/**
 * builds a lightweight per-session index for "decide what to load" workflows.
 * shallow (default) returns metadata only with no file parsing; deep:true adds
 * branch / model / message + tool counts by cheaply scanning each file.
 */
export async function buildIndex(opts = {}) {
  const sessions = await discoverSessions(opts);

  if (!opts.deep) {
    return sessions.map(session => ({
      sessionId: session.sessionId,
      date: session.date,
      project: session.project,
      title: session.summary || session.firstPrompt || '',
      firstPrompt: session.firstPrompt || '',
      filePath: session.filePath,
    }));
  }

  const indexed = [];
  for (const session of sessions) {
    const stats = session.filePath ? await scanSessionStats(session.filePath) : null;
    indexed.push({
      sessionId: session.sessionId,
      date: session.date,
      project: session.project,
      title: stats?.aiTitle || session.summary || session.firstPrompt || '',
      firstPrompt: session.firstPrompt || '',
      branch: stats?.branch ?? null,
      model: stats?.model ?? null,
      messageCount: stats?.messageCount ?? 0,
      userCount: stats?.userCount ?? 0,
      assistantCount: stats?.assistantCount ?? 0,
      toolCounts: stats?.toolCounts ?? {},
      filePath: session.filePath,
    });
  }
  return indexed;
}

export function normalizeTimestamp(timestamp) {
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
    else if (args[i] === '--global') opts.global = true;
    else if (args[i] === '--index') opts.index = true;
    else if (args[i] === '--deep') opts.deep = true;
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  const result = opts.index ? await buildIndex(opts) : await discoverSessions(opts);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('error:', err.message);
    process.exit(1);
  });
}
