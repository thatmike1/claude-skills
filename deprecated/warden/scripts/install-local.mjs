#!/usr/bin/env node
import { cp, mkdir, lstat, readlink, symlink, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const skillDir = dirname(dirname(fileURLToPath(import.meta.url)));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const skillParent = join(homedir(), '.agents', 'skills');
const serviceParent = join(homedir(), '.config', 'systemd', 'user');
const skillLink = join(skillParent, 'warden');

/** preserve a user-config directory before adding an installation to it. */
async function backup(path) {
  try {
    await lstat(path);
    const destination = `${path}.backup-${stamp}`;
    await cp(path, destination, { recursive: true, verbatimSymlinks: true });
    console.log(`Backup: ${destination}`);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

/** quote a systemd argument, including its literal percent expansion. */
function unitQuote(value) {
  return `"${value.replaceAll('%', '%%').replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

if (process.argv.includes('--help')) {
  console.log('Usage: node install-local.mjs\nInstall the Warden skill for Codex and enable its passive localhost user service. No day plan is started.');
} else {
  if (process.platform !== 'linux') throw new Error('The local service installer currently supports Linux with systemd.');
  try {
    const existing = await lstat(skillLink);
    if (!existing.isSymbolicLink() || await readlink(skillLink) !== skillDir) throw new Error(`An unrelated skill already exists at ${skillLink}.`);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await backup(skillParent);
  await backup(serviceParent);
  await mkdir(skillParent, { recursive: true });
  await mkdir(serviceParent, { recursive: true });
  try { await symlink(skillDir, skillLink, 'dir'); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const unit = `[Unit]\nDescription=Warden day plan and check-ins\nAfter=graphical-session.target\n\n[Service]\nType=simple\nExecStart=${unitQuote(process.execPath)} ${unitQuote(join(skillDir, 'scripts', 'warden.mjs'))} serve\nRestart=on-failure\nRestartSec=5\nUMask=0077\n\n[Install]\nWantedBy=default.target\n`;
  await writeFile(join(serviceParent, 'warden.service'), unit);
  await execute('systemctl', ['--user', 'daemon-reload']);
  await execute('systemctl', ['--user', 'enable', '--now', 'warden.service']);
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:1339/api/state', { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Warden did not become ready. Inspect systemctl --user status warden.service.');
  const { stdout } = await execute('systemctl', ['--user', 'is-active', 'warden.service']);
  console.log(`Warden service: ${stdout.trim()}\nSkill: ${skillLink}\nControl panel: http://127.0.0.1:1339`);
}
