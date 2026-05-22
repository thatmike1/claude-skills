#!/usr/bin/env node

/**
 * gathers Claude Code usage metadata for health check analysis.
 * focuses on patterns and anti-patterns, not conversation content.
 *
 * usage: node gather-audit-data.mjs [--days 30] [--repos-dir ~/git]
 * output: structured markdown to stdout
 */

import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { homedir, platform } from 'os';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { discoverSessionsFromIndex, decodeProjectName } from '../../shared/cc-parser.mjs';

const HOME = homedir();
const CLAUDE_DIR = join(HOME, '.claude');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');

const SYSTEM_PATH_PATTERNS = [
  /^[A-Z]:[/\\]Windows/i,
  /^[A-Z]:[/\\]Program Files/i,
  /^[A-Z]:[/\\]ProgramData/i,
  /^\/usr\//,
  /^\/etc\//,
  /^\/var\//,
  /^\/tmp\//,
  /^\/opt\//,
  /^\/bin\//,
  /^\/sbin\//,
  /^\/System\//,
  /^\/Library\//,
];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { days: 30, reposDir: join(HOME, 'git') };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) opts.days = parseInt(args[++i], 10);
    else if (args[i] === '--repos-dir' && args[i + 1]) opts.reposDir = resolve(args[++i]);
  }
  return opts;
}

/** classifies a project path as system, home-root, or project. */
function classifyProjectPath(projectPath) {
  if (!projectPath) return 'unknown';

  const normalized = projectPath.replace(/\\/g, '/');

  for (const pattern of SYSTEM_PATH_PATTERNS) {
    if (pattern.test(projectPath) || pattern.test(normalized)) return 'system';
  }

  const homeNormalized = HOME.replace(/\\/g, '/');
  if (normalized === homeNormalized || normalized === homeNormalized + '/') return 'home-root';

  return 'project';
}

/** counts messages and collects metadata without reading full content. */
async function getSessionMetadata(filePath) {
  let userMessages = 0;
  let assistantMessages = 0;
  let toolUses = 0;
  let firstTimestamp = null;
  let lastTimestamp = null;
  let hasCompaction = false;

  try {
    const rl = createInterface({ input: createReadStream(filePath) });
    for await (const line of rl) {
      try {
        const record = JSON.parse(line);

        if (record.timestamp) {
          if (!firstTimestamp) firstTimestamp = record.timestamp;
          lastTimestamp = record.timestamp;
        }

        if (record.type === 'user' && !record.isMeta) {
          userMessages++;
        } else if (record.type === 'assistant') {
          assistantMessages++;
          if (Array.isArray(record.message?.content)) {
            for (const block of record.message.content) {
              if (block.type === 'tool_use') toolUses++;
            }
          }
        } else if (record.type === 'summary') {
          hasCompaction = true;
        }
      } catch {}
    }
  } catch {}

  let fileSize = 0;
  try { fileSize = statSync(filePath).size; } catch {}

  return {
    userMessages,
    assistantMessages,
    totalMessages: userMessages + assistantMessages,
    toolUses,
    fileSize,
    firstTimestamp,
    lastTimestamp,
    hasCompaction,
  };
}

/** scans memory directories under ~/.claude/projects/ for organization issues. */
function scanMemories() {
  const memories = [];
  if (!existsSync(PROJECTS_DIR)) return memories;

  for (const dir of readdirSync(PROJECTS_DIR)) {
    const memoryDir = join(PROJECTS_DIR, dir, 'memory');
    if (!existsSync(memoryDir)) continue;

    try {
      const files = readdirSync(memoryDir).filter(f => f.endsWith('.md'));
      const indexFile = join(memoryDir, 'MEMORY.md');
      let indexEntries = 0;

      if (existsSync(indexFile)) {
        const content = readFileSync(indexFile, 'utf-8');
        indexEntries = content.split('\n').filter(l => l.trim().startsWith('-')).length;
      }

      memories.push({
        projectDir: dir,
        projectPath: decodeProjectName(dir),
        fileCount: files.length,
        indexEntries,
        hasIndex: existsSync(indexFile),
      });
    } catch {}
  }

  return memories;
}

