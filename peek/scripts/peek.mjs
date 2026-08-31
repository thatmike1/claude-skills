#!/usr/bin/env node

/**
 * peek — read another Claude Code session's transcript without leaving a mark.
 *
 * built for the coach/driver workflow: a "backstage" session reads what the
 * "driver" session did (prompts, replies, tool calls) straight from the jsonl
 * on disk. purely read-only; the observed session never knows.
 *
 * usage:
 *   node peek.mjs live                           sessions running right now
 *   node peek.mjs list [projectFilter] [-n 15]   recent sessions, newest first
 *   node peek.mjs <session-id> [options]         render a session
 *
 * options:
 *   --since N     only messages with seq >= N (incremental polling cursor)
 *   --last N      only the last N messages
 *   --thinking    include assistant thinking blocks
 *   --max N       per-message truncation length (default 3000, 0 = unlimited)
 *
 * every render ends with a `next: --since <n>` line — pass it back on the
 * next call to get only what happened since.
 */

import { existsSync, readFileSync, readdirSync, readlinkSync, statSync } from 'fs';
import { homedir } from 'os';
import { findSessionFile, parseSessionFile, discoverSessionsFromDisk, truncateText } from '../../shared/cc-parser.mjs';

// piping into `head` closes stdout early; that is not an error worth a stack trace
process.stdout.on('error', err => { if (err.code === 'EPIPE') process.exit(0); });

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { _: [], since: null, last: null, thinking: false, max: 3000, n: 15 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--since') args.since = Number(argv[++i]);
    else if (a === '--last') args.last = Number(argv[++i]);
    else if (a === '--thinking') args.thinking = true;
    else if (a === '--max') args.max = Number(argv[++i]);
    else if (a === '-n') args.n = Number(argv[++i]);
    else args._.push(a);
  }
  return args;
}

/** one-line summary of a tool call, keyed on the inputs that identify it. */
function toolLine(tool) {
  const input = tool.input || {};
  let detail = '';
  switch (tool.name) {
    case 'Bash':
      detail = input.description || (input.command || '').replace(/\s+/g, ' ');
      break;
    case 'Read':
    case 'Write':
    case 'Edit':
      detail = input.file_path || '';
      break;
    case 'Glob':
    case 'Grep':
      detail = input.pattern || '';
      break;
    case 'Agent':
      detail = input.description || '';
      break;
    case 'WebSearch':
      detail = input.query || '';
      break;
    case 'WebFetch':
      detail = input.url || '';
      break;
    case 'TodoWrite':
      detail = (input.todos || []).map(t => t.content).join(' | ');
      break;
    default:
      detail = JSON.stringify(input);
  }
  return `  → ${tool.name}: ${truncateText(detail, 160)}`;
}

async function cmdList(projectFilter, n) {
  // rank by last activity rather than session start, so a session resumed today
  // floats to the top; the bounds keep this from opening all ~2k transcripts
  const sessions = await discoverSessionsFromDisk({
    projectContains: projectFilter,
    order: 'activity',
    limit: n,
  });
  for (const s of sessions) {
    const when = s.mtimeMs ? new Date(s.mtimeMs).toISOString().slice(0, 16).replace('T', ' ') : '?';
    const title = truncateText((s.firstPrompt || '').replace(/\s+/g, ' '), 60);
    console.log(`${s.sessionId}  ${when}  ${s.project || '?'}${title ? `  "${title}"` : ''}`);
  }
  if (!sessions.length) console.log('no sessions found');
}

async function cmdShow(sessionId, args) {
  const filePath = findSessionFile(sessionId);
  if (!filePath) fail(`session not found: ${sessionId}`);

  const parsed = await parseSessionFile(filePath, {
    maxLength: args.max || Infinity,
    includeThinking: args.thinking,
  });

  let messages = parsed.messages;
  if (args.since != null) messages = messages.filter(m => m.seq >= args.since);
  if (args.last != null) messages = messages.slice(-args.last);

  const header = [parsed.aiTitle && `"${parsed.aiTitle}"`, parsed.project, parsed.branch && `branch:${parsed.branch}`, parsed.model]
    .filter(Boolean).join('  ');
  console.log(`# ${parsed.sessionId}  ${header}\n`);

  if (!messages.length) {
    console.log(args.since != null ? '(nothing new)' : '(no messages)');
  }

  for (const msg of messages) {
    const who = msg.role === 'user' ? 'USER' : 'CLAUDE';
    console.log(`[${msg.seq}] ${who}${msg.ts ? `  ${msg.ts.slice(11, 16)}` : ''}`);
    if (msg.thinking) console.log(`  (thinking) ${msg.thinking}`);
    if (msg.text) console.log(msg.text.split('\n').map(l => `  ${l}`).join('\n'));
    for (const tool of msg.tools || []) console.log(toolLine(tool));
    console.log('');
  }

  const lastSeq = parsed.messages.length ? parsed.messages[parsed.messages.length - 1].seq : -1;
  console.log(`# next: --since ${lastSeq + 1}`);
}

const SESSION_ENV = `${homedir()}/.claude/session-env`;
const PROC_MATCH_WINDOW_MS = 15_000;

