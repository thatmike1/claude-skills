#!/usr/bin/env node
/**
 * gather — the raw facts behind a thread explainer, straight from T3's own
 * database (read-only), written into a fresh run folder whose path it prints.
 *
 * One entry per open top-level thread, in sidebar order: pinned first by pin
 * key, then the rest by latest activity, the way the fork's Sidebar.logic.ts
 * sorts its inbox. The calling thread keeps its number but is left out, and so
 * are snoozed threads, which sit below the inbox and were parked on purpose.
 *
 * Two files land in the run folder: facts.json for build.mjs, and read.md, the
 * same facts as wrapped text for the agent judging each thread. A JSON string
 * holding a long message is one line, and file readers cut long lines.
 *
 *   node gather.mjs [--out <dir>] [--self <threadId>] [--msgs 4] [--chars 2500]
 */

import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const MSGS = Number(opt('msgs', 4));
const CHARS = Number(opt('chars', 2500));
const DB = process.env.T3_STATE_DB || join(homedir(), '.t3', 'userdata', 'statev2.sqlite');

/** load node:sqlite without its one-off ExperimentalWarning. */
function loadSqlite() {
  const original = process.emitWarning;
  process.emitWarning = (warning, ...rest) => {
    const type = typeof rest[0] === 'string' ? rest[0] : rest[0]?.type;
    if (type === 'ExperimentalWarning') return;
    return original.call(process, warning, ...rest);
  };
  try {
    return createRequire(import.meta.url)('node:sqlite');
  } finally {
    process.emitWarning = original;
  }
}

const parse = text => {
  try { return JSON.parse(text || '{}'); } catch { return {}; }
};
const ms = iso => (iso ? Date.parse(iso) || 0 : 0);
// a reply's ask usually sits at its end, so a long message keeps both ends
const clip = (text, max) => {
  const flat = String(text || '').trim();
  if (flat.length <= max) return flat;
  const tail = Math.min(800, Math.floor(max / 2));
  return `${flat.slice(0, max - tail)} […] ${flat.slice(-tail)}`;
};
// spoken-reply comments are for the voice service, not for reading
const strip = text => String(text || '').replace(/<!--\s*say:[\s\S]*?-->/g, '').trim();
const RUNNING = ['running', 'starting', 'queued', 'preparing'];

const { DatabaseSync } = loadSqlite();
const db = new DatabaseSync(DB, { readOnly: true });

/** the thread this agent runs in, found by its own session id. */
function sessionThread() {
  const nativeId = process.env.CLAUDE_CODE_SESSION_ID || process.env.CODEX_THREAD_ID;
  if (!nativeId) return '';
  try {
    const row = db.prepare(`
      SELECT thread_id FROM orchestration_v2_projection_provider_threads
       WHERE json_extract(payload_json, '$.nativeThreadRef.nativeId') = ?
       ORDER BY updated_at DESC LIMIT 1`).get(nativeId);
    return row ? String(row.thread_id) : '';
  } catch {
    return '';
  }
}
const projects = new Map(
  db.prepare('SELECT project_id, title FROM projection_projects').all()
    .map(r => [String(r.project_id), String(r.title)]),
);

const rows = db.prepare(`
  SELECT thread_id, project_id, title, created_at, archived_at, payload_json
    FROM orchestration_v2_projection_threads
   WHERE deleted_at IS NULL`).all();

const all = rows.map(r => {
  const p = parse(r.payload_json);
  return {
    id: String(r.thread_id),
    title: String(r.title || ''),
    project: projects.get(String(r.project_id)) || '',
    createdAt: String(r.created_at),
    archived: Boolean(r.archived_at),
    settled: p.settledOverride === 'settled' || Boolean(p.settledAt),
    snoozed: ms(p.snoozedUntil) > Date.now(),
    pinned: Boolean(p.pinnedAt),
    pinKey: p.pinOrderKey || '',
    unsettledAt: p.unsettledAt || null,
    parent: p.lineage?.parentThreadId || null,
    relation: p.lineage?.relationshipToParent || null,
    linkedPullRequest: p.linkedPullRequest || null,
  };
});

// a delegated agent runs in a subagent thread; the thread it works for is its
// top-level ancestor, which is the one to leave out
const parentOf = new Map(all.filter(t => t.relation === 'subagent' && t.parent).map(t => [t.id, t.parent]));
let SELF = opt('self', sessionThread());
for (let hops = 0; parentOf.has(SELF) && hops < 20; hops++) SELF = parentOf.get(SELF);

