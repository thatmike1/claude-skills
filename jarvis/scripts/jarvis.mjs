#!/usr/bin/env node
/**
 * jarvis — the inbox, the watcher service and the thread tools behind the
 * jarvis skill. `node jarvis.mjs help` lists the commands.
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { t3OpenThreads } from '../../shared/t3-state.mjs';
import { loadConfig, loadServiceState, saveConfig } from './lib/config.mjs';
import { ack, list, post, STATUSES } from './lib/inbox.mjs';
import { boardHtml, pageHtml } from './lib/page.mjs';
import { snapshot, tick } from './lib/service.mjs';
import { lastWords, startTurn, threadForClaudeSession, threadForCodexThread, threadInfo } from './lib/t3.mjs';
import { duration } from './lib/decide.mjs';

const SELF = fileURLToPath(import.meta.url);

const HELP = `jarvis — inbox and thread tools for the jarvis skill

  bind [--thread <id>]            make the current T3 thread Jarvis's home (wakes land here)
  post --status <s> [--priority now] [--title t] [--thread id] [--from job|jarvis]
       [--reconstructed] [--id x] [--body text]    add an entry; body from stdin if no --body
  note <text>                     a note from Mike, as if typed on the page
  list [--unread] [--all] [--json]
  show <id>                       one entry in full
  ack <id...> | --all             mark entries as dealt with by Jarvis
  out                             agent-launched threads still out, and stubs written
  sweep                           open threads with their last words, for the settle sweep
  send <thread-id> <text>         start a turn in an idle thread (any provider)
  prompt-tail                     the paragraph to end a job's prompt with
  quiet [--until <iso>] | --off   pause check-ins (default: until 08:00 tomorrow)
  tick                            run one watcher tick now and print what it did
  serve [--port n]                the watcher plus the page (the systemd unit runs this)
  status                          binding, service memory, page address

statuses: ${STATUSES.join(', ')}`;

function parse(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[key] = true;
      else { args[key] = next; i++; }
    } else args._.push(a);
  }
  return args;
}

function fail(message) {
  console.error(`jarvis: ${message}`);
  process.exit(1);
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function hhmm(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** the T3 thread the calling agent runs in, when the harness says so. */
function ownThread() {
  if (process.env.CLAUDE_CODE_SESSION_ID) return threadForClaudeSession(process.env.CLAUDE_CODE_SESSION_ID);
  if (process.env.CODEX_THREAD_ID) return threadForCodexThread(process.env.CODEX_THREAD_ID);
  return null;
}

function entryLine(e) {
  const who = e.from === 'mike' ? 'mike' : e.from === 'jarvis' ? 'jarvis' : e.title || e.from;
  const mark = e.handled ? ' ' : '*';
  const prio = e.priority === 'now' ? ' NOW' : '';
  const first = e.body.split('\n').find(l => l.trim()) || '';
  return `${mark} ${e.id}  ${hhmm(e.created)}  ${e.status.padEnd(9)}${prio}  ${who}\n    ${first.slice(0, 160)}`;
}

