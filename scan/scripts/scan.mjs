#!/usr/bin/env node

/**
 * scans Claude Code conversations for a date range / project and dumps clean
 * structured markdown to stdout. the skill's prompt then answers whatever the
 * user actually asked from this digest.
 *
 * usage:
 *   node scan.mjs [when] [--project <path>] [--global] [--full]
 *
 * when (positional, optional, default "today"):
 *   today | yesterday | 3days | week | Ndays | YYYY-MM-DD
 * flags:
 *   --from YYYY-MM-DD --to YYYY-MM-DD   explicit range (overrides positional)
 *   --project <path>                    filter to one project (default: cwd)
 *   --global                            scan all projects, ignore cwd
 *   --full                              don't truncate messages (heavier output)
 */

import { resolve } from 'path';
import { discoverSessions, parseSessionFile, truncateText } from '../../shared/cc-parser.mjs';

const DEFAULT_MSG_LENGTH = 500;
const FULL_MSG_LENGTH = 5000;
const MAX_USER_MSGS = 20;
const MAX_ASSISTANT_MSGS = 12;

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

  // explicit single date
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
  else daysBack = 0; // unknown keyword falls back to today

  const from = new Date(today);
  from.setDate(from.getDate() - daysBack);

  if (when === 'yesterday') return { from: fmt(from), to: fmt(from), label: 'yesterday' };
  return { from: fmt(from), to: fmt(today), label: daysBack === 0 ? 'today' : label };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { when: 'today', project: resolve(process.cwd()), global: false, full: false };
  let positionalSeen = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--from' && args[i + 1]) opts.from = args[++i];
    else if (a === '--to' && args[i + 1]) opts.to = args[++i];
    else if (a === '--project' && args[i + 1]) opts.project = resolve(args[++i]);
    else if (a === '--global') opts.global = true;
    else if (a === '--full') opts.full = true;
    else if (!a.startsWith('--') && !positionalSeen) { opts.when = a; positionalSeen = true; }
  }
  return opts;
}

/** formats a parsed session as markdown. */
function formatSession(session, parsed, maxLen) {
  const lines = [];
  const title = parsed.aiTitle || session.firstPrompt || session.sessionId;
  lines.push(`### ${title}`, '');

  const meta = [`**Date:** ${session.date}`];
  if (session.project) meta.push(`**Project:** ${session.project}`);
  if (parsed.branch) meta.push(`**Branch:** ${parsed.branch}`);
  lines.push(meta.join(' | '), '');

  if (parsed.userMessages.length) {
    lines.push('**User said:**');
    for (const msg of parsed.userMessages.slice(0, MAX_USER_MSGS)) {
      lines.push(`- ${truncateText(msg, maxLen)}`);
    }
    if (parsed.userMessages.length > MAX_USER_MSGS) {
      lines.push(`- *...and ${parsed.userMessages.length - MAX_USER_MSGS} more messages*`);
    }
    lines.push('');
  }

  if (parsed.assistantTexts.length) {
    lines.push('**Assistant did:**');
    for (const msg of parsed.assistantTexts.slice(0, MAX_ASSISTANT_MSGS)) {
      lines.push(`- ${truncateText(msg, maxLen)}`);
    }
    if (parsed.assistantTexts.length > MAX_ASSISTANT_MSGS) {
      lines.push(`- *...and ${parsed.assistantTexts.length - MAX_ASSISTANT_MSGS} more responses*`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const opts = parseArgs();
  const range = resolveRange(opts.when);
  const from = opts.from || range.from;
  const to = opts.to || range.to;
  const maxLen = opts.full ? FULL_MSG_LENGTH : DEFAULT_MSG_LENGTH;

  const discoverOpts = { from, to };
  if (!opts.global) discoverOpts.project = opts.project;

  const sessions = await discoverSessions(discoverOpts);

  const scope = opts.global ? 'all projects' : opts.project;
  console.log(`# Scan: ${range.label} (${from} to ${to})`);
  console.log(`**Scope:** ${scope}\n`);

  if (!sessions.length) {
    console.log('*No Claude Code sessions found for this range/scope.*');
    return;
  }

  console.log(`## Claude Code Sessions (${sessions.length})\n`);
  for (const session of sessions) {
    if (!session.filePath) continue;
    const parsed = await parseSessionFile(session.filePath);
    console.log(formatSession(session, parsed, maxLen));
    console.log('---\n');
  }
}

main().catch(err => {
  console.error('error:', err.message);
  process.exit(1);
});