/** scans a repos directory for CLAUDE.md presence. */
function scanReposForClaudeMd(reposDir) {
  const results = [];
  if (!existsSync(reposDir)) return results;

  try {
    for (const dir of readdirSync(reposDir)) {
      const repoPath = join(reposDir, dir);
      try {
        if (!statSync(repoPath).isDirectory()) continue;
      } catch { continue; }
      if (!existsSync(join(repoPath, '.git'))) continue;

      results.push({
        repo: dir,
        repoPath,
        hasClaudeMd: existsSync(join(repoPath, 'CLAUDE.md')),
      });
    }
  } catch {}

  return results;
}

/** checks for raw project directory names that encode system paths. */
function scanProjectDirsForSystemPaths() {
  const flagged = [];
  if (!existsSync(PROJECTS_DIR)) return flagged;

  for (const dir of readdirSync(PROJECTS_DIR)) {
    const decoded = decodeProjectName(dir);
    const classification = classifyProjectPath(decoded);
    if (classification === 'system' || classification === 'home-root') {
      const sessionCount = countFilesInDir(join(PROJECTS_DIR, dir), '.jsonl');
      const hasMemory = existsSync(join(PROJECTS_DIR, dir, 'memory'));
      flagged.push({ dir, decoded, classification, sessionCount, hasMemory });
    }
  }

  return flagged;
}