/** live `claude` processes, oldest first. /proc/<pid> ctime is the process start time. */
function liveClaudeProcs() {
  const procs = [];
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      if (readFileSync(`/proc/${entry}/comm`, 'utf8').trim() !== 'claude') continue;
      procs.push({
        pid: Number(entry),
        cwd: readlinkSync(`/proc/${entry}/cwd`),
        startMs: statSync(`/proc/${entry}`).ctimeMs,
      });
    } catch { /* vanished mid-scan, or not ours to read */ }
  }
  return procs.sort((a, b) => a.startMs - b.startMs);
}

/** session-env dirs are named by session id; the dir's mtime is when that session started. */
function recentSessionEnvEntries(sinceMs) {
  const entries = [];
  for (const dir of readdirSync(SESSION_ENV, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    try {
      const startMs = statSync(`${SESSION_ENV}/${dir.name}`).mtimeMs;
      if (startMs >= sinceMs) entries.push({ sessionId: dir.name, startMs });
    } catch { /* ignore */ }
  }
  return entries;
}

/**
 * the SessionStart hook records the transcript path it is actually writing to.
 * a `--resume` session gets a fresh session-env dir but keeps the resumed
 * transcript, so the dir name alone points at a file that does not exist.
 */
function transcriptFor(sessionId) {
  const hook = `${SESSION_ENV}/${sessionId}/sessionstart-hook-1.sh`;
  if (existsSync(hook)) {
    const match = readFileSync(hook, 'utf8').match(/TRANSCRIPT_PATH='([^']+)'/);
    if (match && existsSync(match[1])) return match[1];
  }
  const fallback = findSessionFile(sessionId);
  return fallback && existsSync(fallback) ? fallback : null;
}

function hhmm(ms) {
  return new Date(ms).toTimeString().slice(0, 5);
}

/** jsonl timestamps are UTC — render them local so they line up with `started`. */
function localHhmm(ts) {
  return ts ? hhmm(Date.parse(ts)) : '     ';
}

function ago(ms) {
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}m`;
}

/**
 * pair each live process with its session by start time — the two clocks agree
 * to within a couple of seconds — and read the tail of each transcript.
 */
async function cmdLive(args) {
  const procs = liveClaudeProcs();
  if (!procs.length) return console.log('no live claude sessions');

  const unclaimed = recentSessionEnvEntries(procs[0].startMs - PROC_MATCH_WINDOW_MS);
  const rows = [];

  for (const proc of procs) {
    let best = null;
    for (const entry of unclaimed) {
      const drift = Math.abs(entry.startMs - proc.startMs);
      if (drift > PROC_MATCH_WINDOW_MS) continue;
      if (!best || drift < Math.abs(best.startMs - proc.startMs)) best = entry;
    }
    if (best) unclaimed.splice(unclaimed.indexOf(best), 1);
    rows.push({ ...proc, sessionId: best?.sessionId ?? null });
  }

  console.log(`# ${rows.length} live sessions  ·  ${hhmm(Date.now())}  ·  oldest first\n`);

  for (const [i, row] of rows.entries()) {
    const project = row.cwd.split('/').pop();
    const path = row.sessionId ? transcriptFor(row.sessionId) : null;
    const self = path && path === process.env.CODEX_COMPANION_TRANSCRIPT_PATH ? '  (this session)' : '';
    const idle = path ? ago(statSync(path).mtimeMs) : '?';

    console.log(`[${i + 1}] ${project}  ·  started ${hhmm(row.startMs)}  ·  quiet ${idle}  ·  pid ${row.pid}${self}`);
    console.log(`    ${row.cwd}`);

    if (!path) {
      console.log(`    (no transcript found${row.sessionId ? ` for ${row.sessionId}` : ' — unmatched process'})\n`);
      continue;
    }
    console.log(`    peek: ${row.sessionId}`);

    const parsed = await parseSessionFile(path, { maxLength: 400 });
    if (parsed.aiTitle) console.log(`    "${parsed.aiTitle}"`);

    const lastUser = [...parsed.messages].reverse().find(m => m.role === 'user' && m.text);
    const lastClaude = [...parsed.messages].reverse().find(m => m.role !== 'user' && (m.text || m.tools?.length));
    const flat = t => truncateText((t || '').replace(/\s+/g, ' '), args.max);

    if (lastUser) console.log(`    you   ${localHhmm(lastUser.ts)}  ${flat(lastUser.text)}`);
    if (lastClaude) {
      const tools = (lastClaude.tools || []).map(t => t.name).join(', ');
      console.log(`    cc    ${localHhmm(lastClaude.ts)}  ${flat(lastClaude.text) || `[${tools}]`}`);
    }
    console.log('');
  }

  console.log('# ListAgents gives the SendMessage name for each of these. Zip them per');
  console.log('# project in this same start order — the tool reports start age, not id.');
}

const args = parseArgs(process.argv.slice(2));
const [first, second] = args._;

if (!first) fail('usage: peek.mjs live | peek.mjs list [projectFilter] | peek.mjs <session-id> [--since N] [--last N] [--thinking]');
if (first === 'live') await cmdLive({ ...args, max: args.max === 3000 ? 150 : args.max });
else if (first === 'list') await cmdList(second, args.n);
else await cmdShow(first, args);
