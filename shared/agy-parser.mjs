#!/usr/bin/env node

/**
 * shared Antigravity CLI (`agy`) conversation discovery and parsing utilities.
 *
 * agy keeps one directory per conversation under
 * `~/.gemini/antigravity-cli/brain/<conversation-id>/` and writes a JSONL
 * transcript there as it goes, so the same read-only peeking that works on a
 * Claude Code session works here too.
 *
 * the parser mirrors {@link ../shared/cc-parser.mjs parseSessionFile}'s record:
 *   { sessionId, kind: 'agy', project, date, aiTitle, filePath,
 *     messages: [ { seq, role, ts, text, tools?, thinking? } ] }
 * with one addition — agy logs tool *results* as their own steps, so a message
 * may have `role: 'result'`, which Claude Code transcripts never produce.
 */

import { existsSync, readFileSync, readdirSync, readlinkSync, statSync } from 'fs';
import { createReadStream } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createInterface } from 'readline';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export const AGY_HOME = process.env.AGY_HOME || join(homedir(), '.gemini', 'antigravity-cli');
const BRAIN_DIR = join(AGY_HOME, 'brain');
const PRESENCE_DIR = join(AGY_HOME, 'presence');
const ANNOTATIONS_DIR = join(AGY_HOME, 'annotations');
const CONVERSATIONS_DIR = join(AGY_HOME, 'conversations');

const DEFAULT_MAX_MESSAGE_LENGTH = 5000;

function truncate(text, maxLength = DEFAULT_MAX_MESSAGE_LENGTH) {
  if (!text) return text;
  if (!maxLength || maxLength === Infinity || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/**
 * the transcript a conversation is writing to. `transcript_full.jsonl` carries
 * the untruncated bodies; `transcript.jsonl` is the same steps with long fields
 * clipped, and is the fallback for older conversations that only have that one.
 */
export function agyTranscriptPath(conversationId) {
  const logs = join(BRAIN_DIR, conversationId, '.system_generated', 'logs');
  for (const name of ['transcript_full.jsonl', 'transcript.jsonl']) {
    const path = join(logs, name);
    if (existsSync(path)) return path;
  }
  return null;
}

/** the title agy generated for a conversation, if it has got round to naming it. */
export function agyTitle(conversationId) {
  const path = join(ANNOTATIONS_DIR, `${conversationId}.pbtxt`);
  if (!existsSync(path)) return null;
  const match = readFileSync(path, 'utf8').match(/title:"((?:[^"\\]|\\.)*)"/);
  return match ? match[1].replace(/\\(.)/g, '$1') : null;
}

/**
 * the workspace a conversation was opened against.
 *
 * it lives in a protobuf blob in the conversation's SQLite file. rather than
 * decode the protobuf, lift the file:// URI straight out of the blob's bytes:
 * the field is a plain string and nothing else in that one small row looks like
 * a path. reading the row (rather than scanning the whole database file) is
 * what keeps stale copies on freed pages out of the answer.
 */
export function agyWorkspace(conversationId) {
  const blob = trajectoryMetadataBlob(conversationId);
  if (!blob) return null;
  const text = blob.toString('latin1');
  for (const uri of text.match(/file:\/\/\/[A-Za-z0-9_.\-\/]+/g) || []) {
    const dir = uri.slice('file://'.length);
    if (dir.startsWith(AGY_HOME)) continue; // agy's own scratch and log paths
    return dir;
  }
  return null;
}

let sqlite;

/** reads the single `trajectory_metadata_blob` row, read-only and lock-free. */
function trajectoryMetadataBlob(conversationId) {
  const path = join(CONVERSATIONS_DIR, `${conversationId}.db`);
  if (!existsSync(path)) return null;
  try {
    if (!sqlite) {
      // node:sqlite is stable enough for one SELECT but still warns on import
      process.removeAllListeners('warning');
      process.on('warning', () => {});
      sqlite = require('node:sqlite');
    }
    // readOnly keeps this safe against the conversation agy is writing right now
    const db = new sqlite.DatabaseSync(path, { readOnly: true });
    try {
      const row = db.prepare('SELECT data FROM trajectory_metadata_blob LIMIT 1').get();
      return row?.data ? Buffer.from(row.data) : null;
    } finally {
      db.close();
    }
  } catch {
    return null; // no sqlite in this node, or the file is mid-write
  }
}

