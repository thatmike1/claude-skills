#!/usr/bin/env node

/**
 * shared Codex conversation discovery and parsing utilities.
 *
 * two readers live here. the date-range one ({@link discoverCodexSessions})
 * feeds the morning digest with flat message lists. the peek-shaped one
 * ({@link parseCodexTranscript}) mirrors {@link ../shared/cc-parser.mjs
 * parseSessionFile}'s record so peek can render a Codex rollout like any other
 * session:
 *   { sessionId, kind: 'codex', project, date, branch, model, aiTitle, filePath,
 *     messages: [ { seq, role, ts, text, tools?, thinking? } ] }
 * a rollout logs tool outputs as their own items, so like agy a message may
 * have `role: 'result'`. `seq` is the line index, which is what makes it a
 * stable `--since` cursor on a file that is still being appended to.
 */

import { createReadStream, existsSync, openSync, readSync, closeSync, readdirSync, readFileSync, readlinkSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

// Codex itself honours CODEX_HOME, so a test can point both at a fixture
export const CODEX_HOME = process.env.CODEX_HOME || join(homedir(), '.codex');
const SESSIONS_DIR = join(CODEX_HOME, 'sessions');
const INDEX_FILE = join(CODEX_HOME, 'session_index.jsonl');
const SUMMARIES_DIR = join(CODEX_HOME, 'memories', 'rollout_summaries');
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


// ---------------------------------------------------------------------------
// peek-shaped reader
// ---------------------------------------------------------------------------

/** rollouts are named `rollout-<timestamp>-<session-uuid>.jsonl`. */
const ROLLOUT_NAME = /^rollout-.*-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/;

function listDir(dir) {
  try { return readdirSync(dir); } catch { return []; }
}

/** every `sessions/YYYY/MM/DD` directory on disk, newest day first. */
function* dayDirsNewestFirst() {
  const desc = dir => listDir(dir).filter(n => /^\d+$/.test(n)).sort((a, b) => b.localeCompare(a));
  for (const y of desc(SESSIONS_DIR)) {
    for (const m of desc(join(SESSIONS_DIR, y))) {
      for (const d of desc(join(SESSIONS_DIR, y, m))) yield join(SESSIONS_DIR, y, m, d);
    }
  }
}

/**
 * the rollout file a session id is writing to, or null.
 *
 * the id is in the file name, so this never opens a file; it walks the date
 * directories newest first because the session being asked about is almost
 * always a recent one.
 */
export function codexRolloutPath(sessionId) {
  if (!sessionId) return null;
  for (const dir of dayDirsNewestFirst()) {
    for (const name of listDir(dir)) {
      if (ROLLOUT_NAME.test(name) && name.includes(sessionId)) return join(dir, name);
    }
  }
  return null;
}

/**
 * the `session_meta` record, read off the head of the file without streaming
 * the rest. it is the first line in every rollout seen so far; the scan allows
 * a few lines of slack in case a future version puts something above it.
 */
export function readCodexSessionMeta(filePath) {
  let fd;
  try {
    fd = openSync(filePath, 'r');
    const buf = Buffer.alloc(64 * 1024);
    const n = readSync(fd, buf, 0, buf.length, 0);
    for (const line of buf.toString('utf8', 0, n).split('\n').slice(0, 5)) {
      try {
        const rec = JSON.parse(line);
        if (rec.type === 'session_meta') {
          const p = rec.payload || {};
          return {
            sessionId: p.id || null,
            cwd: p.cwd || null,
            branch: p.git?.branch || null,
            timestamp: p.timestamp || rec.timestamp || null,
            source: p.source || null,
          };
        }
      } catch { /* a partial last line inside the window, or not json */ }
    }
  } catch {
    return null;
  } finally {
    if (fd != null) closeSync(fd);
  }
  return null;
}

/** joins the `output_text` blocks of an assistant message. */
function assistantText(content) {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .filter(b => b && (b.type === 'output_text' || b.type === 'text') && b.text)
    .map(b => b.text)
    .join('\n')
    .trim();
}

/**
 * a tool's arguments arrive as a JSON string inside the JSON record; unwrap
 * that one layer where it parses and keep the raw string where it does not.
 */
function decodeArguments(args) {
  if (args == null) return {};
  if (typeof args !== 'string') return args;
  try {
    const parsed = JSON.parse(args);
    return parsed && typeof parsed === 'object' ? parsed : { value: parsed };
  } catch {
    return { raw: args };
  }
}

/**
 * a shell result is usually `{"output": "...", "metadata": {"exit_code": 0}}`
 * serialised into the `output` string; lift the text and the exit code out.
 */
function decodeOutput(output) {
  if (output == null) return '';
  if (typeof output !== 'string') return JSON.stringify(output);
  try {
    const parsed = JSON.parse(output);
    if (parsed && typeof parsed === 'object' && typeof parsed.output === 'string') {
      const code = parsed.metadata?.exit_code;
      const text = parsed.output.trim();
      return code != null && code !== 0 ? `${text}\n[exit ${code}]` : text;
    }
  } catch { /* plain text */ }
  return output.trim();
}

/** the tool call carried by one response item, or null when it is not one. */
function toolOf(p) {
  switch (p.type) {
    case 'function_call':
      return { name: p.name || 'function', input: decodeArguments(p.arguments) };
    case 'local_shell_call':
      return { name: 'shell', input: { command: p.action?.command, workdir: p.action?.working_directory } };
    case 'custom_tool_call':
      return { name: p.name || 'custom_tool', input: { input: p.input } };
    case 'web_search_call':
      return { name: 'web_search', input: { query: p.action?.query } };
    default:
      return null;
  }
}

const RESULT_TYPES = new Set(['function_call_output', 'custom_tool_call_output', 'local_shell_call_output']);

/**
 * parses a rollout into the peek message shape.
 *
 * the ordered conversation is the `response_item` stream: user and assistant
 * messages, reasoning summaries, tool calls and their outputs. `event_msg`
 * records are Codex's UI feed and mostly duplicate it, so they are ignored,
 * with one exception: a rollout whose assistant turns only exist as
 * `agent_message` events (older versions) falls back to those.
 *
 * @param {string} sessionId
 * @param {{maxLength?: number, includeThinking?: boolean, includeResults?: boolean}} [opts]
 */
export async function parseCodexTranscript(sessionId, opts = {}) {
  const {
    maxLength = DEFAULT_MAX_MESSAGE_LENGTH,
    includeThinking = false,
    includeResults = true,
  } = opts;
  const clip = text => (!maxLength || maxLength === Infinity) ? text : truncateText(text, maxLength);

  const filePath = codexRolloutPath(sessionId);
  if (!filePath) return null;

  const result = {
    sessionId,
    kind: 'codex',
    project: null,
    date: null,
    branch: null,
    model: null,
    aiTitle: loadSessionIndex().get(sessionId) || null,
    filePath,
    messages: [],
  };

  const agentEvents = [];
  let sawAssistantItem = false;
  let seq = -1;

  const rl = createInterface({ input: createReadStream(filePath) });
  for await (const line of rl) {
    seq++;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    const ts = rec.timestamp || null;
    const p = rec.payload || {};

    if (rec.type === 'session_meta') {
      result.sessionId = p.id || sessionId;
      result.project = p.cwd || null;
      result.branch = p.git?.branch || null;
      result.date = (p.timestamp || ts || '').slice(0, 10) || null;
      continue;
    }

    // one per turn; the model can change mid-session, the last one wins
    if (rec.type === 'turn_context') {
      if (p.model) result.model = p.model;
      if (p.cwd && !result.project) result.project = p.cwd;
      continue;
    }

    if (rec.type === 'event_msg') {
      if (p.type === 'agent_message' && p.message?.trim()) {
        agentEvents.push({ seq, role: 'assistant', ts, text: clip(p.message.trim()) });
      }
      continue;
    }

    if (rec.type !== 'response_item') continue;

    if (p.type === 'message') {
      if (p.role === 'user') {
        if (!isRealUserMessage(p.content)) continue;
        const text = extractUserText(p.content);
        if (text) result.messages.push({ seq, role: 'user', ts, text: clip(text) });
      } else if (p.role === 'assistant') {
        const text = assistantText(p.content);
        if (!text) continue;
        sawAssistantItem = true;
        result.messages.push({ seq, role: 'assistant', ts, text: clip(text) });
      }
      continue;
    }

    // reasoning bodies are encrypted; only the summary is readable
    if (p.type === 'reasoning') {
      if (!includeThinking) continue;
      const thinking = (p.summary || []).map(s => s?.text || '').filter(Boolean).join('\n').trim();
      if (thinking) result.messages.push({ seq, role: 'assistant', ts, text: '', thinking: clip(thinking) });
      continue;
    }

    const tool = toolOf(p);
    if (tool) {
      sawAssistantItem = true;
      result.messages.push({ seq, role: 'assistant', ts, text: '', tools: [tool] });
      continue;
    }

    if (RESULT_TYPES.has(p.type)) {
      if (!includeResults) continue;
      result.messages.push({ seq, role: 'result', ts, text: clip(decodeOutput(p.output)) });
    }
  }

  if (!sawAssistantItem && agentEvents.length) {
    result.messages.push(...agentEvents);
    result.messages.sort((a, b) => a.seq - b.seq);
  }

  return result;
}

/** one-line summary of a Codex tool call, keyed on the argument that identifies it. */
export function codexToolLine(tool, maxLength = 160) {
  const input = tool.input || {};
  const command = c => (Array.isArray(c) ? c.join(' ') : String(c || '')).replace(/\s+/g, ' ');
  let detail;
  switch (tool.name) {
    case 'shell':
    case 'container.exec':
      detail = command(input.command);
      break;
    case 'exec_command':
      detail = command(input.cmd);
      break;
    case 'apply_patch': {
      const files = [...String(input.input || input.patch || '').matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)].map(m => m[1]);
      detail = files.join(', ');
      break;
    }
    case 'update_plan':
      detail = (input.plan || []).map(s => s.step).filter(Boolean).join(' | ');
      break;
    case 'web_search':
      detail = input.query || '';
      break;
    case 'view_image':
      detail = input.path || '';
      break;
    default:
      detail = input.raw ?? JSON.stringify(input);
  }
  return `  → ${tool.name}: ${truncateText(detail, maxLength)}`;
}

