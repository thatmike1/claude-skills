#!/usr/bin/env node

/**
 * hours ledger for the /evening skill.
 *
 * answers "how many hours went where" for a single day, without double-counting
 * the stretches where several sessions ran at once.
 *
 * method: slice the day into fixed buckets (default 15 min), mark a bucket
 * "active" for a session if that session emitted at least --min-events records
 * inside it, then hand each active bucket out among the sessions live in it.
 * two splits are reported — equal shares, and shares weighted by how busy each
 * session was — because agreement between them is the signal that the number is
 * trustworthy. both sum to the day's real active wall-clock, never past it.
 *
 * usage: node compute-hours.mjs [--date YYYY-MM-DD] [--project /path]
 *                               [--bucket 15] [--min-events 1] [--no-agents] [--json]
 */

import { createReadStream, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { decodeProjectName, normalizeTimestamp } from '../../shared/cc-parser.mjs';

const PROJECTS_DIR = join(homedir(), '.claude', 'projects');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    date: localDateString(new Date()),
    project: null,
    bucketMinutes: 15,
    minEvents: 1,
    includeAgents: true,
    exclude: [],
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--date' && args[i + 1]) opts.date = args[++i];
    else if (arg === '--project' && args[i + 1]) opts.project = resolve(args[++i]);
    else if (arg === '--bucket' && args[i + 1]) opts.bucketMinutes = Number(args[++i]);
    else if (arg === '--min-events' && args[i + 1]) opts.minEvents = Number(args[++i]);
    else if (arg === '--no-agents') opts.includeAgents = false;
    else if (arg === '--exclude' && args[i + 1]) opts.exclude.push(...args[++i].split(',').map(s => s.trim()).filter(Boolean));
    else if (arg === '--json') opts.json = true;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
    console.error(`--date must be YYYY-MM-DD, got "${opts.date}"`);
    process.exit(1);
  }
  if (!Number.isFinite(opts.bucketMinutes) || opts.bucketMinutes <= 0 || 1440 % opts.bucketMinutes !== 0) {
    console.error('--bucket must be a positive whole divisor of 1440');
    process.exit(1);
  }
  return opts;
}

/** local calendar date of a Date, as YYYY-MM-DD (never UTC — the day must match the user's). */
function localDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatClock(minutesFromMidnight) {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * finds every top-level session file, plus the subagent/workflow files nested
 * under it. subagent time is attributed to the parent session: a background
 * agent working for ten minutes is that thread making progress, and the parent
 * transcript is silent for exactly that stretch.
 */
function discoverSessionFiles(projectFilter) {
  const found = [];
  if (!existsSync(PROJECTS_DIR)) return found;

  for (const projectDirName of readdirSync(PROJECTS_DIR).sort()) {
    const projectDir = join(PROJECTS_DIR, projectDirName);
    try {
      if (!statSync(projectDir).isDirectory()) continue;
    } catch {
      continue;
    }

    const project = decodeProjectName(projectDirName);
    if (projectFilter) {
      const encoded = projectFilter.replace(/\//g, '-');
      if (projectDirName !== encoded && !projectDirName.startsWith(`${encoded}-`)) continue;
    }

    for (const entry of readdirSync(projectDir).sort()) {
      if (!entry.endsWith('.jsonl')) continue;
      const sessionId = entry.replace(/\.jsonl$/, '');
      const mainFile = join(projectDir, entry);
      const agentDir = join(projectDir, sessionId, 'subagents');
      found.push({
        sessionId,
        project,
        projectDir: projectDirName,
        mainFile,
        agentFiles: existsSync(agentDir) ? collectJsonl(agentDir) : [],
      });
    }
  }
  return found;
}

/** recursively collects .jsonl paths under a directory (subagents nest by workflow). */
function collectJsonl(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectJsonl(full));
    else if (entry.name.endsWith('.jsonl')) out.push(full);
  }
  return out;
}

/**
 * buckets one file's records onto the target local day.
 * a session file routinely spans several days, so records are filtered by their
 * own local date rather than by the file's — skipping this is how a session gets
 * its timestamps smeared onto the wrong day.
 */
