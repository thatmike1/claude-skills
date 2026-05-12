#!/usr/bin/env node

/**
 * orchestrator for the /morning skill.
 * gathers context from CC sessions, codex sessions, git history, memory, and beads.
 *
 * usage: node gather-context.mjs --mode repo|global [--range 1day|3days|week] [--project /path]
 * output: combined structured markdown to stdout
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { discoverSessions, parseSessionFile, truncateText as truncateClaudeText } from '../../shared/cc-parser.mjs';
import { discoverCodexSessions, truncateText as truncateCodexText } from '../../shared/codex-parser.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME = homedir();
const CLAUDE_PROJECTS_DIR = join(HOME, '.claude', 'projects');
const MAX_MSG_LENGTH = 500;
const MAX_CC_USER_MSGS = 15;
const MAX_CC_ASSISTANT_MSGS = 8;
const MAX_CODEX_USER_MSGS = 10;
const MAX_CODEX_AGENT_MSGS = 8;

/** loads config from morning/config.json, falls back to defaults */
function loadConfig() {
  const configPath = join(__dirname, '..', 'config.json');
  const defaults = {
    gitAuthor: '',
    repoDir: join(HOME, 'git'),
    workRemotePattern: 'gitlab',
    personalRemotePattern: 'github',
  };

  if (existsSync(configPath)) {
    try {
      return { ...defaults, ...JSON.parse(readFileSync(configPath, 'utf-8')) };
    } catch {}
  }
  return defaults;
}

const CONFIG = loadConfig();
const GIT_DIR = CONFIG.repoDir;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { mode: 'repo', range: '1day', project: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode' && args[i + 1]) opts.mode = args[++i];
    else if (args[i] === '--range' && args[i + 1]) opts.range = args[++i];
    else if (args[i] === '--project' && args[i + 1]) opts.project = resolve(args[++i]);
  }

  if (!['repo', 'global'].includes(opts.mode)) {
    console.error('--mode must be "repo" or "global"');
    process.exit(1);
  }
  return opts;
}

/** calculates date range based on range option and day of week */
function calculateDateRange(range) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const toDate = formatDate(today);

  let daysBack;
  switch (range) {
    case '3days':
      daysBack = 3;
      break;
    case 'week':
      daysBack = 7;
      break;
    case '1day':
    default:
      daysBack = dayOfWeek === 1 ? 3 : 1;
      break;
  }

  const from = new Date(today);
  from.setDate(from.getDate() - daysBack);
  const fromDate = formatDate(from);

  const label = daysBack === 1
    ? 'yesterday'
    : daysBack === 3 && dayOfWeek === 1
      ? 'Friday-Sunday'
      : `last ${daysBack} days`;

  return { fromDate, toDate, label };
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** gathers Claude Code sessions using shared parser modules. */
async function gatherClaudeCodeSessions(fromDate, toDate, projectPath) {
  const sessions = await discoverSessions({
    from: fromDate,
    to: toDate,
    ...(projectPath ? { project: projectPath } : {}),
  });

  if (sessions.length === 0) return '*No Claude Code sessions found for this date range.*\n';

  const lines = [`## Claude Code Sessions (${sessions.length})`, ''];
  for (const session of sessions) {
    if (!session.filePath) continue;
    const parsed = await parseSessionFile(session.filePath);
    lines.push(formatClaudeSession(session, parsed), '---', '');
  }
  return lines.join('\n');
}

/** gathers Codex sessions using shared parser modules. */
async function gatherCodexSessions(fromDate, toDate, projectPath) {
  const sessions = await discoverCodexSessions(fromDate, toDate, projectPath);
  if (sessions.length === 0) return '*No Codex sessions found matching the filters.*\n';

  const lines = [`## Codex Sessions (${sessions.length})`, ''];
  for (const session of sessions) {
    lines.push(formatCodexSession(session), '---', '');
  }
  return lines.join('\n');
}

