#!/usr/bin/env node

/**
 * orchestrator for the /morning skill.
 * gathers context from CC sessions, codex sessions, git history, memory, and beads.
 *
 * usage: node gather-context.mjs --mode repo|global [--range 1day|3days|week] [--project /path]
 * output: combined structured markdown to stdout
 */

import { execSync, execFileSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME = homedir();
const CLAUDE_PROJECTS_DIR = join(HOME, '.claude', 'projects');

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

/** runs a script and returns stdout */
function runScript(scriptName, args) {
  const scriptPath = join(__dirname, scriptName);
  try {
    return execFileSync('node', [scriptPath, ...args], {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    return `*Error running ${scriptName}: ${err.message}*\n`;
  }
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

  const projectArgs = opts.project ? ['--project', opts.project] : [];

  console.log(`# Context Gathered: ${label} (${fromDate} to ${toDate})`);
  console.log(`**Mode:** ${opts.mode}${opts.project ? ` | **Project:** ${opts.project}` : ''}`);
  console.log('');

  const ccOutput = runScript('parse-cc-sessions.mjs', ['--from', fromDate, '--to', toDate, ...projectArgs]);
  console.log(ccOutput);

  const codexOutput = runScript('parse-codex-sessions.mjs', ['--from', fromDate, '--to', toDate, ...projectArgs]);
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