const latestRun = db.prepare(`
  SELECT status, requested_at, completed_at FROM orchestration_v2_projection_runs
   WHERE thread_id = ? ORDER BY ordinal DESC LIMIT 1`);
// T3 files its own notices (a delegated task finished, a scheduled run fired)
// as user messages created by an agent; they are not Mike talking
const HUMAN = `(role = 'assistant' OR json_extract(payload_json, '$.createdBy') = 'user')`;
const messages = db.prepare(`
  SELECT role, created_at, payload_json FROM orchestration_v2_projection_messages
   WHERE thread_id = ? AND streaming = 0 AND role IN ('user', 'assistant') AND ${HUMAN}
   ORDER BY created_at DESC LIMIT ?`);
const mikeMessages = db.prepare(`
  SELECT created_at, payload_json FROM orchestration_v2_projection_messages
   WHERE thread_id = ? AND role = 'user' AND json_extract(payload_json, '$.createdBy') = 'user'
     AND length(json_extract(payload_json, '$.text')) > 20
   ORDER BY created_at DESC LIMIT ?`);
// the agent's longest reply to one of his messages is where it answered him;
// the short ones around it are progress lines
const answerTo = db.prepare(`
  SELECT created_at, payload_json FROM orchestration_v2_projection_messages
   WHERE thread_id = ? AND role = 'assistant' AND streaming = 0 AND created_at > ? AND created_at < ?
   ORDER BY length(json_extract(payload_json, '$.text')) DESC LIMIT 1`);
const firstUser = db.prepare(`
  SELECT payload_json FROM orchestration_v2_projection_messages
   WHERE thread_id = ? AND role = 'user' ORDER BY created_at ASC LIMIT 1`);

const children = new Map();
for (const t of all) {
  if (t.relation !== 'subagent' || !t.parent) continue;
  if (!children.has(t.parent)) children.set(t.parent, []);
  children.get(t.parent).push(t);
}

/** every delegated descendant of a thread, with its latest run status. */
function descendants(id) {
  const out = [];
  for (const c of children.get(id) || []) {
    out.push({ title: c.title, status: latestRun.get(c.id)?.status || 'idle' });
    out.push(...descendants(c.id));
  }
  return out;
}

// local pages, files and links in a reply: what "go look at it" points to
const ARTIFACT = /(https?:\/\/[^\s)<>\]"'`]+|\/home\/[^\s)<>\]"'`]+\.[a-z0-9]{2,5}\b)/gi;

const open = all.filter(t => !t.settled && !t.archived && t.relation !== 'subagent');

const threads = open.map(t => {
  const run = latestRun.get(t.id);
  const recent = messages.all(t.id, MSGS).reverse().map(m => ({
    role: m.role,
    at: m.created_at,
    text: clip(strip(parse(m.payload_json).text), CHARS),
  }));
  const first = firstUser.get(t.id);
  const firstText = first ? String(parse(first.payload_json).text || '') : '';
  // a Jarvis thread runs for a day or more, plans and hands off; its tail alone misleads
  const jarvis = /^\s*[$/]jarvis\b/i.test(firstText);
  const mine = mikeMessages.all(t.id, jarvis ? 4 : 2);
  const exchanges = mine.map((m, i) => {
    const until = i === 0 ? '9999' : mine[i - 1].created_at;
    const reply = answerTo.get(t.id, m.created_at, until);
    return {
      at: m.created_at,
      mike: clip(parse(m.payload_json).text, jarvis ? 3500 : 1500),
      replyAt: reply?.created_at || null,
      reply: reply ? clip(strip(parse(reply.payload_json).text), jarvis ? 3000 : 1500) : '',
    };
  }).reverse();
  const lastAssistant = [...recent].reverse().find(m => m.role === 'assistant');
  const lastUser = [...recent].reverse().find(m => m.role === 'user');
  const kids = descendants(t.id);
  const replies = [...recent.filter(m => m.role === 'assistant').map(m => m.text), ...exchanges.map(e => e.reply)];
  const artifacts = [...new Set(replies.flatMap(text => text.match(ARTIFACT) || [])
    .map(a => a.replace(/[*.,:;!?]+$/, '')).filter(Boolean))]
    .map(a => ({ ref: a, exists: a.startsWith('/') ? existsSync(a) : null }));
  const activity = Math.max(ms(t.createdAt), ms(t.unsettledAt), ms(run?.requested_at), ms(run?.completed_at));
  return {
    threadId: t.id,
    link: `t3-thread://v1/${t.id}`,
    title: t.title,
    project: t.project,
    status: run?.status || 'idle',
    pinned: t.pinned,
    pinKey: t.pinKey,
    snoozed: t.snoozed,
    createdAt: t.createdAt,
    lastActivity: new Date(activity).toISOString(),
    // he wrote last and nothing answered yet
    lastWordIsMike: Boolean(lastUser && (!lastAssistant || ms(lastUser.at) > ms(lastAssistant.at))),
    firstAsk: clip(firstText, 700),
    jarvis,
    // his last real messages and the agent's main answer to each, oldest first
    exchanges,
    recent,
    // only running children change what a thread wants; counts of the rest are noise to him
    children: { running: kids.filter(k => RUNNING.includes(k.status)).map(k => k.title) },
    artifacts,
    pullRequest: t.linkedPullRequest,
  };
});

