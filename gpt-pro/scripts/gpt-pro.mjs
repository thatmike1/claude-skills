#!/usr/bin/env node

/**
 * gpt-pro — the file and clipboard half of a hand-carried ChatGPT run.
 *
 * the agent writes a prompt and gathers context; the human pastes the prompt into
 * their own ChatGPT window and copies the answer back. this script only moves
 * bytes between the run folder and the clipboard. it never touches a browser.
 *
 * a run folder holds:
 *   prompt.md, answer.md        round 1
 *   prompt-2.md, answer-2.md    round 2, same chat, and so on
 *   context/                    files to attach, packed into context.zip by `send`
 *   returned/                   files the chat handed back, moved in by `collect`
 *   run.json                    when each round was sent
 *
 * usage:
 *   node gpt-pro.mjs new <slug> [--root <dir>]   create <root>/gpt-pro/<date>-<slug>/
 *   node gpt-pro.mjs send <run-dir> [--no-reveal]
 *   node gpt-pro.mjs receive <run-dir>
 *   node gpt-pro.mjs collect <run-dir> [file...] [--from <dir>]
 *
 * exit codes: 0 done, 1 usage or missing input, 2 needs a choice from the caller.
 */

import { spawnSync } from 'child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { homedir, platform } from 'os';
import { basename, join, resolve } from 'path';

/** print a message to stderr and exit */
function fail(message, code = 1) {
  console.error(`gpt-pro: ${message}`);
  process.exit(code);
}

/** true when a binary resolves on PATH */
function has(binary) {
  return spawnSync('sh', ['-c', `command -v ${binary}`], { stdio: 'ignore' }).status === 0;
}

/**
 * pick the clipboard commands for this machine.
 * @returns {{ copy: string[], paste: string[] }}
 */
function clipboardCommands() {
  if (platform() === 'darwin') return { copy: ['pbcopy'], paste: ['pbpaste'] };
  if (process.env.WAYLAND_DISPLAY && has('wl-copy')) {
    return { copy: ['wl-copy'], paste: ['wl-paste', '--no-newline'] };
  }
  if (has('xclip')) {
    return {
      copy: ['xclip', '-selection', 'clipboard'],
      paste: ['xclip', '-selection', 'clipboard', '-o'],
    };
  }
  return fail('no clipboard tool found (wl-copy, xclip or pbcopy)');
}