const USER_REQUEST = /<USER_REQUEST>\n?([\s\S]*?)\n?<\/USER_REQUEST>/;
const NOISE_BLOCKS = [
  /<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g,
  /<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/g,
];

/** lifts the human's actual words out of the envelope agy wraps them in. */
function cleanUserInput(content) {
  if (!content) return '';
  let text = content;
  for (const block of NOISE_BLOCKS) text = text.replace(block, '');
  const match = text.match(USER_REQUEST);
  return (match ? match[1] : text).trim();
}

const RESULT_BOILERPLATE = [
  /^Created At: \S+\n/,
  /^Completed At: \S+\n/,
  /The following code has been modified to include a line number.*?\n/s,
];

/** strips the fixed preamble agy prepends to every tool result. */
function cleanResult(content) {
  if (!content) return '';
  let text = content;
  for (const pattern of RESULT_BOILERPLATE) text = text.replace(pattern, '');
  return text.trim();
}

const SYSTEM_PREAMBLE = /^The following is a <SYSTEM_MESSAGE>[^\n]*\n+/;

/** system steps arrive wrapped in a preamble and a tag; both are constant. */
function cleanSystem(content) {
  if (!content) return '';
  return content
    .replace(SYSTEM_PREAMBLE, '')
    .replace(/<\/?SYSTEM_MESSAGE>/g, '')
    .trim();
}

/**
 * agy JSON-encodes each argument value, so `"CommandLine": "\"sleep 8\""`.
 * unwrap one layer where it parses, leave anything else as the raw string.
 */
function decodeArgs(args) {
  const out = {};
  for (const [key, value] of Object.entries(args || {})) {
    if (typeof value !== 'string') { out[key] = value; continue; }
    try { out[key] = JSON.parse(value); } catch { out[key] = value; }
  }
  return out;
}

/**
 * parses a conversation's transcript into the peek message shape.
 *
 * @param {string} conversationId
 * @param {{maxLength?: number, includeThinking?: boolean, includeResults?: boolean}} [opts]
 */
export async function parseAgySession(conversationId, opts = {}) {
  const {
    maxLength = DEFAULT_MAX_MESSAGE_LENGTH,
    includeThinking = false,
    includeResults = true,
  } = opts;

  const filePath = agyTranscriptPath(conversationId);
  if (!filePath) return null;

  const result = {
    sessionId: conversationId,
    kind: 'agy',
    project: agyWorkspace(conversationId),
    date: null,
    branch: null,
    model: null,
    aiTitle: agyTitle(conversationId),
    filePath,
    messages: [],
  };

  const rl = createInterface({ input: createReadStream(filePath) });
  for await (const line of rl) {
    let step;
    try { step = JSON.parse(line); } catch { continue; }

    const ts = step.created_at || null;
    if (!result.date && ts) result.date = ts.slice(0, 10);
    const seq = step.step_index;

    if (step.type === 'USER_INPUT') {
      const text = cleanUserInput(step.content);
      if (text) result.messages.push({ seq, role: 'user', ts, text: truncate(text, maxLength) });
      continue;
    }

    if (step.source === 'SYSTEM') {
      const text = cleanSystem(step.content);
      if (text) result.messages.push({ seq, role: 'system', ts, text: truncate(text, maxLength), kind: step.type });
      continue;
    }

    // a MODEL step is either the model's turn (prose, thinking, tool calls) or,
    // when it carries no tool calls of its own, the result of the previous one
    const tools = (step.tool_calls || []).map(t => ({ name: t.name, input: decodeArgs(t.args) }));
    if (step.type === 'GENERIC' && !tools.length) {
      if (!includeResults) continue;
      const text = cleanResult(step.content);
      result.messages.push({ seq, role: 'result', ts, text: truncate(text, maxLength), status: step.status });
      continue;
    }

    const text = (step.content || '').trim();
    const thinking = includeThinking ? (step.thinking || '').trim() : '';
    if (!text && !tools.length && !thinking) continue;
    const msg = { seq, role: 'assistant', ts, text: truncate(text, maxLength), status: step.status };
    if (tools.length) msg.tools = tools;
    if (thinking) msg.thinking = truncate(thinking, maxLength);
    result.messages.push(msg);
  }

  return result;
}