/** the first thing the human said, for a roster row; bounded so it stays cheap. */
async function firstPromptOf(filePath, maxLines = 200) {
  const rl = createInterface({ input: createReadStream(filePath) });
  let n = 0;
  for await (const line of rl) {
    if (++n > maxLines) break;
    try {
      const rec = JSON.parse(line);
      const p = rec.payload || {};
      if (rec.type === 'response_item' && p.type === 'message' && p.role === 'user' && isRealUserMessage(p.content)) {
        rl.close();
        return extractUserText(p.content);
      }
    } catch { /* skip */ }
  }
  return null;
}

const DISCOVER_DAY_LIMIT = 45;

/**
 * recent Codex sessions on disk, newest activity first.
 *
 * rollouts are filed by the day they started, so this walks the last few
 * weeks of day directories and ranks what it finds by mtime. a session older
 * than that window is out of reach here even if it was resumed today.
 *
 * @param {{projectContains?: string, limit?: number}} [opts]
 */
export async function discoverRecentCodexSessions(opts = {}) {
  const { projectContains, limit = 15 } = opts;
  const files = [];
  let days = 0;
  for (const dir of dayDirsNewestFirst()) {
    if (++days > DISCOVER_DAY_LIMIT) break;
    for (const name of listDir(dir)) {
      const match = name.match(ROLLOUT_NAME);
      if (!match) continue;
      const filePath = join(dir, name);
      try {
        files.push({ sessionId: match[1], kind: 'codex', filePath, mtimeMs: statSync(filePath).mtimeMs });
      } catch { /* vanished mid-scan */ }
    }
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const index = loadSessionIndex();
  const out = [];
  for (const session of files) {
    // the meta line is one small read; only pay for it on candidates
    const meta = readCodexSessionMeta(session.filePath);
    session.project = meta?.cwd || null;
    if (projectContains && !(session.project || '').includes(projectContains)) continue;
    session.aiTitle = index.get(session.sessionId) || null;
    session.firstPrompt = await firstPromptOf(session.filePath);
    out.push(session);
    if (out.length >= limit) break;
  }
  return out;
}

const PROC_MATCH_WINDOW_MS = 15_000;

/** a process's argv, or empty if it is gone or not ours to read. */
function cmdline(pid) {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean);
  } catch {
    return [];
  }
}

