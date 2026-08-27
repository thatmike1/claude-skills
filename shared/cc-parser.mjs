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
 * whether the project came from history.jsonl (absolute path) or the directory
 * decode (slash-form). matches on the absolute path prefix OR the encoded
 * project directory name.
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

/**
 * reads the subagent transcripts in one directory into subagent records.
 *
 * @param {string} dir        directory holding the transcripts
 * @param {string} sessionId  owning session id
 * @param {?string} workflowId workflow the transcripts belong to, null when flat
 * @returns {object[]} subagent records
 */
function readSubagentDir(dir, sessionId, workflowId) {
  const subagents = [];

  let files;
  try {
    files = readdirSync(dir).sort();
  } catch {
    return subagents;
  }

  for (const file of files) {
    if (!file.endsWith('.jsonl')) continue;
    // a workflow's journal is bookkeeping, not an agent transcript
    if (file === 'journal.jsonl') continue;
    const name = file.replace(/\.jsonl$/, '');

    let meta = {};
    try {
      const parsed = JSON.parse(readFileSync(join(dir, `${name}.meta.json`), 'utf-8'));
      if (parsed && typeof parsed === 'object') meta = parsed;
    } catch {}

    subagents.push({
      // the workflow segment keeps basenames from colliding across workflows
      agentId: workflowId ? `${sessionId}~${workflowId}~${name}` : `${sessionId}~${name}`,
      name: meta.name || name,
      description: meta.description || '',
      agentType: meta.agentType ?? null,
      model: meta.model ?? null,
      spawnDepth: meta.spawnDepth ?? null,
      workflowId,
      filePath: join(dir, file),
    });
  }

  return subagents;
}

/**
 * collects the subagent transcripts owned by a session.
 *
 * they live at `<projectDir>/<sessionId>/subagents/*.jsonl`, with an optional
 * `<name>.meta.json` sidecar. identity comes from the path only: a subagent's
 * own JSONL records its PARENT's sessionId, so trusting that field would
 * collide every subagent with its owner. nested spawns are written flat into
 * that directory, so it needs no recursion — the one exception is workflow runs,
 * which get their own `subagents/workflows/<workflowId>/` directory, walked
 * exactly one level deep.
 *
 * @param {string} projectDir absolute path to the Claude project directory
 * @param {string} sessionId  owning session id
 * @returns {object[]} subagent records (empty when the session spawned none)
 */
function collectSubagents(projectDir, sessionId) {
  const subagentsDir = join(projectDir, sessionId, 'subagents');
  const subagents = readSubagentDir(subagentsDir, sessionId, null);

  const workflowsDir = join(subagentsDir, 'workflows');
  let workflowIds = [];
  try {
    workflowIds = readdirSync(workflowsDir).sort();
  } catch {
    return subagents;
  }

  for (const workflowId of workflowIds) {
    const workflowDir = join(workflowsDir, workflowId);
    try {
      if (!statSync(workflowDir).isDirectory()) continue;
    } catch {
      continue;
    }
    subagents.push(...readSubagentDir(workflowDir, sessionId, workflowId));
  }

  return subagents;
}

/**
 * clock skew and filesystems that fake birthtime make the stat-level bounds
 * approximate, so they are padded before anything is excluded on them.
 */
const BOUND_MARGIN_MS = 24 * 60 * 60 * 1000;

/**
 * everything knowable about a transcript without opening it.
 *
 * @returns {?object} null when the file is junk or unreadable
 */
function statCandidate(projectDir, projectDirName, file) {
  const filePath = join(projectDir, file);
  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    return null;
  }

  const sessionId = file.replace(/\.jsonl$/, '');
  // the size floor drops empty junk; a session that spawned subagents isn't junk
  if (stat.size < 100 && !existsSync(join(projectDir, sessionId, 'subagents'))) return null;

  // birthtime is filesystem-dependent — a zero or post-mtime value means "unknown"
  const birthtimeMs = stat.birthtimeMs > 0 && stat.birthtimeMs <= stat.mtimeMs ? stat.birthtimeMs : null;
  return { sessionId, projectDirName, projectDir, filePath, size: stat.size, mtimeMs: stat.mtimeMs, birthtimeMs };
}

/**
 * discovers sessions by listing the Claude project directories.
 *
 * `sessions-index.json` is deliberately ignored — Claude Code stopped
 * maintaining it, so a directory that still has one would enumerate an old
 * snapshot instead of what is on disk.
 *
 * enumeration is two-phase: stat every transcript (milliseconds), then open
 * only the ones that survive the caller's bounds. Reading a first timestamp and
 * first prompt out of every file on disk costs seconds, and callers that want
 * one day or the newest handful should not pay for the whole corpus.
 *
 * The bounds are sound in the direction that matters. A session's last write is
 * always at or after its first message, so `mtimeMs < fromMs` cannot hide a
 * session that started inside the window; likewise its first message is at or
 * after the file's creation, so `birthtimeMs > toMs` cannot hide one either.
 * Neither bound is applied exactly — see {@link BOUND_MARGIN_MS}.
 *
 * @param {object} [opts]
 * @param {string} [opts.projectsDir] projects root (default ~/.claude/projects)
 * @param {?number} [opts.fromMs] drop sessions with no activity at or after this
 * @param {?number} [opts.toMs]   drop sessions created after this
 * @param {?number} [opts.limit]  stop after this many, newest first
 * @param {'start'|'activity'} [opts.order='start'] rank by session start or by last write
 * @param {string} [opts.projectContains] keep only projects whose decoded name contains this
 */