/** one-line summary of an agy tool call, keyed on the arguments that identify it. */
export function agyToolLine(tool, maxLength = 160) {
  const input = tool.input || {};
  const range = input.StartLine != null ? ` (${input.StartLine}-${input.EndLine ?? ''})` : '';
  let detail;
  switch (tool.name) {
    case 'run_command': detail = String(input.CommandLine || '').replace(/\s+/g, ' '); break;
    case 'view_file': detail = `${input.AbsolutePath || ''}${range}`; break;
    case 'write_to_file': detail = input.TargetFile || ''; break;
    case 'replace_file_content': detail = `${input.TargetFile || ''} — ${input.Instruction || ''}`; break;
    case 'list_dir': detail = input.DirectoryPath || ''; break;
    case 'grep_search': detail = `${input.Query || ''} in ${input.SearchPath || ''}`; break;
    case 'find_by_name': detail = `${input.Pattern || ''} in ${input.SearchDirectory || ''}`; break;
    case 'search_web': detail = input.query || ''; break;
    case 'read_url_content': detail = input.Url || ''; break;
    case 'generate_image': detail = `${input.ImageName || ''} ${input.AspectRatio || ''}`; break;
    case 'manage_task': detail = `${input.Action || ''} ${input.TaskId || ''}`; break;
    case 'send_message': detail = `${input.Recipient || ''}: ${input.Message || ''}`; break;
    case 'schedule': detail = input.Prompt || ''; break;
    default: {
      const { toolAction, toolSummary, ...rest } = input;
      detail = Object.keys(rest).length ? JSON.stringify(rest) : String(toolAction || toolSummary || '');
    }
  }
  return `  → ${tool.name}: ${truncate(detail, maxLength)}`;
}

/**
 * every agy conversation on disk, newest activity first.
 *
 * @param {{projectContains?: string, limit?: number}} [opts]
 */
export function discoverAgySessions(opts = {}) {
  const { projectContains, limit = 15 } = opts;
  if (!existsSync(BRAIN_DIR)) return [];

  const sessions = [];
  for (const entry of readdirSync(BRAIN_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const filePath = agyTranscriptPath(entry.name);
    if (!filePath) continue;
    try {
      sessions.push({ sessionId: entry.name, kind: 'agy', filePath, mtimeMs: statSync(filePath).mtimeMs });
    } catch { /* vanished mid-scan */ }
  }

  sessions.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const out = [];
  for (const session of sessions) {
    // titles and workspaces are one file read each, so only pay for candidates
    session.project = agyWorkspace(session.sessionId);
    if (projectContains && !(session.project || '').includes(projectContains)) continue;
    session.aiTitle = agyTitle(session.sessionId);
    out.push(session);
    if (out.length >= limit) break;
  }
  return out;
}

const PRESENCE_LOCK = /\/presence\/([0-9a-f-]{36})\.lock$/;

/**
 * agy conversations running right now, oldest first.
 *
 * a running `agy` holds an flock on `presence/<conversation-id>.lock` for its
 * whole life, so the process's own file descriptors name the conversation it is
 * driving. that is an exact join — no start-time window to guess at, unlike the
 * Claude Code side.
 */
export function liveAgySessions() {
  const procs = [];
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      if (readFileSync(`/proc/${entry}/comm`, 'utf8').trim() !== 'agy') continue;
      let sessionId = null;
      for (const fd of readdirSync(`/proc/${entry}/fd`)) {
        const target = readlinkSync(`/proc/${entry}/fd/${fd}`);
        const match = target.match(PRESENCE_LOCK);
        if (match) { sessionId = match[1]; break; }
      }
      const argv = readFileSync(`/proc/${entry}/cmdline`, 'utf8').split('\0');
      const modelIdx = argv.indexOf('--model');
      procs.push({
        kind: 'agy',
        pid: Number(entry),
        sessionId,
        cwd: readlinkSync(`/proc/${entry}/cwd`),
        model: modelIdx >= 0 ? argv[modelIdx + 1] : null,
        headless: argv.includes('-p') || argv.includes('--print'),
        startMs: statSync(`/proc/${entry}`).ctimeMs,
      });
    } catch { /* vanished mid-scan, or not ours to read */ }
  }
  return procs.sort((a, b) => a.startMs - b.startMs);
}
