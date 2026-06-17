#!/usr/bin/env node

/**
 * scans Claude Code conversations and emits structured output the skill reasons
 * over. three modes:
 *   - search:  --search <query>   targeted keyword/regex lookup, returns full
 *              matching messages with context (see cc-search.mjs)
 *   - index:   --index            lightweight session list (decide what to load)
 *   - digest:  default            per-session markdown digest; auto-switches to
 *              an index when the range is large, to avoid context bloat
 *
 * usage:
 *   node scan.mjs [when] [--project <path>] [--global] [--full]
 *   node scan.mjs --search "<query>" [--scope messages|actions|all] [--regex] [--context N] [--limit N]
 *   node scan.mjs [when] --index [--deep]
 *   node scan.mjs --sessions <id,id,...> [--full]
 *
 * when (positional, default "today"): today | yesterday | 3days | week | Ndays | YYYY-MM-DD
 */

import { resolve } from 'path';
import { discoverSessions, parseSessionFile, buildIndex } from '../../shared/cc-parser.mjs';
import { searchSessions, formatHits } from '../../shared/cc-search.mjs';
import { toMarkdown } from '../../shared/cc-format.mjs';

const DEFAULT_MSG_LENGTH = 500;
const FULL_MSG_LENGTH = Infinity;
const MAX_USER_MSGS = 20;
const MAX_ASSISTANT_MSGS = 12;
// above this many sessions, the default digest auto-switches to an index
const DIGEST_SESSION_LIMIT = 12;

/** formats a Date as local YYYY-MM-DD. */
function fmt(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** resolves a "when" keyword into a {from, to, label} date range. */
function resolveRange(when) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (/^\d{4}-\d{2}-\d{2}$/.test(when)) {
    return { from: when, to: when, label: when };
  }

  const daysBackMatch = when.match(/^(\d+)days?$/);
  let daysBack = null;
  let label = when;

  if (when === 'today') daysBack = 0;
  else if (when === 'yesterday') daysBack = 1;
  else if (when === 'week') { daysBack = 7; label = 'last 7 days'; }
  else if (daysBackMatch) { daysBack = Number(daysBackMatch[1]); label = `last ${daysBack} days`; }
  else daysBack = 0;

  const from = new Date(today);
  from.setDate(from.getDate() - daysBack);

  if (when === 'yesterday') return { from: fmt(from), to: fmt(from), label: 'yesterday' };
  return { from: fmt(from), to: fmt(today), label: daysBack === 0 ? 'today' : label };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    when: 'today', project: resolve(process.cwd()), global: false, full: false,
    scope: 'messages', context: 1, limit: 100,
  };
  let positionalSeen = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--from' && args[i + 1]) opts.from = args[++i];
    else if (a === '--to' && args[i + 1]) opts.to = args[++i];
    else if (a === '--project' && args[i + 1]) opts.project = resolve(args[++i]);
    else if (a === '--global') opts.global = true;
    else if (a === '--full') opts.full = true;
    else if (a === '--index') opts.index = true;
    else if (a === '--deep') opts.deep = true;
    else if (a === '--search' && args[i + 1]) opts.search = args[++i];
    else if (a === '--scope' && args[i + 1]) opts.scope = args[++i];
    else if (a === '--regex') opts.regex = true;
    else if (a === '--case-sensitive') opts.caseSensitive = true;
    else if (a === '--context' && args[i + 1]) opts.context = Number(args[++i]);
    else if (a === '--limit' && args[i + 1]) opts.limit = Number(args[++i]);
    else if (a === '--sessions' && args[i + 1]) opts.sessions = args[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (!a.startsWith('--') && !positionalSeen) { opts.when = a; positionalSeen = true; }
  }
  return opts;
}

/** {toolName: count} across a parsed session's messages. */
function toolCountsOf(parsed) {
  const counts = {};
  for (const msg of parsed.messages) {
    for (const tool of msg.tools || []) counts[tool.name] = (counts[tool.name] || 0) + 1;
  }
  return counts;
}

/** merges discovery metadata with a parsed session into a digest view. */
function buildView(session, parsed) {
  return {
    sessionId: parsed.sessionId,
    title: parsed.aiTitle || session?.summary || session?.firstPrompt || parsed.sessionId,
    date: session?.date || parsed.date,
    project: session?.project || parsed.project,
    branch: parsed.branch,
    model: parsed.model,
    userMessages: parsed.userMessages,
    assistantTexts: parsed.assistantTexts,
    toolCounts: toolCountsOf(parsed),
  };
}

