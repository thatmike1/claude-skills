/**
 * page — the inbox as Mike sees it: what needs him, what came back, what is
 * still out, and a box to write to Jarvis. Server-rendered; the page re-fetches
 * its board every 15 seconds and never touches the box he is typing in.
 */

const DAY = 86_400_000;

function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** escaped text with bare URLs and `code` made readable; nothing else is trusted. */
function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
}

/** paragraphs and dash lists, enough for an entry body. */
function body(text) {
  return String(text || '').split(/\n\s*\n/).map(block => {
    const lines = block.split('\n');
    if (lines.every(l => /^\s*[-*] /.test(l))) {
      return `<ul>${lines.map(l => `<li>${inline(l.replace(/^\s*[-*] /, ''))}</li>`).join('')}</ul>`;
    }
    // the four report labels lead their lines, so they carry the skim
    const marked = lines.map(l => inline(l).replace(/^(What changed|Does it work|You decide|Where):/, '<strong>$1:</strong>'));
    return `<p>${marked.join('<br>')}</p>`;
  }).join('');
}

function clock(iso, now) {
  const at = new Date(iso);
  const time = at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (now - at.getTime() < DAY && at.getDate() === new Date(now).getDate()) return time;
  return `${at.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
}

const LABEL = {
  'needs-you': 'needs you', blocked: 'blocked', failed: 'failed', done: 'done',
  silent: 'went quiet', note: 'note',
};

function entryHtml(entry, now) {
  const who = entry.from === 'mike' ? 'you' : entry.from === 'jarvis' ? 'jarvis' : entry.title || 'a job';
  const flags = [
    entry.priority === 'now' ? '<span class="flag now">urgent</span>' : '',
    entry.reconstructed ? '<span class="flag">from the transcript</span>' : '',
    entry.handled ? '<span class="seen">jarvis has it</span>' : '',
  ].join('');
  return `<article class="entry s-${esc(entry.status)} f-${esc(entry.from)}">
  <header><span class="chip">${esc(LABEL[entry.status] || entry.status)}</span><span class="who">${esc(who)}</span><time>${esc(clock(entry.created, now))}</time>${flags}</header>
  <div class="body">${body(entry.body)}</div>
</article>`;
}

function column(title, takeaway, items, empty) {
  return `<section class="col">
  <h2>${esc(title)}</h2><p class="take">${esc(takeaway)}</p>
  ${items.length ? items.join('\n') : `<p class="empty">${esc(empty)}</p>`}
</section>`;
}

/**
 * the board part of the page, also served alone for the 15-second refresh.
 * @param {ReturnType<import('./service.mjs').snapshot>} snap
 * @param {{ all?: boolean }} [opts] all keeps entries older than three days
 */
export function boardHtml(snap, { all = false } = {}) {
  const { now } = snap;
  const recent = snap.entries
    .filter(e => all || now - Date.parse(e.created) < 3 * DAY)
    .reverse();
  const needs = recent.filter(e => ['needs-you', 'blocked', 'failed'].includes(e.status) && e.from !== 'mike');
  const back = recent.filter(e => ['done', 'silent'].includes(e.status));
  const notes = recent.filter(e => e.status === 'note' || e.from === 'mike');
  const running = snap.outstanding.map(t => `<article class="entry s-running">
  <header><span class="chip">${esc(t.status === 'busy' ? 'working' : 'idle')}</span><span class="who">${esc(t.title)}</span><time>since ${esc(clock(t.launchedAt, now))}</time></header>
</article>`);

  return `<div class="cols">
${column('Needs you', needs.length ? `${needs.length} waiting on a decision or stuck.` : 'Nothing is waiting on you.', needs.map(e => entryHtml(e, now)), 'Clear.')}
${column('Came back', back.length ? `${back.length} finished in the last three days.` : 'Nothing finished lately.', back.map(e => entryHtml(e, now)), 'Nothing yet.')}
${column('Still out', running.length ? `${running.length} launched and not back yet.` : 'Nothing is running.', running, 'Nothing out.')}
${column('Notes', 'What you and Jarvis wrote to each other.', notes.map(e => entryHtml(e, now)), 'No notes.')}
</div>`;
}

/** the status line under the title: where Jarvis lives and what it did last. */
function statusLine(snap) {
  const parts = [];
  parts.push(snap.home ? `jarvis lives in “${esc(snap.home.title)}”` : 'no jarvis thread bound yet: run <code>jarvis bind</code> from one');
  const wake = snap.state.wakes.at(-1);
  if (wake) parts.push(`last woken ${esc(clock(wake.at, snap.now))}: ${esc(wake.reason)}`);
  if (snap.config.quietUntil && Date.parse(snap.config.quietUntil) > snap.now) parts.push(`check-ins off until ${esc(clock(snap.config.quietUntil, snap.now))}`);
  return parts.join(' · ');
}

/** the whole page. */
export function pageHtml(snap, opts = {}) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>jarvis inbox</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400..700&family=Plus+Jakarta+Sans:wght@500..800&family=JetBrains+Mono&display=swap" rel="stylesheet">
<style>
:root { --ink:#1b1d22; --prose:#4a4e57; --muted:#8a8f99; --line:#eceef1; --canvas:#fbfbfa; --soft:#f1f2f4;
  --needs:#b4232f; --needs-bg:#fbe9ea; --done:#1f7a4d; --done-bg:#e6f4ec; --quiet:#8a6d1c; --quiet-bg:#f8f1dc; --note:#3b4fa8; --note-bg:#e9ecfa; }
* { box-sizing:border-box; }
body { margin:0; background:var(--canvas); color:var(--prose); font:435 15.25px/1.65 Figtree, Ubuntu, sans-serif; letter-spacing:-0.002em; }
.wrap { padding:28px clamp(20px, 3vw, 56px) 60px; }
h1, h2 { font-family:"Plus Jakarta Sans", sans-serif; color:var(--ink); margin:0; }
h1 { font-size:26px; font-weight:800; letter-spacing:-0.02em; }
.status { color:var(--muted); margin:2px 0 22px; }
.status code, .body code { font:13px "JetBrains Mono", monospace; background:var(--soft); padding:1px 5px; border-radius:4px; }
form { display:flex; gap:12px; align-items:flex-start; margin-bottom:30px; max-width:1100px; }
textarea { flex:1; min-height:64px; resize:vertical; font:inherit; color:var(--ink); background:#fff; border:1px solid var(--line); border-radius:10px; padding:10px 14px; }
textarea:focus { outline:2px solid #c9cfdb; }
button { font:600 14px Figtree, sans-serif; background:var(--ink); color:#fff; border:0; border-radius:10px; padding:11px 18px; cursor:pointer; }
.hint { color:var(--muted); font-size:13.5px; margin-top:-22px; margin-bottom:26px; }
.cols { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:36px; }
@media (max-width:1300px) { .cols { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
@media (max-width:760px) { .cols { grid-template-columns:1fr; } }
h2 { font-size:19.5px; font-weight:700; }
.take { color:var(--muted); margin:2px 0 14px; }
.entry { padding:12px 0 14px; border-top:1px solid var(--line); }
.entry header { display:flex; flex-wrap:wrap; gap:8px; align-items:baseline; }
.chip { font-size:12.5px; font-weight:600; padding:1px 8px; border-radius:999px; background:var(--soft); color:var(--ink); }
.s-needs-you .chip, .s-blocked .chip, .s-failed .chip { background:var(--needs-bg); color:var(--needs); }
.s-done .chip { background:var(--done-bg); color:var(--done); }
.s-silent .chip { background:var(--quiet-bg); color:var(--quiet); }
.s-note .chip { background:var(--note-bg); color:var(--note); }
.who { color:var(--ink); font-weight:600; }
time, .seen { color:var(--muted); font-size:13.5px; }
.flag { font-size:12.5px; color:var(--muted); }
.flag.now { color:var(--needs); font-weight:600; }
.body p { margin:6px 0 0; } .body ul { margin:6px 0 0; padding-left:20px; }
.body a { color:var(--note); word-break:break-all; }
.body strong { color:var(--ink); font-weight:650; }
.empty { color:var(--muted); }
</style></head>
<body><div class="wrap">
<h1>jarvis inbox</h1>
<p class="status">${statusLine(snap)}</p>
<form id="note"><textarea name="text" placeholder="write to jarvis: a note, a reply to a job, something to start…"></textarea><button type="submit">send</button></form>
<p class="hint">Ctrl+Enter sends. A note wakes Jarvis in its thread right away.</p>
<div id="board">${boardHtml(snap, opts)}</div>
</div>
<script>
const form = document.getElementById('note');
const box = form.elements.text;
async function send() {
  const text = box.value.trim();
  if (!text) return;
  const res = await fetch('/api/note', { method: 'POST', headers: { 'content-type': 'application/json', 'x-jarvis': '1' }, body: JSON.stringify({ text }) });
  if (res.ok) { box.value = ''; refresh(); } else { alert('could not save the note: ' + await res.text()); }
}
form.addEventListener('submit', e => { e.preventDefault(); send(); });
box.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
async function refresh() {
  const res = await fetch('/board' + location.search);
  if (res.ok) document.getElementById('board').innerHTML = await res.text();
}
setInterval(refresh, 15000);
</script>
</body></html>`;
}
