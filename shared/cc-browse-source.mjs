/**
 * optional cc-browse accelerator for conversation search.
 *
 * cc-browse (github.com/thatmike1/cc-browse) keeps a SQLite index of
 * ~/.claude/projects and answers a corpus-wide search in a fraction of a second,
 * where re-parsing every JSONL takes tens of seconds. it is never required: if
 * it is not installed, resolveCcbrowse returns null and callers keep their own
 * slow path. nothing here is vendored from it — we only shell out to its CLI.
 */

import { execFile } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { delimiter, join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const SCRIPT_NAME = 'ccbrowse.py';
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_BUFFER = 32 * 1024 * 1024;

/** true when `name` exists as a file in one of the PATH directories. */
function onPath(name, pathValue) {
  if (!pathValue) return null;
  for (const dir of pathValue.split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, name);
    try {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    } catch {
      // unreadable PATH entry — keep looking
    }
  }
  return null;
}

/**
 * locates a usable ccbrowse CLI invocation.
 *
 * order: disabled by CC_SKILLS_NO_CCBROWSE → $CCBROWSE_PY → ccbrowse.py on PATH
 * → ~/git/cc-browse/ccbrowse.py. the runner is `uv run` when uv is on PATH,
 * otherwise `python3` (which loses semantic mode but still answers the rest).
 *
 * @param {{env?: NodeJS.ProcessEnv, home?: string, argv?: string[]}} [opts]
 *   `argv` short-circuits resolution with an explicit command prefix (tests).
 * @returns {{argv: string[], script: string|null} | null} null when unavailable
 */
export function resolveCcbrowse(opts = {}) {
  const env = opts.env ?? process.env;
  if (env.CC_SKILLS_NO_CCBROWSE) return null;
  if (opts.argv?.length) return { argv: [...opts.argv], script: opts.argv.at(-1) };

  const home = opts.home ?? homedir();
  const candidates = [
    env.CCBROWSE_PY || null,
    onPath(SCRIPT_NAME, env.PATH),
    join(home, 'git', 'cc-browse', SCRIPT_NAME),
  ];
  const script = candidates.find(p => p && existsSync(p));
  if (!script) return null;

  const runner = onPath('uv', env.PATH) ? ['uv', 'run'] : ['python3'];
  return { argv: [...runner, script], script };
}

/** cached listing of ~/.claude/projects so filePath resolution stays one readdir. */
let projectDirsCache = null;

/** best-effort path of a session's JSONL, so hits stay clickable. */
function resolveSessionFile(sessionId, projectsDir) {
  if (!sessionId) return null;
  if (!projectDirsCache || projectDirsCache.dir !== projectsDir) {
    let dirs = [];
    try {
      dirs = readdirSync(projectsDir);
    } catch {
      dirs = [];
    }
    projectDirsCache = { dir: projectsDir, dirs };
  }
  for (const dir of projectDirsCache.dirs) {
    const candidate = join(projectsDir, dir, `${sessionId}.jsonl`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** maps one cc-browse session row onto the cc-search hit shape. */
function toHit(row, mode, projectsDir) {
  return {
    sessionId: row.session_id,
    project: row.project || null,
    date: row.day || null,
    ts: row.modified || row.created || null,
    title: row.title || null,
    branch: row.branch || null,
    role: null,
    seq: null,
    matchedOn: mode === 'semantic' ? 'semantic' : 'text',
    excerpt: row.snip || row.first_prompt || '',
    text: row.snip || null,
    matchCount: typeof row.n_hits === 'number' ? row.n_hits : null,
    context: [],
    filePath: resolveSessionFile(row.session_id, projectsDir),
    source: 'cc-browse',
    ...(row.via_subagent ? { via: 'subagent' } : {}),
  };
}

/**
 * runs one ccbrowse search and returns hits in the cc-search shape.
 *
 * throws on anything unexpected (missing CLI, non-zero exit, timeout,
 * unparseable stdout) so the caller can fall back to its own search. stderr is
 * ignored: the CLI prints a staleness warning there and still answers.
 *
 * @param {{query: string, mode?: 'content'|'semantic'|'meta', project?: string, limit?: number,
 *          timeoutMs?: number, projectsDir?: string}} params
 * @param {{argv: string[]}} [resolved] result of resolveCcbrowse; resolved lazily when omitted
 * @returns {Promise<Array<object>>}
 */
export async function searchViaCcbrowse(params, resolved) {
  const { query, mode = 'content', project, limit = 100 } = params;
  if (!query) throw new Error('searchViaCcbrowse: query is required');

  const cli = resolved === undefined ? resolveCcbrowse() : resolved;
  if (!cli) throw new Error('searchViaCcbrowse: cc-browse is not available');

  const args = [...cli.argv.slice(1), 'search', query, '--mode', mode, '--json', '--limit', String(limit)];
  if (project) args.push('--project', project);

  const { stdout } = await execFileAsync(cli.argv[0], args, {
    timeout: params.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
  });

  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error('searchViaCcbrowse: could not parse ccbrowse --json output');
  }
  if (!payload || !Array.isArray(payload.sessions)) {
    throw new Error('searchViaCcbrowse: unexpected ccbrowse payload (no sessions array)');
  }

  const projectsDir = params.projectsDir ?? join(homedir(), '.claude', 'projects');
  return payload.sessions.map(row => toHit(row, mode, projectsDir));
}