const commands = {
  help() {
    console.log(HELP);
  },

  bind(args) {
    const threadId = args.thread || ownThread();
    if (!threadId) fail('cannot tell which T3 thread this is; pass --thread <id>');
    const info = threadInfo(threadId);
    if (!info) fail(`no T3 thread ${threadId}`);
    const now = new Date().toISOString();
    const config = loadConfig();
    saveConfig({ home: { threadId, title: info.title, boundAt: now }, since: config.since || now });
    console.log(`bound: wakes and check-ins now land in "${info.title}" (${threadId})`);
    if (!config.tokenFile) console.log('no T3 token file configured: set "tokenFile" in ~/.jarvis/config.json or wakes cannot be sent');
  },

  post(args) {
    const body = typeof args.body === 'string' ? args.body : readStdin();
    const thread = typeof args.thread === 'string' ? args.thread : ownThread() || '';
    const title = typeof args.title === 'string' ? args.title : thread ? threadInfo(thread)?.title || '' : '';
    try {
      const entry = post({
        from: typeof args.from === 'string' ? args.from : 'job',
        status: String(args.status || 'done'),
        priority: args.priority === 'now' ? 'now' : 'normal',
        thread, title, body,
        id: typeof args.id === 'string' ? args.id : undefined,
        reconstructed: Boolean(args.reconstructed),
      });
      console.log(`posted ${entry.id} (${entry.status})`);
    } catch (error) {
      fail(error.message);
    }
  },

  note(args) {
    const text = args._.join(' ') || readStdin();
    try {
      console.log(`noted ${post({ from: 'mike', status: 'note', body: text }).id}`);
    } catch (error) {
      fail(error.message);
    }
  },

  list(args) {
    let entries = list();
    if (args.unread) entries = entries.filter(e => !e.handled && e.from !== 'jarvis');
    else if (!args.all) entries = entries.filter(e => Date.now() - Date.parse(e.created) < 3 * 86_400_000);
    if (args.json) return console.log(JSON.stringify(entries, null, 2));
    if (!entries.length) return console.log(args.unread ? 'nothing unread' : 'inbox empty');
    if (args.unread) {
      // unread is what a wake asks for, so give the full bodies in one call
      for (const e of entries) console.log(`--- ${e.id} · ${e.status}${e.priority === 'now' ? ' · NOW' : ''} · ${e.from === 'mike' ? 'from mike' : e.title || e.from} · ${hhmm(e.created)}${e.thread ? ` · thread ${e.thread}` : ''}\n${e.body}\n`);
      return;
    }
    console.log(entries.map(entryLine).join('\n'));
    console.log('\n* = not yet acked by jarvis');
  },

  show(args) {
    const entry = list().find(e => e.id === args._[0]);
    if (!entry) fail(`no entry ${args._[0]}`);
    console.log(readFileSync(`${process.env.JARVIS_HOME || `${process.env.HOME}/.jarvis`}/inbox/${entry.file}`, 'utf8'));
  },

  ack(args) {
    const ids = args.all ? list().filter(e => !e.handled).map(e => e.id) : args._;
    if (!ids.length) return console.log(args.all ? 'nothing to ack' : 'pass entry ids, or --all');
    const missing = ack(ids);
    console.log(`acked ${ids.length - missing.length}${missing.length ? `; unknown: ${missing.join(' ')}` : ''}`);
  },

  out() {
    const snap = snapshot();
    if (!snap.outstanding.length) console.log('nothing out');
    for (const t of snap.outstanding) console.log(`${t.status.padEnd(7)} ${t.title}  (launched ${hhmm(t.launchedAt)}, ${t.threadId})`);
    if (snap.stubs.length) console.log(`\n${snap.stubs.length} went quiet without reporting; the next tick stubs them`);
  },

  sweep() {
    const config = loadConfig();
    const entries = list();
    const threads = t3OpenThreads().filter(t => t.threadId !== config.home?.threadId);
    if (!threads.length) return console.log('no open threads: everything is settled');
    console.log(`# ${threads.length} open threads, newest first. Judge each: settle / needs you: <why> / running.\n`);
    threads.forEach((t, i) => {
      const words = lastWords(t.threadId, 400);
      const quiet = duration(Date.now() - Date.parse(t.updatedAt));
      const inbox = entries.filter(e => e.thread === t.threadId);
      console.log(`[${i + 1}] "${t.title}" · ${t.provider} ${t.model} · ${t.status} · quiet ${quiet} · ${t.project}`);
      console.log(`    thread ${t.threadId}`);
      if (words.user) console.log(`    mike/last ask: ${words.user}`);
      if (words.assistant) console.log(`    agent/last words: ${words.assistant}`);
      for (const e of inbox) console.log(`    inbox ${e.id}: ${e.status}${e.handled ? ' (acked)' : ''}`);
      console.log('');
    });
  },

  async send(args) {
    const [threadId, ...rest] = args._;
    const text = rest.join(' ') || readStdin();
    if (!threadId || !text.trim()) fail('usage: send <thread-id> <text>');
    const info = threadInfo(threadId);
    if (!info) fail(`no T3 thread ${threadId}`);
    if (info.status !== 'idle') fail(`"${info.title}" is ${info.status}; send when it is idle`);
    const config = loadConfig();
    if (!config.tokenFile) fail('no T3 token file configured');
    await startTurn({ threadId, text, id: `send-${Date.now()}`, tokenFile: config.tokenFile });
    console.log(`sent to "${info.title}"`);
  },

  'prompt-tail'() {
    console.log(`When you are done, or stuck, post one entry to Mike's inbox:

node ${SELF} post --status <done|blocked|failed|needs-you> <<'EOF'
What changed: two plain sentences.
Does it work: what you ran and what passed. "Untested" is a fine answer.
You decide: the one thing Mike must decide, or "nothing".
Where: PR link, file path or page.
EOF

Write it for someone tired who did not watch you work, in under 150 words. A PR link alone is not a report. Add --priority now only if it cannot wait.`);
  },

  quiet(args) {
    if (args.off) {
      saveConfig({ quietUntil: '' });
      return console.log('check-ins back on');
    }
    let until = typeof args.until === 'string' ? new Date(args.until) : null;
    if (!until) {
      until = new Date();
      until.setDate(until.getDate() + 1);
      until.setHours(8, 0, 0, 0);
    }
    if (Number.isNaN(until.getTime())) fail('--until needs a date');
    saveConfig({ quietUntil: until.toISOString() });
    console.log(`no check-ins until ${until.toLocaleString('en-GB')}`);
  },

  async tick() {
    const lines = [];
    const snap = await tick({ log: line => lines.push(line) });
    console.log(lines.length ? lines.join('\n') : 'nothing to do');
    console.log(`(${snap.unhandled.length} unread, ${snap.outstanding.length} out)`);
  },

  serve(args) {
    const config = loadConfig();
    const port = Number(args.port || config.port);
    const log = line => console.log(`${new Date().toISOString()} ${line}`);
    let running = false;
    const loop = async () => {
      if (running) return;
      running = true;
      try {
        await tick({ log });
      } catch (error) {
        log(`tick failed: ${error.stack || error.message}`);
      } finally {
        running = false;
      }
    };
    setInterval(loop, 20_000);
    loop();

    const server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      const all = url.searchParams.has('all');
      try {
        if (req.method === 'GET' && url.pathname === '/') {
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          return res.end(pageHtml(snapshot(), { all }));
        }
        if (req.method === 'GET' && url.pathname === '/board') {
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          return res.end(boardHtml(snapshot(), { all }));
        }
        if (req.method === 'GET' && url.pathname === '/api/entries') {
          res.writeHead(200, { 'content-type': 'application/json' });
          return res.end(JSON.stringify(list()));
        }
        if (req.method === 'POST' && url.pathname === '/api/note') {
          // a custom header forces a CORS preflight this server never answers, so
          // no web page Mike visits can write into the inbox and steer Jarvis
          const origin = req.headers.origin;
          if (req.headers['x-jarvis'] !== '1' || (origin && origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`)) {
            res.writeHead(403);
            return res.end('forbidden');
          }
          let raw = '';
          for await (const chunk of req) {
            raw += chunk;
            if (raw.length > 20_000) break;
          }
          const text = String(JSON.parse(raw || '{}').text || '').trim();
          if (!text) { res.writeHead(400); return res.end('empty note'); }
          const entry = post({ from: 'mike', status: 'note', body: text });
          log(`note ${entry.id} from the page`);
          loop();
          res.writeHead(200, { 'content-type': 'application/json' });
          return res.end(JSON.stringify({ id: entry.id }));
        }
        res.writeHead(404);
        res.end('not found');
      } catch (error) {
        res.writeHead(500);
        res.end(error.message);
      }
    });
    server.listen(port, '127.0.0.1', () => log(`jarvis inbox on http://127.0.0.1:${port}`));
  },

  status() {
    const config = loadConfig();
    const state = loadServiceState();
    const snap = snapshot();
    console.log(`home thread: ${config.home ? `"${config.home.title}" (${config.home.threadId})` : 'none — run bind'}`);
    console.log(`watching launches since: ${config.since || state.startedAt || 'service not started'}`);
    console.log(`T3 token: ${config.tokenFile || 'missing'}`);
    console.log(`page: http://127.0.0.1:${config.port}`);
    console.log(`inbox: ${snap.entries.length} entries, ${snap.unhandled.length} unread; ${snap.outstanding.length} threads out`);
    const wake = state.wakes.at(-1);
    console.log(`last wake: ${wake ? `${wake.at} (${wake.reason})` : 'never'}`);
    console.log(`check-ins: ${state.checkins.length ? state.checkins.slice(-2).join(', ') : 'none yet'}${config.quietUntil && Date.parse(config.quietUntil) > Date.now() ? `; paused until ${config.quietUntil}` : ''}`);
  },
};

const [name, ...rest] = process.argv.slice(2);
const command = commands[name || 'help'];
if (!command) fail(`unknown command ${name}; try help`);
await command(parse(rest));