// sidebar order: pinned by pin key then creation, then the rest by activity,
// then the snoozed shelf; numbering counts the calling thread
const byActivity = (a, b) => ms(b.lastActivity) - ms(a.lastActivity);
const pinned = threads.filter(t => t.pinned && !t.snoozed)
  .sort((a, b) => (a.pinKey < b.pinKey ? -1 : a.pinKey > b.pinKey ? 1 : ms(a.createdAt) - ms(b.createdAt)));
const inbox = threads.filter(t => !t.pinned && !t.snoozed).sort(byActivity);
const ordered = [...pinned, ...inbox]
  .map(({ pinKey, snoozed, ...t }, i) => ({ ...t, sidebarIndex: i + 1 }))
  .filter(t => t.threadId !== SELF);
db.close();

const when = iso => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} ${d.toTimeString().slice(0, 5)}`;
};
/** hard-wrap long lines at a space so a file reader keeps them whole. */
const wrap = text => String(text).split('\n').flatMap(line => {
  const out = [];
  let rest = line;
  while (rest.length > 200) {
    let cut = rest.lastIndexOf(' ', 200);
    if (cut < 80) cut = 200;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  return [...out, rest];
}).join('\n');

/** one thread as text for the judging agent, his words before the tail. */
function section(t) {
  const facts = [t.project, t.jarvis && 'Jarvis thread', t.status, t.pinned && 'pinned', `last activity ${when(t.lastActivity)}`];
  const lines = [`## ${t.sidebarIndex} · ${t.title}`, '', `id ${t.threadId} · ${facts.filter(Boolean).join(' · ')}`];
  if (t.lastWordIsMike) lines.push('He wrote last and nothing has answered him yet.');
  if (t.children.running.length) lines.push(`Delegated agents still running: ${t.children.running.join('; ')}`);
  if (t.pullRequest) lines.push(`Pull request: ${t.pullRequest.url || JSON.stringify(t.pullRequest)}`);
  if (t.artifacts.length) {
    lines.push('Pages and files in its replies:');
    for (const a of t.artifacts) lines.push(`- ${a.ref}${a.exists === false ? ' (missing on disk)' : ''}`);
  }
  lines.push('', '### His first message', '', wrap(t.firstAsk));
  const seen = new Set();
  for (const e of t.exchanges) {
    seen.add(e.at).add(e.replyAt);
    lines.push('', `### Mike, ${when(e.at)}`, '', wrap(e.mike));
    if (e.reply) lines.push('', `### Its main answer, ${when(e.replyAt)}`, '', wrap(e.reply));
  }
  const tail = t.recent.filter(m => !seen.has(m.at));
  if (tail.length) {
    lines.push('', '### Its latest messages');
    for (const m of tail) lines.push('', `#### ${m.role === 'user' ? 'Mike' : 'agent'}, ${when(m.at)}`, '', wrap(m.text));
  }
  return lines.join('\n');
}

const now = new Date();
const stamp = `${now.toISOString().slice(0, 10)}-${now.toTimeString().slice(0, 5).replace(':', '')}`;
const root = join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'thread-explainer');
const out = opt('out', join(root, stamp));
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'facts.json'), JSON.stringify({ generatedAt: now.toISOString(), threads: ordered }, null, 2));
const head = `# Open threads, ${now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ${now.toTimeString().slice(0, 5)}\n\n${ordered.length} threads to judge, in sidebar order.`;
writeFileSync(join(out, 'read.md'), [head, ...ordered.map(section)].join('\n\n') + '\n');
console.log(out);