/** put text on the clipboard */
function copyToClipboard(text) {
  const [command, ...args] = clipboardCommands().copy;
  // wl-copy forks a server that keeps inherited pipes open, so output must be ignored or the call never returns
  const result = spawnSync(command, args, { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
  if (result.status !== 0) fail(`${command} failed`);
}

/** read text from the clipboard */
function readClipboard() {
  const [command, ...args] = clipboardCommands().paste;
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return result.status === 0 ? result.stdout : '';
}

/** file name of a round's prompt or answer */
function roundFile(kind, round) {
  return round === 1 ? `${kind}.md` : `${kind}-${round}.md`;
}

/**
 * rounds present in a run folder, by prompt file.
 * @returns {number[]} ascending round numbers
 */
function promptRounds(runDir) {
  const rounds = [];
  for (const name of readdirSync(runDir)) {
    const match = name.match(/^prompt(?:-(\d+))?\.md$/);
    if (match) rounds.push(match[1] ? Number(match[1]) : 1);
  }
  return rounds.sort((a, b) => a - b);
}

/** the latest round whose prompt has no answer yet, or null */
function openRound(runDir) {
  const open = promptRounds(runDir).filter((round) => !existsSync(join(runDir, roundFile('answer', round))));
  return open.length ? open[open.length - 1] : null;
}

/** read run.json, empty when absent */
function readRunState(runDir) {
  const path = join(runDir, 'run.json');
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { sent: {} };
}

/** resolve and check a run folder argument */
function requireRunDir(arg) {
  if (!arg) fail('missing <run-dir>');
  const runDir = resolve(arg);
  if (!existsSync(runDir) || !statSync(runDir).isDirectory()) fail(`not a folder: ${runDir}`);
  return runDir;
}

/** value following a flag, or undefined */
function flagValue(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

/** create a dated run folder under <root>/gpt-pro/ */
function commandNew(args) {
  const slug = args.find((arg) => !arg.startsWith('--') && arg !== flagValue(args, '--root'));
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) fail('new needs a kebab-case <slug>');
  const laneDir = join(resolve(flagValue(args, '--root') ?? '.'), 'gpt-pro');
  const runDir = join(laneDir, `${new Date().toLocaleDateString('sv-SE')}-${slug}`);
  if (existsSync(runDir)) fail(`already exists: ${runDir}`);
  mkdirSync(join(runDir, 'context'), { recursive: true });
  const ignorePath = join(laneDir, '.gitignore');
  // the packed context is a copy of files that already live somewhere, so it stays out of git
  if (!existsSync(ignorePath)) writeFileSync(ignorePath, '*/context/\n*/context.zip\n*/context.tar.gz\n');
  console.log(runDir);
}

/** pack context/ into one archive, returning its path or null when there is nothing to attach */
function packContext(runDir) {
  const contextDir = join(runDir, 'context');
  if (!existsSync(contextDir) || readdirSync(contextDir).length === 0) return null;
  const useZip = has('zip');
  const archive = join(runDir, useZip ? 'context.zip' : 'context.tar.gz');
  rmSync(archive, { force: true });
  const result = useZip
    ? spawnSync('zip', ['-r', '-q', archive, '.'], { cwd: contextDir, stdio: 'inherit' })
    : spawnSync('tar', ['-czf', archive, '-C', contextDir, '.'], { stdio: 'inherit' });
  if (result.status !== 0) fail('packing context/ failed');
  return archive;
}

/** copy the open round's prompt to the clipboard and pack the attachment */
function commandSend(args) {
  const runDir = requireRunDir(args.find((arg) => !arg.startsWith('--')));
  const round = openRound(runDir);
  if (round === null) fail('no prompt is waiting for an answer; write prompt.md or the next prompt-N.md first');
  const prompt = readFileSync(join(runDir, roundFile('prompt', round)), 'utf8');
  if (!prompt.trim()) fail(`${roundFile('prompt', round)} is empty`);

  // a follow-up round lands in the same chat, which already holds the attachment
  const archive = round === 1 ? packContext(runDir) : null;
  copyToClipboard(prompt);

  const state = readRunState(runDir);
  state.sent[round] = new Date().toISOString();
  writeFileSync(join(runDir, 'run.json'), `${JSON.stringify(state, null, 2)}\n`);

  console.log(`round ${round}: prompt is on the clipboard (${prompt.length} chars)`);
  if (archive) {
    console.log(`attach: ${archive} (${Math.ceil(statSync(archive).size / 1024)} KB)`);
    if (!args.includes('--no-reveal') && has('xdg-open')) {
      spawnSync('xdg-open', [runDir], { stdio: 'ignore', detached: true });
    }
  }
}

/** save the clipboard as the open round's answer */
function commandReceive(args) {
  const runDir = requireRunDir(args.find((arg) => !arg.startsWith('--')));
  const round = openRound(runDir);
  if (round === null) fail('every prompt already has an answer');
  const prompt = readFileSync(join(runDir, roundFile('prompt', round)), 'utf8');
  const answer = readClipboard();
  if (!answer.trim()) fail('the clipboard is empty or holds no text', 2);
  if (answer.trim() === prompt.trim()) fail('the clipboard still holds the prompt; the answer was not copied yet', 2);
  const answerPath = join(runDir, roundFile('answer', round));
  writeFileSync(answerPath, answer.endsWith('\n') ? answer : `${answer}\n`);
  console.log(`${answerPath} (${answer.length} chars)`);
}

/** move a file, copying when the target sits on another filesystem */
function moveFile(from, to) {
  try {
    renameSync(from, to);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    copyFileSync(from, to);
    rmSync(from);
  }
}

/** move files the chat handed back into returned/, unpacking archives */
function commandCollect(args) {
  const fromDir = resolve(flagValue(args, '--from') ?? join(homedir(), 'Downloads'));
  const positional = args.filter((arg) => !arg.startsWith('--') && arg !== flagValue(args, '--from'));
  const runDir = requireRunDir(positional[0]);
  let files = positional.slice(1).map((file) => resolve(file));

  if (files.length === 0) {
    const sentTimes = Object.values(readRunState(runDir).sent).map((iso) => Date.parse(iso));
    if (sentTimes.length === 0) fail('nothing was sent from this run yet, so name the files to collect');
    const since = Math.min(...sentTimes);
    files = readdirSync(fromDir)
      .map((name) => join(fromDir, name))
      .filter((path) => statSync(path).isFile() && statSync(path).mtimeMs >= since);
    if (files.length === 0) fail(`no file in ${fromDir} is newer than the send`, 2);
    if (files.length > 1) {
      console.error(`gpt-pro: ${files.length} files are newer than the send; name the ones that belong to this run:`);
      for (const file of files) console.error(`  ${file}`);
      process.exit(2);
    }
  }

  const returnedDir = join(runDir, 'returned');
  mkdirSync(returnedDir, { recursive: true });
  for (const file of files) {
    if (!existsSync(file)) fail(`no such file: ${file}`);
    const target = join(returnedDir, basename(file));
    moveFile(file, target);
    console.log(target);
    if (target.endsWith('.zip') && has('unzip')) {
      const unpackDir = target.slice(0, -'.zip'.length);
      const result = spawnSync('unzip', ['-q', '-o', target, '-d', unpackDir], { stdio: 'inherit' });
      if (result.status === 0) console.log(`${unpackDir}/`);
    }
  }
}

const [command, ...rest] = process.argv.slice(2);
const commands = { new: commandNew, send: commandSend, receive: commandReceive, collect: commandCollect };
if (!commands[command]) fail('usage: gpt-pro.mjs new|send|receive|collect (see the header of this file)');
commands[command](rest);