/** rollout session ids a process holds open, straight off its file descriptors. */
function openRollouts(pid) {
  const ids = new Set();
  for (const fd of listDir(`/proc/${pid}/fd`)) {
    try {
      const target = readlinkSync(`/proc/${pid}/fd/${fd}`);
      if (!target.startsWith(SESSIONS_DIR)) continue;
      const match = target.split('/').pop().match(ROLLOUT_NAME);
      if (match) ids.add(match[1]);
    } catch { /* closed between readdir and readlink */ }
  }
  return [...ids];
}

/** the session id a process was resumed onto: `codex resume <id>` names it on argv. */
function resumedIdOf(argv) {
  const i = argv.indexOf('resume');
  const next = i >= 0 ? argv[i + 1] : null;
  return next && !next.startsWith('-') ? next : null;
}

/** sessions whose meta timestamp is within the window of a process start; last two days only. */
function sessionStartedNear(startMs) {
  let best = null;
  let days = 0;
  for (const dir of dayDirsNewestFirst()) {
    if (++days > 2) break;
    for (const name of listDir(dir)) {
      const match = name.match(ROLLOUT_NAME);
      if (!match) continue;
      const meta = readCodexSessionMeta(join(dir, name));
      const at = meta?.timestamp ? Date.parse(meta.timestamp) : NaN;
      if (Number.isNaN(at)) continue;
      const drift = Math.abs(at - startMs);
      if (drift <= PROC_MATCH_WINDOW_MS && (!best || drift < best.drift)) best = { sessionId: match[1], drift };
    }
  }
  return best?.sessionId ?? null;
}