async function bucketFile(filePath, date, bucketMinutes, counts, meta, isParent = true) {
  let rl;
  try {
    rl = createInterface({ input: createReadStream(filePath) });
  } catch {
    return;
  }

  for await (const line of rl) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }

    if (isParent && record.type === 'ai-title' && record.aiTitle) meta.title ||= record.aiTitle;

    const iso = record.timestamp ? normalizeTimestamp(record.timestamp) : null;
    if (!iso) continue;
    const when = new Date(iso);
    if (localDateString(when) !== date) continue;

    // branch and cwd come from the parent transcript only — subagents run in
    // worktrees and sub-paths of their own — and from the target day only,
    // last-write-wins, since a long session can outlive a branch switch
    if (isParent) {
      if (record.gitBranch) {
        meta.branchFirst ||= record.gitBranch;
        meta.branchLast = record.gitBranch;
      }
      if (record.cwd) meta.cwd = record.cwd;
    }

    const minutes = when.getHours() * 60 + when.getMinutes();
    const bucket = Math.floor(minutes / bucketMinutes);
    counts.set(bucket, (counts.get(bucket) || 0) + 1);
    meta.events++;
    if (meta.firstMinute === null || minutes < meta.firstMinute) meta.firstMinute = minutes;
    if (meta.lastMinute === null || minutes > meta.lastMinute) meta.lastMinute = minutes;
  }
}

/** compresses sorted bucket indices into display windows, bridging single gaps. */
function toWindows(buckets, bucketMinutes) {
  const runs = [];
  for (const bucket of buckets) {
    const last = runs[runs.length - 1];
    if (last && bucket - last[1] <= 2) last[1] = bucket;
    else runs.push([bucket, bucket]);
  }
  return runs.map(([a, b]) => `${formatClock(a * bucketMinutes)}-${formatClock((b + 1) * bucketMinutes)}`);
}

