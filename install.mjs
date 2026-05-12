#!/usr/bin/env node

/**
 * interactive installer for claude-skills.
 * lets you pick which skills to install, configures them, and creates symlinks.
 *
 * usage: node install.mjs
 */

import { createInterface } from 'readline';
import { existsSync, mkdirSync, symlinkSync, unlinkSync, writeFileSync, readFileSync, cpSync, lstatSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { homedir, platform } from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME = homedir();
const SKILLS_DIR = join(HOME, '.claude', 'skills');

const SKILLS = [
  {
    name: 'morning',
    description: 'Daily briefing — aggregates CC/Codex sessions, git, memory into an actionable morning plan',
    hasSetup: true,
  },
  {
    name: 'goblin',
    description: 'Neurodivergent thought structuring — compile braindumps, decompose tasks, estimate time, decide',
    hasSetup: false,
  },
  {
    name: 'capacities',
    description: 'Capacities.io PKM integration — save to daily notes, weblinks, search',
    hasSetup: true,
  },
  {
    name: 'invoice-subjects',
    description: 'Generate invoice subjects and newsletter blurb from git history',
    hasSetup: true,
  },
];

function createPrompt() {
  return createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function printHeader() {
  console.log('');
  console.log('  claude-skills installer');
  console.log('  ─────────────────────────');
  console.log('');
}

function printSkillList() {
  console.log('  Available skills:\n');
  SKILLS.forEach((skill, i) => {
    const installed = existsSync(join(SKILLS_DIR, skill.name));
    const status = installed ? ' (installed)' : '';
    console.log(`    ${i + 1}. ${skill.name}${status}`);
    console.log(`       ${skill.description}`);
    console.log('');
  });
}

/** parses "1,3,4" or "1 3 4" or "all" into skill indices */
function parseSelection(input) {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === 'all') return SKILLS.map((_, i) => i);
  if (trimmed === '' || trimmed === 'q') return [];

  return trimmed
    .split(/[\s,]+/)
    .map(s => parseInt(s, 10) - 1)
    .filter(i => i >= 0 && i < SKILLS.length);
}

/** removes an existing skill install (symlink or directory) */
function removeExisting(target) {
  if (!existsSync(target)) return true;
  try {
    const stat = lstatSync(target);
    if (stat.isSymbolicLink()) {
      unlinkSync(target);
    } else if (stat.isDirectory()) {
      execSync(`rm -rf "${target}"`);
    }
    return true;
  } catch {
    console.log(`    ! could not remove existing install at ${target}`);
    return false;
  }
}

/** installs a skill via symlink or copy */
function installSkill(skillName, method) {
  const source = join(__dirname, skillName);
  const target = join(SKILLS_DIR, skillName);

  if (!existsSync(source)) {
    console.log(`    ! skill directory not found: ${source}`);
    return false;
  }

  if (!removeExisting(target)) return false;

  try {
    if (method === 'symlink') {
      symlinkSync(source, target);
    } else {
      cpSync(source, target, { recursive: true });
    }
    return true;
  } catch (err) {
    console.log(`    ! install failed: ${err.message}`);
    return false;
  }
}

/** detects git author from global git config */
function detectGitAuthor() {
  try {
    return execSync('git config --global user.email', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

/** setup prompts for the morning skill */
async function setupMorning(rl) {
  console.log('\n  morning skill setup\n');

  const detectedEmail = detectGitAuthor();
  const emailPrompt = detectedEmail
    ? `    git author email [${detectedEmail}]: `
    : '    git author email: ';
  const email = (await ask(rl, emailPrompt)).trim() || detectedEmail;

  const defaultRepoDir = join(HOME, 'git');
  const repoDir = (await ask(rl, `    repo directory [${defaultRepoDir}]: `)).trim() || defaultRepoDir;

  const workPattern = (await ask(rl, '    work remote pattern [gitlab]: ')).trim() || 'gitlab';
  const personalPattern = (await ask(rl, '    personal remote pattern [github]: ')).trim() || 'github';

  const config = {
    gitAuthor: email,
    repoDir: resolve(repoDir),
    workRemotePattern: workPattern,
    personalRemotePattern: personalPattern,
  };

  const configPath = join(__dirname, 'morning', 'config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`    wrote config to morning/config.json`);
}

/** setup prompts for the capacities skill */
async function setupCapacities(rl) {
  console.log('\n  capacities skill setup\n');

  const token = (await ask(rl, '    API bearer token (from Capacities Settings > API): ')).trim();
  if (!token) {
    console.log('    skipped — you can set it up later in capacities/references/auth.md');
    return;
  }

  const authPath = join(__dirname, 'capacities', 'references', 'auth.md');
  writeFileSync(authPath, `# Capacities API Authentication

Bearer token for API access:

\`\`\`
${token}
\`\`\`

Use in all requests as:
\`\`\`
Authorization: Bearer ${token}
\`\`\`
`);
  console.log('    wrote token to capacities/references/auth.md');

  const spaceId = (await ask(rl, '    space ID (from Capacities URL or API): ')).trim();
  if (spaceId) {
    const skillPath = join(__dirname, 'capacities', 'SKILL.md');
    let content = readFileSync(skillPath, 'utf-8');
    content = content.replace(/YOUR_SPACE_ID/g, spaceId);
    writeFileSync(skillPath, content);
    console.log('    updated space ID in capacities/SKILL.md');
  }
}

/** setup prompts for the invoice-subjects skill */
async function setupInvoiceSubjects(rl) {
  console.log('\n  invoice-subjects skill setup\n');

  const detectedEmail = detectGitAuthor();
  const emailPrompt = detectedEmail
    ? `    git author email [${detectedEmail}]: `
    : '    git author email: ';
  const email = (await ask(rl, emailPrompt)).trim() || detectedEmail;

  const defaultRepoDir = join(HOME, 'git');
  const repoDir = (await ask(rl, `    repo directory [${defaultRepoDir}]: `)).trim() || defaultRepoDir;

  const reposInput = (await ask(rl, '    work repo names (comma-separated, e.g. "my-app, my-api"): ')).trim();
  const workRepos = reposInput ? reposInput.split(/[\s,]+/).filter(Boolean) : [];

  if (workRepos.length === 0) {
    console.log('    no repos specified — you can edit invoice-subjects/config.json later');
  }

  const lang = (await ask(rl, '    language for invoice output [czech]: ')).trim() || 'czech';

  const config = {
    gitAuthor: email,
    repoDir: resolve(repoDir),
    workRepos,
    language: lang,
    projectNames: {},
    forbiddenWords: [],
  };

  if (workRepos.length > 0) {
    console.log('    project display names (press enter to use repo name as-is):');
    for (const repo of workRepos) {
      const name = (await ask(rl, `      ${repo} → `)).trim();
      if (name) config.projectNames[repo] = name;
    }
  }

  const configPath = join(__dirname, 'invoice-subjects', 'config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`    wrote config to invoice-subjects/config.json`);
}

async function main() {
  printHeader();

  if (!existsSync(SKILLS_DIR)) {
    mkdirSync(SKILLS_DIR, { recursive: true });
  }

  const rl = createPrompt();

  try {
    printSkillList();

    const input = await ask(rl, '  which skills to install? (numbers, comma-separated, or "all"): ');
    const selected = parseSelection(input);

    if (selected.length === 0) {
      console.log('\n  nothing selected, exiting.\n');
      return;
    }

    console.log('');
    const methodInput = (await ask(rl, '  install method — symlink or copy? [symlink]: ')).trim().toLowerCase();
    const method = methodInput === 'copy' ? 'copy' : 'symlink';

    console.log('');

    for (const idx of selected) {
      const skill = SKILLS[idx];
      console.log(`  installing ${skill.name}...`);

      if (skill.hasSetup) {
        const setupFns = { morning: setupMorning, capacities: setupCapacities, 'invoice-subjects': setupInvoiceSubjects };
        const setupFn = setupFns[skill.name];
        if (setupFn) await setupFn(rl);
      }

      if (installSkill(skill.name, method)) {
        const label = method === 'symlink' ? 'symlinked' : 'copied';
        console.log(`    done — ${label} to ${SKILLS_DIR}/${skill.name}\n`);
      }
    }

    console.log('  all done! restart claude code to pick up the new skills.\n');

  } finally {
    rl.close();
  }
}

main().catch(err => {
  console.error('error:', err.message);
  process.exit(1);
});