export async function discoverSessionsFromDisk(opts = {}) {
  const projectsRoot = resolve(opts.projectsDir || PROJECTS_DIR);
  if (!existsSync(projectsRoot)) return [];

  // matched against the whole directory before any of its files are stat-ed, so
  // that a narrowed listing stays compatible with `limit`
  const needle = opts.projectContains ? opts.projectContains.toLowerCase() : null;

  const candidates = [];
  for (const projectDirName of readdirSync(projectsRoot).sort()) {
    const projectDir = join(projectsRoot, projectDirName);
    try {
      if (!statSync(projectDir).isDirectory()) continue;
    } catch {
      continue;
    }
    if (needle && !decodeProjectName(projectDirName).toLowerCase().includes(needle)) continue;

    for (const file of readdirSync(projectDir).sort()) {
      if (!file.endsWith('.jsonl') || file.startsWith('agent-')) continue;
      const candidate = statCandidate(projectDir, projectDirName, file);
      if (!candidate) continue;
      if (opts.fromMs != null && candidate.mtimeMs < opts.fromMs - BOUND_MARGIN_MS) continue;
      if (opts.toMs != null && candidate.birthtimeMs != null && candidate.birthtimeMs > opts.toMs + BOUND_MARGIN_MS) continue;
      candidates.push(candidate);
    }
  }

  const rank = opts.order === 'activity'
    ? candidate => candidate.mtimeMs
    : candidate => candidate.birthtimeMs ?? candidate.mtimeMs;
  candidates.sort((a, b) => rank(b) - rank(a));

  // the stat-level rank only approximates the in-file timestamp, so over-fetch
  // and let the exact sort below decide which rows actually make the cut
  const shortlist = opts.limit ? candidates.slice(0, Math.max(opts.limit * 3, opts.limit + 25)) : candidates;

  const sessions = [];
  for (const candidate of shortlist) {
    const timestamp = await getTimestampFromJsonl(candidate.filePath);
    sessions.push({
      sessionId: candidate.sessionId,
      project: decodeProjectName(candidate.projectDirName),
      projectDir: candidate.projectDirName,
      summary: '',
      firstPrompt: await extractFirstUserMessage(candidate.filePath),
      timestamp,
      date: timestamp ? timestamp.slice(0, 10) : 'unknown',
      filePath: candidate.filePath,
      mtimeMs: candidate.mtimeMs,
      subagents: collectSubagents(candidate.projectDir, candidate.sessionId),
    });
  }

  // re-sort on the exact key now that the files have been read, then cut: the
  // final order has to match `order`, or `limit` would keep the wrong rows.
  // sessionId breaks ties so the result does not depend on stat order —
  // sessions sharing a first-message millisecond do occur
  const exact = opts.order === 'activity'
    ? (a, b) => b.mtimeMs - a.mtimeMs || a.sessionId.localeCompare(b.sessionId)
    : (a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')) || a.sessionId.localeCompare(b.sessionId);
  sessions.sort(exact);
  return opts.limit ? sessions.slice(0, opts.limit) : sessions;
}

/** @deprecated enumeration no longer reads sessions-index.json — use {@link discoverSessionsFromDisk}. */
export const discoverSessionsFromIndex = discoverSessionsFromDisk;

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

/**
 * discovers sessions, merging on-disk enumeration with history timestamps when
 * a date range is given.
 *
 * @param {object} [opts]
 * @param {string} [opts.projectsDir] projects root (default ~/.claude/projects)
 * @param {string} [opts.from] inclusive start date, YYYY-MM-DD
 * @param {string} [opts.to]   inclusive end date, YYYY-MM-DD
 * @param {?number} [opts.limit] cap on sessions enumerated, newest first
 * @param {'start'|'activity'} [opts.order] ranking used when `limit` applies
 */
export async function discoverSessions(opts = {}) {
  const projectFilter = !opts.global && opts.project ? resolve(opts.project) : null;
  const fromMs = opts.from ? new Date(`${opts.from}T00:00:00`).getTime() : null;
  const toMs = opts.to ? new Date(`${opts.to}T23:59:59.999`).getTime() + 1 : null;

  // the date range bounds the disk walk rather than filtering its result — the
  // walk is the expensive half, and a range the caller already stated is free
  // information about which transcripts are worth opening
  const diskSessions = await discoverSessionsFromDisk({
    projectsDir: opts.projectsDir,
    fromMs,
    toMs,
    limit: opts.limit,
    order: opts.order,
  });
  const byId = new Map(diskSessions.map(session => [session.sessionId, session]));

  if (opts.from || opts.to) {
    const historySessions = await discoverSessionsFromHistory(fromMs, toMs, projectFilter);

    return historySessions.map(session => {
      const onDisk = byId.get(session.sessionId);
      return {
        ...session,
        summary: onDisk?.summary || session.summary || '',
        firstPrompt: onDisk?.firstPrompt || session.firstPrompt || '',
        timestamp: session.timestamp || onDisk?.timestamp || null,
        date: (session.timestamp || onDisk?.timestamp || '').slice(0, 10) || 'unknown',
        filePath: session.filePath || onDisk?.filePath || null,
        subagents: onDisk?.subagents ?? [],
      };
    });
  }

  return diskSessions.filter(session => projectMatches(session, projectFilter));
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
 *
 * accepts the same `projectsDir` override as {@link discoverSessions}.
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