/** formats a Claude Code session as markdown. */
function formatClaudeSession(session, parsed) {
  const lines = [];
  const title = parsed.aiTitle || session.firstPrompt || session.sessionId;
  lines.push(`### ${title}`, '');

  const meta = [];
  if (session.project) meta.push(`**Project:** ${session.project}`);
  if (parsed.branch) meta.push(`**Branch:** ${parsed.branch}`);
  if (meta.length) lines.push(meta.join(' | '), '');

  if (parsed.userMessages.length > 0) {
    const shown = parsed.userMessages.slice(0, MAX_CC_USER_MSGS);
    lines.push('**User said:**');
    for (const msg of shown) lines.push(`- ${truncateClaudeText(msg, MAX_MSG_LENGTH)}`);
    if (parsed.userMessages.length > MAX_CC_USER_MSGS) {
      lines.push(`- *...and ${parsed.userMessages.length - MAX_CC_USER_MSGS} more messages*`);
    }
    lines.push('');
  }

  if (parsed.assistantTexts.length > 0) {
    const shown = parsed.assistantTexts.slice(0, MAX_CC_ASSISTANT_MSGS);
    lines.push('**Assistant did:**');
    for (const msg of shown) lines.push(`- ${truncateClaudeText(msg, MAX_MSG_LENGTH)}`);
    if (parsed.assistantTexts.length > MAX_CC_ASSISTANT_MSGS) {
      lines.push(`- *...and ${parsed.assistantTexts.length - MAX_CC_ASSISTANT_MSGS} more responses*`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** formats a Codex session as markdown. */
function formatCodexSession(parsed) {
  const lines = [];
  const firstAgent = parsed.agentMessages[0]?.text?.slice(0, 80);
  const title = parsed.threadName || parsed.userMessages[0]?.slice(0, 80) || firstAgent || parsed.sessionId;
  lines.push(`### ${title}`, '');

  const meta = [];
  if (parsed.cwd) meta.push(`**Project:** ${parsed.cwd}`);
  if (parsed.branch) meta.push(`**Branch:** ${parsed.branch}`);
  if (meta.length) lines.push(meta.join(' | '), '');

  if (parsed.rolloutSummary) {
    const summaryLines = parsed.rolloutSummary.split('\n')
      .filter(line => !line.startsWith('thread_id:') && !line.startsWith('updated_at:') &&
        !line.startsWith('rollout_path:') && !line.startsWith('cwd:') &&
        !line.startsWith('git_branch:'))
      .join('\n').trim();

    if (summaryLines) lines.push('**Rollout summary:**', truncateCodexText(summaryLines, 800), '');
  }

  if (parsed.userMessages.length > 0) {
    const shown = parsed.userMessages.slice(0, MAX_CODEX_USER_MSGS);
    lines.push('**User said:**');
    for (const msg of shown) lines.push(`- ${truncateCodexText(msg, MAX_MSG_LENGTH)}`);
    if (parsed.userMessages.length > MAX_CODEX_USER_MSGS) {
      lines.push(`- *...and ${parsed.userMessages.length - MAX_CODEX_USER_MSGS} more messages*`);
    }
    lines.push('');
  }

  if (parsed.agentMessages.length > 0) {
    const shown = parsed.agentMessages.slice(0, MAX_CODEX_AGENT_MSGS);
    lines.push('**Agent did:**');
    for (const msg of shown) {
      const tag = msg.phase === 'final_answer' ? '[final] ' : '';
      lines.push(`- ${tag}${truncateCodexText(msg.text, MAX_MSG_LENGTH)}`);
    }
    if (parsed.agentMessages.length > MAX_CODEX_AGENT_MSGS) {
      lines.push(`- *...and ${parsed.agentMessages.length - MAX_CODEX_AGENT_MSGS} more responses*`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** detects remote type (work/personal) from git remote URL */
function getRepoType(repoPath) {
  try {
    const remote = execSync(`git -C "${repoPath}" remote get-url origin 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    if (remote.includes(CONFIG.workRemotePattern)) return 'work';
    if (remote.includes(CONFIG.personalRemotePattern)) return 'personal';
    return 'other';
  } catch {
    return 'unknown';
  }
}

/** gets git log for a repo in the date range */
function getGitLog(repoPath, fromDate, toDate) {
  try {
    const log = execSync(
      `git -C "${repoPath}" log --oneline --no-merges --since="${fromDate}" --until="${toDate}T23:59:59"${CONFIG.gitAuthor ? ` --author="${CONFIG.gitAuthor}"` : ''} 2>/dev/null`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();
    return log || null;
  } catch {
    return null;
  }
}

/** gathers git activity across repos */
function gatherGitActivity(mode, fromDate, toDate, projectPath) {
  const lines = [];

  if (mode === 'repo' && projectPath) {
    const log = getGitLog(projectPath, fromDate, toDate);
    if (log) {
      const repoName = projectPath.split('/').pop();
      const repoType = getRepoType(projectPath);
      lines.push(`### ${repoName} (${repoType})`);
      lines.push('```');
      lines.push(log);
      lines.push('```');
      lines.push('');
    }
  } else {
    if (!existsSync(GIT_DIR)) return '*~/git/ directory not found.*\n';

    const workRepos = [];
    const personalRepos = [];

    const dirs = readdirSync(GIT_DIR);
    for (const dir of dirs) {
      const repoPath = join(GIT_DIR, dir);
      const gitDir = join(repoPath, '.git');
      if (!existsSync(gitDir)) continue;

      const log = getGitLog(repoPath, fromDate, toDate);
      if (!log) continue;

      const repoType = getRepoType(repoPath);
      const entry = { name: dir, log, type: repoType };

      if (repoType === 'work') workRepos.push(entry);
      else personalRepos.push(entry);
    }

    if (workRepos.length > 0) {
      lines.push(`### Work (${CONFIG.workRemotePattern})`);
      for (const repo of workRepos) {
        lines.push(`**${repo.name}:**`);
        lines.push('```');
        lines.push(repo.log);
        lines.push('```');
        lines.push('');
      }
    }

    if (personalRepos.length > 0) {
      lines.push(`### Personal (${CONFIG.personalRemotePattern})`);
      for (const repo of personalRepos) {
        lines.push(`**${repo.name}:**`);
        lines.push('```');
        lines.push(repo.log);
        lines.push('```');
        lines.push('');
      }
    }
  }

  return lines.length > 0 ? lines.join('\n') : '*No git activity found for this date range.*\n';
}

/** reads relevant MEMORY.md files */
function gatherMemory(mode, projectPath) {
  const lines = [];

  if (mode === 'repo' && projectPath) {
    const encoded = projectPath.replace(/\//g, '-');
    const memoryFile = join(CLAUDE_PROJECTS_DIR, encoded, 'memory', 'MEMORY.md');
    if (existsSync(memoryFile)) {
      lines.push(`### ${projectPath.split('/').pop()}`);
      lines.push(readFileSync(memoryFile, 'utf-8').trim());
      lines.push('');
    }
  } else {
    try {
      const dirs = readdirSync(CLAUDE_PROJECTS_DIR);
      for (const dir of dirs) {
        const memoryFile = join(CLAUDE_PROJECTS_DIR, dir, 'memory', 'MEMORY.md');
        if (!existsSync(memoryFile)) continue;

        const content = readFileSync(memoryFile, 'utf-8').trim();
        if (!content) continue;

        const projectName = dir.replace(/^-home-thatmike1-git-/, '').replace(/-/g, '/');
        lines.push(`### ${projectName}`);
        lines.push(content);
        lines.push('');
      }
    } catch {}
  }

  return lines.length > 0 ? lines.join('\n') : '*No memory files found.*\n';
}

/** checks for open beads issues */
function gatherBeads(projectPath) {
  if (!projectPath) return '';
  const beadsDir = join(projectPath, '.beads');
  if (!existsSync(beadsDir)) return '';

  try {
    const output = execSync(`cd "${projectPath}" && bd list --status open 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    if (output) return `## Open Issues (Beads)\n\n${output}\n`;
  } catch {}
  return '';
}

async function main() {
  const opts = parseArgs();
  const { fromDate, toDate, label } = calculateDateRange(opts.range);

  console.log(`# Context Gathered: ${label} (${fromDate} to ${toDate})`);
  console.log(`**Mode:** ${opts.mode}${opts.project ? ` | **Project:** ${opts.project}` : ''}`);
  console.log('');

  const ccOutput = await gatherClaudeCodeSessions(fromDate, toDate, opts.project);
  console.log(ccOutput);

  const codexOutput = await gatherCodexSessions(fromDate, toDate, opts.project);
  console.log(codexOutput);

  console.log('## Git Activity\n');
  console.log(gatherGitActivity(opts.mode, fromDate, toDate, opts.project));

  console.log('## Memory\n');
  console.log(gatherMemory(opts.mode, opts.project));

  const beadsOutput = gatherBeads(opts.project);
  if (beadsOutput) console.log(beadsOutput);
}

main().catch(err => {
  console.error('error:', err.message);
  process.exit(1);
});