/**
 * Codex processes running right now, oldest first.
 *
 * the join to a session is exact when the process holds its rollout open, which
 * shows on its file descriptors; a process serving several threads gets one
 * row per rollout. failing that, `codex resume <id>` names the session on
 * argv, and the last resort is a start-time match against the meta timestamps
 * of the last two days of rollouts, the same window the Claude Code side uses.
 */
export function liveCodexSessions() {
  const rows = [];
  for (const entry of listDir('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    let comm;
    try { comm = readFileSync(`/proc/${entry}/comm`, 'utf8').trim(); } catch { continue; }
    // the npm package ships the native binary as `codex`; older builds carried a platform suffix
    if (!/^codex(-|$)/.test(comm)) continue;
    try {
      const pid = Number(entry);
      const argv = cmdline(pid);
      const modelIdx = argv.findIndex(a => a === '--model' || a === '-m');
      const base = {
        kind: 'codex',
        pid,
        cwd: readlinkSync(`/proc/${pid}/cwd`),
        model: modelIdx >= 0 ? argv[modelIdx + 1] : null,
        headless: argv.includes('exec'),
        appServer: argv.includes('app-server'),
        startMs: statSync(`/proc/${pid}`).ctimeMs,
      };
      const open = openRollouts(pid);
      if (open.length) {
        for (const sessionId of open) rows.push({ ...base, sessionId });
      } else {
        rows.push({ ...base, sessionId: resumedIdOf(argv) || sessionStartedNear(base.startMs) });
      }
    } catch { /* vanished mid-scan, or not ours to read */ }
  }
  return rows.sort((a, b) => a.startMs - b.startMs);
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
