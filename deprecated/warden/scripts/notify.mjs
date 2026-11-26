import { realpathSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const defaultConfig = fileURLToPath(new URL('../config.json', import.meta.url));

/** send a local nudge using the configured audio route; report each channel separately. */
export async function notifyUser(message, { title = 'warden', sound = true, configPath = defaultConfig, runner = execute } = {}) {
  if (typeof message !== 'string' || !message.trim() || message.length > 1000) throw new Error('Provide a message between 1 and 1000 characters.');
  if (typeof title !== 'string' || !title.trim() || title.length > 100) throw new Error('Provide a short notification title.');
  let config = {};
  try { config = JSON.parse(await readFile(configPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const result = { delivered: false, soundPlayed: false, errors: [] };
  try {
    await runner('notify-send', ['--app-name=warden', '--urgency=normal', '--', title, message], { timeout: 5000, maxBuffer: 8192 });
    result.delivered = true;
  } catch { result.errors.push('Desktop notification failed. Check the desktop notification service.'); }
  if (sound && config.soundFile) {
    const volume = config.soundVolume ?? 1;
    if (!Number.isFinite(volume) || volume < 0 || volume > 3) throw new Error('soundVolume must be between 0 and 3.');
    const args = [];
    if (config.soundTarget) args.push('--target', String(config.soundTarget));
    args.push('--volume', String(volume), '--', String(config.soundFile).replace(/^~(?=\/|$)/, homedir()));
    try {
      await runner('pw-play', args, { timeout: 10000, maxBuffer: 8192 });
      result.soundPlayed = true;
    } catch { result.errors.push('Notification sound failed. Check the configured sound file and audio target.'); }
  }
  return result;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) {
    console.log('Usage: node notify.mjs [--silent] "one concrete next action"');
  } else {
    const silent = args[0] === '--silent';
    const words = silent ? args.slice(1) : args;
    if (words.length !== 1) throw new Error('Pass the notification message as one quoted argument.');
    const result = await notifyUser(words[0], { sound: !silent });
    console.log(JSON.stringify(result));
    if (!result.delivered) process.exitCode = 1;
  }
}
