#!/usr/bin/env node

/**
 * targeted search across Claude Code conversations.
 *
 * unlike the digest in scan.mjs, this finds specific messages by keyword or
 * regex and returns them in full (untruncated) with surrounding context and a
 * pointer to the session/file, so a buried requirements message is findable.
 *
 * scope controls how much of each message is searched (and parsed):
 *   messages  user + assistant text only (default — lean, fast)
 *   actions   + tool calls (name + input)
 *   all       + assistant reasoning (thinking blocks)
 *
 * when cc-browse is installed it answers plain keyword searches from its SQLite
 * index instead (seconds → milliseconds); see cc-browse-source.mjs. it is a pure
 * accelerator — every search still works without it.
 *
 * usage:
 *   node cc-search.mjs <query> [--regex] [--scope messages|actions|all]
 *        [--project <path> | --global] [--from YYYY-MM-DD --to YYYY-MM-DD]
 *        [--context N] [--limit N] [--case-sensitive]
 *        [--mode keyword|semantic|both] [--no-accelerate]
 */

import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { discoverSessions, parseSessionFile, truncateText } from './cc-parser.mjs';
import { resolveCcbrowse, searchViaCcbrowse } from './cc-browse-source.mjs';

const SCOPES = ['messages', 'actions', 'all'];
const MODES = ['keyword', 'semantic', 'both'];
const CONTEXT_TEXT_LENGTH = 200;

/** builds a matcher for substring or regex queries. */
function buildMatcher(query, { regex = false, caseSensitive = false } = {}) {
  if (regex) {
    const re = new RegExp(query, caseSensitive ? '' : 'i');
    return {
      test: str => re.test(str),
      firstIndex: str => {
        const m = re.exec(str);
        return m ? m.index : -1;
      },
    };
  }
  const needle = caseSensitive ? query : query.toLowerCase();
  return {
    test: str => (caseSensitive ? str : str.toLowerCase()).includes(needle),
    firstIndex: str => (caseSensitive ? str : str.toLowerCase()).indexOf(needle),
  };
}