async function main() {
  const opts = parseArgs();
  const files = discoverSessionFiles(opts.project);

  const sessions = [];
  for (const file of files) {
    // the recap session is overhead, not work — /evening passes its own id here
    if (opts.exclude.some(id => file.sessionId.startsWith(id))) continue;
    const counts = new Map();
    const agentCounts = new Map();
    const meta = {
      title: null, branchFirst: null, branchLast: null, cwd: null,
      events: 0, firstMinute: null, lastMinute: null,
    };

    await bucketFile(file.mainFile, opts.date, opts.bucketMinutes, counts, meta);
    if (opts.includeAgents) {
      for (const agentFile of file.agentFiles) {
        await bucketFile(agentFile, opts.date, opts.bucketMinutes, agentCounts, meta, false);
      }
      for (const [bucket, n] of agentCounts) counts.set(bucket, (counts.get(bucket) || 0) + n);
    }

    // buckets too quiet to count as work are dropped before anything is shared out
    const active = new Map([...counts].filter(([, n]) => n >= opts.minEvents));
    if (active.size === 0) continue;

    // buckets that exist only because a background agent was running
    const agentOnly = [...active.keys()].filter(
      bucket => (agentCounts.get(bucket) || 0) >= opts.minEvents && (counts.get(bucket) || 0) === (agentCounts.get(bucket) || 0)
    ).length;

    sessions.push({
      sessionId: file.sessionId,
      project: meta.cwd || file.project,
      // branch of the session's own working directory, which is not always where
      // the work landed — an agent editing a worktree leaves the cwd branch alone
      branches: [...new Set([meta.branchFirst, meta.branchLast].filter(Boolean))],
      title: meta.title,
      events: meta.events,
      firstMinute: meta.firstMinute,
      lastMinute: meta.lastMinute,
      active,
      agentOnlyBuckets: agentOnly,
    });
  }

  if (sessions.length === 0) {
    const empty = { date: opts.date, sessions: [], totals: { activeHours: 0 } };
    console.log(opts.json ? JSON.stringify(empty, null, 2) : `No session activity found on ${opts.date}.`);
    return;
  }

  // share every active bucket out among the sessions live in it, two ways
  const allBuckets = new Set();
  for (const session of sessions) for (const bucket of session.active.keys()) allBuckets.add(bucket);

  const bucketHours = opts.bucketMinutes / 60;
  const equal = new Map(sessions.map(s => [s.sessionId, 0]));
  const weighted = new Map(sessions.map(s => [s.sessionId, 0]));

  for (const bucket of allBuckets) {
    const live = sessions.filter(s => s.active.has(bucket));
    const totalEvents = live.reduce((sum, s) => sum + s.active.get(bucket), 0);
    for (const session of live) {
      equal.set(session.sessionId, equal.get(session.sessionId) + bucketHours / live.length);
      weighted.set(
        session.sessionId,
        weighted.get(session.sessionId) + (bucketHours * session.active.get(bucket)) / totalEvents
      );
    }
  }

  const firstMinute = Math.min(...sessions.map(s => s.firstMinute));
  const lastMinute = Math.max(...sessions.map(s => s.lastMinute));
  const activeHours = allBuckets.size * bucketHours;
  const spanHours = (lastMinute - firstMinute) / 60;

  const rows = sessions
    .map(session => ({
      sessionId: session.sessionId,
      project: session.project,
      branches: session.branches,
      title: session.title,
      events: session.events,
      first: formatClock(session.firstMinute),
      last: formatClock(session.lastMinute),
      soloHours: Number((session.active.size * bucketHours).toFixed(2)),
      equalHours: Number(equal.get(session.sessionId).toFixed(2)),
      weightedHours: Number(weighted.get(session.sessionId).toFixed(2)),
      agentOnlyHours: Number((session.agentOnlyBuckets * bucketHours).toFixed(2)),
      windows: toWindows([...session.active.keys()].sort((a, b) => a - b), opts.bucketMinutes),
    }))
    .sort((a, b) => b.equalHours - a.equalHours);

  const result = {
    date: opts.date,
    settings: {
      bucketMinutes: opts.bucketMinutes,
      minEvents: opts.minEvents,
      agentTimeIncluded: opts.includeAgents,
    },
    totals: {
      firstActivity: formatClock(firstMinute),
      lastActivity: formatClock(lastMinute),
      spanHours: Number(spanHours.toFixed(2)),
      activeHours: Number(activeHours.toFixed(2)),
      // active time is counted in whole buckets, so on a very short day it can
      // round past the first-to-last span; a negative gap would be nonsense
      idleWithinSpanHours: Number(Math.max(0, spanHours - activeHours).toFixed(2)),
      maxConcurrentSessions: Math.max(
        ...[...allBuckets].map(bucket => sessions.filter(s => s.active.has(bucket)).length)
      ),
    },
    sessions: rows,
  };

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const t = result.totals;
  console.log(`# Hours — ${opts.date}\n`);
  const concurrent = t.maxConcurrentSessions === 1
    ? 'never more than one session at a time'
    : `up to ${t.maxConcurrentSessions} sessions at once`;
  console.log(
    `span ${t.firstActivity} → ${t.lastActivity} (${t.spanHours.toFixed(2)} h) | ` +
    `active ${t.activeHours.toFixed(2)} h | idle within span ${t.idleWithinSpanHours.toFixed(2)} h | ${concurrent}`
  );
  console.log(
    `buckets of ${opts.bucketMinutes} min, ${opts.minEvents}+ event(s) to count` +
    `${opts.includeAgents ? ', subagent time folded into its parent session' : ', subagent time excluded'}\n`
  );
  console.log('"split" columns share overlapping buckets out, so they sum to the day.');
  console.log('"solo" is the raw active time per session and deliberately over-counts when threads overlap.\n');

  const header = ['session', 'split', 'weighted', 'solo', 'events', 'project / title'];
  console.log(`${header[0].padEnd(10)}${header[1].padStart(7)}${header[2].padStart(10)}${header[3].padStart(7)}${header[4].padStart(8)}  ${header[5]}`);
  for (const row of rows) {
    const label = [row.project?.split('/').pop(), row.title].filter(Boolean).join(' — ');
    console.log(
      `${row.sessionId.slice(0, 8).padEnd(10)}${row.equalHours.toFixed(2).padStart(7)}` +
      `${row.weightedHours.toFixed(2).padStart(10)}${row.soloHours.toFixed(2).padStart(7)}` +
      `${String(row.events).padStart(8)}  ${label}`
    );
    console.log(`${' '.repeat(10)}${row.first}-${row.last} · ${row.windows.join(', ')}`);
    if (row.branches.length) console.log(`${' '.repeat(10)}cwd branch: ${row.branches.join(' → ')}`);
    if (row.agentOnlyHours > 0) console.log(`${' '.repeat(10)}${row.agentOnlyHours.toFixed(2)} h of that is background-agent time only`);
    console.log('');
  }
  const soloTotal = rows.reduce((sum, r) => sum + r.soloHours, 0);
  console.log(`${'TOTAL'.padEnd(10)}${t.activeHours.toFixed(2).padStart(7)}${t.activeHours.toFixed(2).padStart(10)}${soloTotal.toFixed(2).padStart(7)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('error:', err.message);
    process.exit(1);
  });
}

export { discoverSessionFiles, toWindows };