/** counts files with a given extension in a directory. */
function countFilesInDir(dirPath, ext) {
  try {
    return readdirSync(dirPath).filter(f => f.endsWith(ext) && !f.startsWith('agent-')).length;
  } catch {
    return 0;
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function main() {
  const opts = parseArgs();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - opts.days);
  const cutoffISO = cutoffDate.toISOString();

  console.log(`# Claude Code Audit Data`);
  console.log(`**Scan date:** ${new Date().toISOString().slice(0, 10)}`);
  console.log(`**Lookback:** ${opts.days} days`);
  console.log(`**Repos dir:** ${opts.reposDir}`);
  console.log('');

  // --- session discovery ---
  const allSessions = await discoverSessionsFromIndex();
  const recentSessions = allSessions.filter(s => s.timestamp && s.timestamp >= cutoffISO);

  console.log(`## Session Overview`);
  console.log(`- **Total sessions (all time):** ${allSessions.length}`);
  console.log(`- **Sessions in last ${opts.days} days:** ${recentSessions.length}`);
  console.log('');

  // --- launch directory classification ---
  const pathGroups = { system: [], 'home-root': [], project: [], unknown: [] };
  const projectCounts = new Map();

  for (const session of allSessions) {
    const cls = classifyProjectPath(session.project);
    pathGroups[cls].push(session);
    const key = session.project || '(unknown)';
    projectCounts.set(key, (projectCounts.get(key) || 0) + 1);
  }

  console.log(`## Launch Directory Analysis`);
  console.log(`- **From project directories:** ${pathGroups.project.length}`);
  console.log(`- **From system directories:** ${pathGroups.system.length}`);
  console.log(`- **From home directory root:** ${pathGroups['home-root'].length}`);
  console.log(`- **Unknown/unresolved:** ${pathGroups.unknown.length}`);
  console.log('');

  if (pathGroups.system.length > 0) {
    console.log(`### System Directory Sessions [CRITICAL]`);
    const systemPaths = new Map();
    for (const s of pathGroups.system) {
      const p = s.project || '(unknown)';
      systemPaths.set(p, (systemPaths.get(p) || 0) + 1);
    }
    for (const [path, count] of systemPaths) {
      console.log(`- \`${path}\`: ${count} sessions`);
    }
    console.log('');
  }

  if (pathGroups['home-root'].length > 0) {
    console.log(`### Home Root Sessions [WARNING]`);
    console.log(`- ${pathGroups['home-root'].length} sessions launched from home directory without project context`);
    console.log('');
  }

  // --- flagged project directories ---
  const flaggedDirs = scanProjectDirsForSystemPaths();
  if (flaggedDirs.length > 0) {
    console.log(`### Flagged Project Directories`);
    console.log('These directories inside ~/.claude/projects/ encode system or home-root paths:');
    console.log('');
    for (const f of flaggedDirs) {
      console.log(`- \`${f.dir}\` -> \`${f.decoded}\` (${f.classification}, ${f.sessionCount} session files${f.hasMemory ? ', has memory dir' : ''})`);
    }
    console.log('');
  }

  // --- session patterns (recent, capped for performance) ---
  console.log(`## Session Patterns (last ${opts.days} days)`);

  const sessionMeta = [];
  const toAnalyze = recentSessions.filter(s => s.filePath && existsSync(s.filePath)).slice(0, 100);

  for (const session of toAnalyze) {
    const meta = await getSessionMetadata(session.filePath);
    sessionMeta.push({ ...session, ...meta });
  }

  if (sessionMeta.length === 0) {
    console.log('*No recent session files available for analysis.*');
    console.log('');
  } else {
    const sizes = sessionMeta.map(s => s.fileSize).sort((a, b) => a - b);
    const msgCounts = sessionMeta.map(s => s.totalMessages).sort((a, b) => a - b);
    const withCompaction = sessionMeta.filter(s => s.hasCompaction).length;

    const median = arr => arr[Math.floor(arr.length / 2)];
    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    console.log(`**Analyzed:** ${sessionMeta.length} sessions`);
    console.log('');

    console.log(`### File Sizes (proxy for context usage)`);
    console.log(`- Median: ${formatBytes(median(sizes))}`);
    console.log(`- Average: ${formatBytes(avg(sizes))}`);
    console.log(`- Max: ${formatBytes(sizes[sizes.length - 1])}`);
    console.log(`- Over 1MB: ${sizes.filter(s => s > 1024 * 1024).length} sessions`);
    console.log(`- Over 5MB: ${sizes.filter(s => s > 5 * 1024 * 1024).length} sessions`);
    console.log('');

    console.log(`### Message Counts`);
    console.log(`- Median per session: ${median(msgCounts)}`);
    console.log(`- Average: ${avg(msgCounts)}`);
    console.log(`- Max: ${msgCounts[msgCounts.length - 1]}`);
    console.log(`- Sessions over 100 messages: ${msgCounts.filter(m => m > 100).length}`);
    console.log(`- Sessions over 200 messages: ${msgCounts.filter(m => m > 200).length}`);
    console.log('');

    console.log(`### Compaction Usage`);
    const compactPct = sessionMeta.length ? Math.round(withCompaction / sessionMeta.length * 100) : 0;
    console.log(`- Sessions using /compact or auto-compact: ${withCompaction} of ${sessionMeta.length} (${compactPct}%)`);
    console.log('');

    const largest = [...sessionMeta].sort((a, b) => b.fileSize - a.fileSize).slice(0, 5);
    if (largest[0]?.fileSize > 500 * 1024) {
      console.log(`### Largest Sessions`);
      for (const s of largest) {
        if (s.fileSize < 500 * 1024) break;
        const title = (s.summary || s.firstPrompt || s.sessionId).slice(0, 60);
        console.log(`- ${formatBytes(s.fileSize)} | ${s.totalMessages} msgs | \`${s.project || '?'}\` | ${title}`);
      }
      console.log('');
    }

    const longest = [...sessionMeta].sort((a, b) => b.totalMessages - a.totalMessages).slice(0, 5);
    if (longest[0]?.totalMessages > 50) {
      console.log(`### Longest Sessions (by message count)`);
      for (const s of longest) {
        if (s.totalMessages < 30) break;
        const title = (s.summary || s.firstPrompt || s.sessionId).slice(0, 60);
        const compactLabel = s.hasCompaction ? ' [compacted]' : '';
        console.log(`- ${s.totalMessages} msgs | ${formatBytes(s.fileSize)} | \`${s.project || '?'}\` | ${title}${compactLabel}`);
      }
      console.log('');
    }
  }

  // --- memory organization ---
  console.log(`## Memory Organization`);
  const memories = scanMemories();

  if (memories.length === 0) {
    console.log('*No memory directories found.*');
    console.log('');
  } else {
    const totalFiles = memories.reduce((sum, m) => sum + m.fileCount, 0);
    console.log(`- **Memory locations:** ${memories.length} project directories`);
    console.log(`- **Total memory files:** ${totalFiles}`);
    console.log('');

    for (const mem of memories.sort((a, b) => b.fileCount - a.fileCount)) {
      const cls = classifyProjectPath(mem.projectPath);
      const flag = cls === 'system' ? ' [SYSTEM DIR]' : cls === 'home-root' ? ' [HOME ROOT]' : '';
      const orphanWarning = !mem.hasIndex && mem.fileCount > 0 ? ' [NO INDEX]' : '';
      console.log(`- \`${mem.projectPath}\`: ${mem.fileCount} files, ${mem.indexEntries} index entries${flag}${orphanWarning}`);
    }
    console.log('');
  }

  // --- CLAUDE.md coverage ---
  console.log(`## CLAUDE.md Coverage`);
  const repos = scanReposForClaudeMd(opts.reposDir);

  if (repos.length === 0) {
    console.log(`*No git repos found in ${opts.reposDir}.*`);
    console.log('');
  } else {
    const withClaude = repos.filter(r => r.hasClaudeMd);
    const withoutClaude = repos.filter(r => !r.hasClaudeMd);

    const activeRepoNames = new Set();
    for (const session of allSessions) {
      if (!session.project) continue;
      const name = session.project.split('/').pop();
      if (name) activeRepoNames.add(name);
    }

    const activeWithout = withoutClaude.filter(r => activeRepoNames.has(r.repo));
    const activeWith = withClaude.filter(r => activeRepoNames.has(r.repo));
    const inactiveWith = withClaude.filter(r => !activeRepoNames.has(r.repo));

    console.log(`- **Repos scanned:** ${repos.length}`);
    console.log(`- **With CLAUDE.md:** ${withClaude.length}`);
    console.log(`- **Without CLAUDE.md:** ${withoutClaude.length}`);
    console.log(`- **Active repos with CLAUDE.md:** ${activeWith.length}`);
    console.log(`- **Active repos missing CLAUDE.md:** ${activeWithout.length}`);
    console.log('');

    if (activeWithout.length > 0) {
      console.log(`### Active Repos Without CLAUDE.md`);
      for (const r of activeWithout) {
        console.log(`- \`${r.repo}\``);
      }
      console.log('');
    }

    const nonProjectSessions = pathGroups.system.length + pathGroups['home-root'].length;
    if (nonProjectSessions > 0 && withClaude.length > 0) {
      console.log(`### CLAUDE.md Bypass Warning`);
      console.log(`${nonProjectSessions} sessions launched from non-project directories cannot use project-level CLAUDE.md files.`);
      console.log(`This means ${withClaude.length} existing CLAUDE.md file(s) may be partially or fully unused.`);
      console.log('');
    }
  }

  // --- global config ---
  console.log(`## Global Configuration`);
  console.log(`- **~/.claude/CLAUDE.md:** ${existsSync(join(CLAUDE_DIR, 'CLAUDE.md')) ? 'exists' : 'MISSING'}`);
  console.log(`- **~/.claude/settings.json:** ${existsSync(join(CLAUDE_DIR, 'settings.json')) ? 'exists' : 'not found'}`);

  const skillsDir = join(CLAUDE_DIR, 'skills');
  if (existsSync(skillsDir)) {
    try {
      const skills = readdirSync(skillsDir).filter(d => {
        try { return statSync(join(skillsDir, d)).isDirectory(); } catch { return false; }
      });
      console.log(`- **Installed skills:** ${skills.length} (${skills.join(', ') || 'none'})`);
    } catch {
      console.log(`- **Skills dir:** exists but unreadable`);
    }
  } else {
    console.log(`- **Skills dir:** not found`);
  }
  console.log('');

  // --- project directory activity summary ---
  console.log(`## Project Activity Summary`);
  const sorted = [...projectCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [project, count] of sorted.slice(0, 20)) {
    const cls = classifyProjectPath(project);
    const flag = cls !== 'project' && cls !== 'unknown' ? ` [${cls.toUpperCase()}]` : '';
    console.log(`- \`${project}\`: ${count} sessions${flag}`);
  }
  if (sorted.length > 20) {
    console.log(`- *...and ${sorted.length - 20} more*`);
  }
  console.log('');
}

main().catch(err => {
  console.error('error:', err.message);
  process.exit(1);
});