/** renders a session index as a scannable markdown list. */
function formatIndex(entries, { label, scope }) {
  const lines = [`# Scan index: ${label} — ${entries.length} sessions`, `**Scope:** ${scope}`, ''];
  if (!entries.length) {
    lines.push('*No Claude Code sessions found for this range/scope.*');
    return lines.join('\n');
  }
  lines.push('Pick relevant sessions and load them with `--sessions <id,...>` (or `--search` for a keyword).', '');
  for (const e of entries) {
    const counts = e.messageCount != null ? ` · ${e.messageCount} msgs` : '';
    const branch = e.branch ? ` · ${e.branch}` : '';
    lines.push(`- \`${e.sessionId}\` — **${e.title || '(untitled)'}** _(${e.date} · ${e.project}${branch}${counts})_`);
  }
  return lines.join('\n');
}

async function main() {
  const opts = parseArgs();

  // mode 1: targeted search
  if (opts.search) {
    const hits = await searchSessions({
      query: opts.search, regex: opts.regex, scope: opts.scope,
      from: opts.from, to: opts.to,
      project: opts.global ? undefined : opts.project, global: opts.global,
      context: opts.context, limit: opts.limit, caseSensitive: opts.caseSensitive,
    });
    console.log(formatHits(hits, { query: opts.search }));
    return;
  }

  // mode 2: load specific sessions in full
  if (opts.sessions) {
    const maxLen = opts.full ? FULL_MSG_LENGTH : DEFAULT_MSG_LENGTH;
    const all = await discoverSessions({ global: true });
    const byId = new Map(all.map(s => [s.sessionId, s]));
    const views = [];
    for (const id of opts.sessions) {
      const session = byId.get(id);
      const filePath = session?.filePath;
      if (!filePath) { console.error(`warn: session ${id} not found`); continue; }
      const parsed = await parseSessionFile(filePath, { maxLength: maxLen });
      views.push(buildView(session, parsed));
    }
    console.log(toMarkdown(views, {
      header: `# Scan: ${opts.sessions.length} session(s)`,
      maxUserMessages: opts.full ? null : MAX_USER_MSGS,
      maxAssistantMessages: opts.full ? null : MAX_ASSISTANT_MSGS,
    }));
    return;
  }

  const range = resolveRange(opts.when);
  const from = opts.from || range.from;
  const to = opts.to || range.to;
  const scopeLabel = opts.global ? 'all projects' : opts.project;
  const discoverOpts = { from, to, project: opts.project, global: opts.global };

  // mode 3: explicit index
  if (opts.index) {
    const entries = await buildIndex({ ...discoverOpts, deep: opts.deep });
    console.log(formatIndex(entries, { label: `${range.label} (${from} to ${to})`, scope: scopeLabel }));
    return;
  }

  // mode 4 (default): digest, auto-routing to an index when the range is large
  const sessions = await discoverSessions(discoverOpts);

  if (sessions.length > DIGEST_SESSION_LIMIT && !opts.full) {
    const entries = await buildIndex({ ...discoverOpts, deep: false });
    const index = formatIndex(entries, { label: `${range.label} (${from} to ${to})`, scope: scopeLabel });
    console.log(`> ${sessions.length} sessions in range — showing the index instead of a full digest to save context.\n> Load the relevant ones with \`--sessions <id,...>\`, or use \`--search "<query>"\`.\n\n${index}`);
    return;
  }

  const maxLen = opts.full ? FULL_MSG_LENGTH : DEFAULT_MSG_LENGTH;
  const views = [];
  for (const session of sessions) {
    if (!session.filePath) continue;
    const parsed = await parseSessionFile(session.filePath, { maxLength: maxLen });
    views.push(buildView(session, parsed));
  }
  console.log(toMarkdown(views, {
    header: `# Scan: ${range.label} (${from} to ${to})\n**Scope:** ${scopeLabel}`,
    maxUserMessages: opts.full ? null : MAX_USER_MSGS,
    maxAssistantMessages: opts.full ? null : MAX_ASSISTANT_MSGS,
  }));
}

main().catch(err => {
  console.error('error:', err.message);
  process.exit(1);
});