/** returns a windowed excerpt around the first match, with ellipses. */
function excerptAround(text, index, pad = 160) {
  if (!text) return '';
  if (index < 0) return truncateText(text, pad * 2);
  const start = Math.max(0, index - pad);
  const end = Math.min(text.length, index + pad);
  return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`;
}

/** renders a tool call as a searchable / displayable one-liner. */
function toolToString(tool) {
  let input = '';
  try {
    input = JSON.stringify(tool.input ?? {});
  } catch {
    input = String(tool.input ?? '');
  }
  return `${tool.name} ${input}`.trim();
}

/** collects context neighbours (±context messages) for a hit. */
function neighbours(messages, hitIndex, context) {
  if (!context) return [];
  const out = [];
  for (let i = Math.max(0, hitIndex - context); i <= Math.min(messages.length - 1, hitIndex + context); i++) {
    if (i === hitIndex) continue;
    const m = messages[i];
    out.push({ role: m.role, seq: m.seq, text: truncateText(m.text || '', CONTEXT_TEXT_LENGTH) });
  }
  return out;
}

/**
 * searches already-parsed sessions for a query. pure logic, no I/O — discovery
 * and parsing happen in searchSessions, so this is directly unit-testable.
 * @param {Array<{sessionId, project, date, filePath, messages}>} parsedSessions
 * @returns {Array<{sessionId, project, date, role, seq, ts, matchedOn, excerpt, text, tools?, context, filePath}>}
 */
export function searchParsedSessions(parsedSessions, opts = {}) {
  const { query, regex = false, scope = 'messages', context = 1, limit = 100, caseSensitive = false } = opts;

  if (!query) throw new Error('searchParsedSessions: query is required');
  if (!SCOPES.includes(scope)) throw new Error(`scope must be one of ${SCOPES.join(', ')}`);

  const matcher = buildMatcher(query, { regex, caseSensitive });
  const wantActions = scope === 'actions' || scope === 'all';
  const wantThinking = scope === 'all';

  const hits = [];
  for (const parsed of parsedSessions) {
    if (hits.length >= limit) break;
    const messages = parsed.messages || [];

    for (let i = 0; i < messages.length; i++) {
      if (hits.length >= limit) break;
      const msg = messages[i];

      let matchedOn = null;
      let matchText = '';

      if (msg.text && matcher.test(msg.text)) {
        matchedOn = 'text';
        matchText = msg.text;
      } else if (wantActions && msg.tools?.length) {
        const tool = msg.tools.find(t => matcher.test(toolToString(t)));
        if (tool) {
          matchedOn = 'tool';
          matchText = toolToString(tool);
        }
      }
      if (!matchedOn && wantThinking && msg.thinking && matcher.test(msg.thinking)) {
        matchedOn = 'thinking';
        matchText = msg.thinking;
      }
      if (!matchedOn) continue;

      const hit = {
        sessionId: parsed.sessionId,
        project: parsed.project,
        date: parsed.date,
        role: msg.role,
        seq: msg.seq,
        ts: msg.ts,
        matchedOn,
        excerpt: excerptAround(matchText, matcher.firstIndex(matchText)),
        text: msg.text,
        context: neighbours(messages, i, context),
        filePath: parsed.filePath,
      };
      if (matchedOn === 'tool') hit.tools = msg.tools;
      if (matchedOn === 'thinking') hit.thinking = msg.thinking;
      hits.push(hit);
    }
  }

  return hits;
}

/**
 * runs the cc-browse accelerator for a search, merging modes when asked.
 * throws if the CLI fails, so the caller can fall back.
 */
async function acceleratedSearch(opts, cli) {
  const { query, project, limit = 100, mode = 'keyword' } = opts;
  const params = { query, project, limit, projectsDir: opts.projectsDir, timeoutMs: opts.timeoutMs };

  if (mode === 'semantic') return searchViaCcbrowse({ ...params, mode: 'semantic' }, cli);

  const keyword = await searchViaCcbrowse({ ...params, mode: 'content' }, cli);
  if (mode !== 'both') return keyword;

  const semantic = await searchViaCcbrowse({ ...params, mode: 'semantic' }, cli);
  const seen = new Set(keyword.map(h => h.sessionId));
  const merged = [...keyword];
  for (const hit of semantic) {
    if (seen.has(hit.sessionId)) continue;
    seen.add(hit.sessionId);
    merged.push(hit);
  }
  return merged.slice(0, limit);
}

/**
 * discovers, parses, and searches Claude Code sessions for a query.
 *
 * sessions are searched newest-first and streamed one at a time, stopping once
 * `limit` hits are collected — so coverage is never silently capped by file
 * count; a search only stops early when it has already found enough.
 *
 * when cc-browse is installed and the search is a plain case-insensitive
 * keyword search over message text with no date window, its index answers
 * instead. anything the index cannot express (regex, case sensitivity, tool or
 * thinking scopes, --from/--to) takes the slow path, as does any accelerator
 * failure.
 *
 * @returns {Promise<Array>} matching messages (see searchParsedSessions)
 */
export async function searchSessions(opts = {}) {
  const {
    query, scope = 'messages', from, to, project, global = false, limit = 100,
    regex = false, caseSensitive = false, accelerate = true, mode = 'keyword',
  } = opts;

  if (!query) throw new Error('searchSessions: query is required');
  if (!SCOPES.includes(scope)) throw new Error(`searchSessions: scope must be one of ${SCOPES.join(', ')}`);
  if (!MODES.includes(mode)) throw new Error(`searchSessions: mode must be one of ${MODES.join(', ')}`);

  const cli = accelerate ? resolveCcbrowse(opts.ccbrowse) : null;
  // the index has no date filter and no regex/case/tool-scope equivalent
  const indexable = !regex && !caseSensitive && scope === 'messages' && !from && !to;

  if (cli && indexable) {
    try {
      return await acceleratedSearch(opts, cli);
    } catch (err) {
      console.error(`cc-search: cc-browse lookup failed (${err.message}); falling back to a full scan`);
    }
  } else if (mode !== 'keyword') {
    console.error(
      cli
        ? `cc-search: --mode ${mode} needs the cc-browse index, which cannot serve this search; falling back to keyword`
        : `cc-search: --mode ${mode} needs cc-browse (github.com/thatmike1/cc-browse); falling back to keyword`
    );
  }

  const wantActions = scope === 'actions' || scope === 'all';
  const wantThinking = scope === 'all';

  const sessions = (await discoverSessions({ from, to, project, global, projectsDir: opts.projectsDir }))
    .filter(s => s.filePath)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const hits = [];
  for (const session of sessions) {
    if (hits.length >= limit) break;
    const parsed = await parseSessionFile(session.filePath, {
      maxLength: Infinity,
      includeTools: wantActions,
      includeThinking: wantThinking,
    });
    parsed.project = session.project || parsed.project;
    parsed.date = session.date || parsed.date;
    hits.push(...searchParsedSessions([parsed], { ...opts, limit: limit - hits.length }));
  }

  return hits;
}

/** formats search hits as readable markdown. */
export function formatHits(hits, { query } = {}) {
  const lines = [];
  lines.push(`# Search${query ? `: "${query}"` : ''} — ${hits.length} hit${hits.length === 1 ? '' : 's'}`, '');
  if (!hits.length) {
    lines.push('*No matches. Try widening the range (`--from`/`--to`), `--global`, or a broader `--scope`.*');
    return lines.join('\n');
  }

  for (const hit of hits) {
    const where = [hit.date, hit.project].filter(Boolean).join(' · ');

    // index hits are session-level: no seq, no neighbours, no full message text
    if (hit.source === 'cc-browse') {
      lines.push(`### ${hit.title || hit.sessionId} — ${where}`);
      const meta = [`session ${hit.sessionId}`];
      if (hit.matchCount) meta.push(`${hit.matchCount} match${hit.matchCount === 1 ? '' : 'es'}`);
      if (hit.matchedOn === 'semantic') meta.push('semantic');
      if (hit.via) meta.push(`via ${hit.via}`);
      lines.push(`*${meta.join(' · ')}*`);
      if (hit.filePath) lines.push(`\`${hit.filePath}\``);
      lines.push('');
      if (hit.excerpt) lines.push('> ' + hit.excerpt.replace(/\n/g, '\n> '), '');
      lines.push('---', '');
      continue;
    }

    lines.push(`### ${hit.role}${hit.matchedOn !== 'text' ? ` (${hit.matchedOn})` : ''} — ${where}`);
    lines.push(`*session ${hit.sessionId} · msg #${hit.seq}${hit.ts ? ` · ${hit.ts}` : ''}*`);
    lines.push(`\`${hit.filePath}\``, '');
    lines.push('> ' + hit.excerpt.replace(/\n/g, '\n> '), '');
    lines.push('<details><summary>full message</summary>', '');
    lines.push('```');
    lines.push(hit.matchedOn === 'thinking' ? hit.thinking : hit.text || '(no text)');
    lines.push('```');
    lines.push('</details>', '', '---', '');
  }
  return lines.join('\n');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { scope: 'messages', context: 1, limit: 100 };
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--regex') opts.regex = true;
    else if (a === '--global') opts.global = true;
    else if (a === '--case-sensitive') opts.caseSensitive = true;
    else if (a === '--no-accelerate') opts.accelerate = false;
    else if (a === '--mode' && args[i + 1]) opts.mode = args[++i];
    else if (a === '--scope' && args[i + 1]) opts.scope = args[++i];
    else if (a === '--project' && args[i + 1]) opts.project = resolve(args[++i]);
    else if (a === '--from' && args[i + 1]) opts.from = args[++i];
    else if (a === '--to' && args[i + 1]) opts.to = args[++i];
    else if (a === '--context' && args[i + 1]) opts.context = Number(args[++i]);
    else if (a === '--limit' && args[i + 1]) opts.limit = Number(args[++i]);
    else if (!a.startsWith('--')) positional.push(a);
  }
  opts.query = positional.join(' ');
  return opts;
}

async function main() {
  const opts = parseArgs();
  if (!opts.query) {
    console.error('usage: cc-search.mjs <query> [--regex] [--scope messages|actions|all] [--project <path>|--global] [--from --to] [--context N] [--limit N] [--case-sensitive] [--mode keyword|semantic|both] [--no-accelerate]');
    process.exit(1);
  }
  const hits = await searchSessions(opts);
  console.log(formatHits(hits, { query: opts.query }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('error:', err.message);
    process.exit(1);
  });
}
