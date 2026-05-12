#!/usr/bin/env node

/**
 * scans ~/.claude/ for evidence of advanced AI usage.
 */

import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const CLAUDE_DIR = join(homedir(), '.claude');

/** lists installed skills with descriptions. */
function scanSkills() {
  const skillsDir = join(CLAUDE_DIR, 'skills');
  const results = [];
  if (!existsSync(skillsDir)) return results;

  for (const name of readdirSync(skillsDir).sort()) {
    const skillDir = join(skillsDir, name);
    const info = lstatSync(skillDir);
    if (!info.isDirectory() && !info.isSymbolicLink()) continue;

    if (info.isSymbolicLink()) {
      results.push({ name, type: 'symlink', target: readlinkSync(skillDir) });
      continue;
    }

    const skillMd = join(skillDir, 'SKILL.md');
    if (!existsSync(skillMd)) continue;

    let description = '';
    for (const line of readFileSync(skillMd, 'utf-8').split('\n')) {
      if (line.startsWith('description:')) {
        description = line.split(':').slice(1).join(':').trim();
        break;
      }
    }
    results.push({ name, type: 'custom', description });
  }

  return results;
}

/** lists custom slash commands. */
function scanCommands() {
  const commandsDir = join(CLAUDE_DIR, 'commands');
  const results = [];
  if (!existsSync(commandsDir)) return results;

  for (const file of readdirSync(commandsDir).sort()) {
    if (!file.endsWith('.md')) continue;
    const filePath = join(commandsDir, file);
    results.push({
      name: file.replace(/\.md$/, ''),
      preview: readFileSync(filePath, 'utf-8').slice(0, 200),
    });
  }
  return results;
}

/** finds MCP server configurations. */
function scanMcpServers() {
  const results = [];
  for (const settingsFile of [
    join(CLAUDE_DIR, 'settings.json'),
    join(CLAUDE_DIR, 'settings.local.json'),
  ]) {
    if (!existsSync(settingsFile)) continue;
    try {
      const data = JSON.parse(readFileSync(settingsFile, 'utf-8'));
      const mcps = data.mcpServers || {};
      for (const [name, config] of Object.entries(mcps)) {
        results.push({
          name,
          command: config.command || '',
          args: Array.isArray(config.args) ? config.args.slice(0, 3) : [],
          source: settingsFile.split('/').pop(),
        });
      }
    } catch {}
  }

  const projectsDir = join(CLAUDE_DIR, 'projects');
  if (!existsSync(projectsDir)) return results;

  for (const project of readdirSync(projectsDir)) {
    const settingsFile = join(projectsDir, project, 'settings.json');
    if (!existsSync(settingsFile)) continue;
    try {
      const data = JSON.parse(readFileSync(settingsFile, 'utf-8'));
      const mcps = data.mcpServers || {};
      for (const [name, config] of Object.entries(mcps)) {
        results.push({
          name,
          command: config.command || '',
          source: `projects/${project}`,
        });
      }
    } catch {}
  }

  return results;
}

/** finds configured hooks. */
function scanHooks() {
  const results = [];
  for (const settingsFile of [
    join(CLAUDE_DIR, 'settings.json'),
    join(CLAUDE_DIR, 'settings.local.json'),
  ]) {
    if (!existsSync(settingsFile)) continue;
    try {
      const data = JSON.parse(readFileSync(settingsFile, 'utf-8'));
      const hooks = data.hooks || {};
      for (const [event, hookList] of Object.entries(hooks)) {
        if (!Array.isArray(hookList)) continue;
        for (const hook of hookList) {
          results.push({
            event,
            command: hook.command || '',
            source: settingsFile.split('/').pop(),
          });
        }
      }
    } catch {}
  }
  return results;
}

/** finds CLAUDE.md and memory files. */
function scanClaudeMdFiles() {
  const results = [];
  const globalMd = join(CLAUDE_DIR, 'CLAUDE.md');
  if (existsSync(globalMd)) {
    results.push({
      path: globalMd,
      size: statSync(globalMd).size,
      type: 'global',
    });
  }

  const projectsDir = join(CLAUDE_DIR, 'projects');
  if (existsSync(projectsDir)) {
    for (const project of readdirSync(projectsDir)) {
      const projectDir = join(projectsDir, project);
      if (!statSync(projectDir).isDirectory()) continue;

      const memoryDir = join(projectDir, 'memory');
      if (!existsSync(memoryDir)) continue;
      const memoryFiles = readdirSync(memoryDir).filter(file => file.endsWith('.md'));
      if (memoryFiles.length) {
        results.push({
          path: memoryDir,
          type: 'memory',
          file_count: memoryFiles.length,
          project,
        });
      }
    }
  }

  const gitDir = join(homedir(), 'git');
  if (existsSync(gitDir)) {
    for (const repo of readdirSync(gitDir)) {
      const claudeMd = join(gitDir, repo, 'CLAUDE.md');
      if (!existsSync(claudeMd)) continue;
      results.push({
        path: claudeMd,
        size: statSync(claudeMd).size,
        type: 'project',
        project: repo,
      });
    }
  }

  return results;
}

/** calculates basic stats from history.jsonl. */
async function scanHistoryStats() {
  const history = join(CLAUDE_DIR, 'history.jsonl');
  if (!existsSync(history)) return {};

  let total = 0;
  const projects = new Set();
  let earliest = null;
  let latest = null;

  const rl = createInterface({ input: createReadStream(history) });
  for await (const line of rl) {
    try {
      const entry = JSON.parse(line);
      total += 1;
      projects.add(entry.project || 'unknown');
      const ts = entry.timestamp;
      if (!ts) continue;
      if (earliest === null || ts < earliest) earliest = ts;
      if (latest === null || ts > latest) latest = ts;
    } catch {}
  }

  return {
    total_prompts: total,
    unique_projects: projects.size,
    earliest_timestamp: earliest,
    latest_timestamp: latest,
  };
}

async function main() {
  const report = {
    skills: scanSkills(),
    commands: scanCommands(),
    mcp_servers: scanMcpServers(),
    hooks: scanHooks(),
    claude_md_files: scanClaudeMdFiles(),
    history_stats: await scanHistoryStats(),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch(err => {
  console.error('error:', err.message);
  process.exit(1);
});
