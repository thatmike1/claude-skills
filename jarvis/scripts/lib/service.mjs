/**
 * service — one tick of the watcher behind Jarvis's inbox.
 *
 * Every tick: find agent-launched threads that went quiet without reporting and
 * give them a stub entry, then decide whether to wake Jarvis (a short message
 * started as a turn in its bound T3 thread) or, on a quiet day, check in. The
 * rules live in decide.mjs; this file only gathers the snapshot and acts on it.
 */

import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadConfig, loadServiceState, saveServiceState } from './config.mjs';
import { decideCheckin, decideWake, sortLaunched } from './decide.mjs';
import { list, post } from './inbox.mjs';
import { activity, anyThreadBusy, lastWords, launchedThreads, startTurn, threadInfo } from './t3.mjs';

// how a woken agent runs this CLI: by absolute path, since nothing puts it on PATH
const CLI = `node ${fileURLToPath(new URL('../jarvis.mjs', import.meta.url)).replace(homedir(), '~')}`;

/** a stable entry id for a thread's stub, so a retried tick never doubles it. */
function stubId(threadId) {
  return `s${createHash('sha1').update(threadId).digest('hex').slice(0, 6)}`;
}

/** the body of a stub entry, written for Mike like any other. */
function stubBody(status, words) {
  const last = words.assistant ? `Its last words: ${words.assistant}` : 'It has not said anything yet.';
  return status === 'needs-you'
    ? `Stopped and waiting on you in the thread: an approval, a question or a plan to accept.\n\n${last}`
    : `Went quiet without posting a report. Jarvis reads the thread and writes what happened.\n\n${last}`;
}

/**
 * gather everything the page and the rules look at, without acting.
 * @param {{ now?: number }} [opts]
 */
export function snapshot({ now = Date.now() } = {}) {
  const config = loadConfig();
  const state = loadServiceState();
  const homeId = config.home?.threadId || '';
  const home = homeId ? threadInfo(homeId) : null;
  const since = config.since || state.startedAt || new Date(now).toISOString();
  const launched = launchedThreads(since).filter(t => t.threadId !== homeId);
  const entries = list();
  const { stubs, outstanding } = sortLaunched({
    now, launched, entries, stubbed: state.stubbed, silentMinutes: config.silentMinutes,
  });
  const unhandled = entries.filter(e => !e.handled && e.from !== 'jarvis');
  return { now, config, state, home, launched, entries, stubs, outstanding, unhandled };
}

/**
 * run one tick: write stubs, then wake or check in if the rules say so.
 * `dispatch` is injectable so tests never touch T3.
 *
 * @param {{ now?: number, dispatch?: typeof startTurn, log?: (line: string) => void }} [opts]
 */
export async function tick({ now = Date.now(), dispatch = startTurn, log = () => {} } = {}) {
  let snap = snapshot({ now });
  const { config, state } = snap;
  state.startedAt ||= new Date(now).toISOString();

  for (const { thread, status } of snap.stubs) {
    const entry = post({
      from: 'service', status, thread: thread.threadId, title: thread.title,
      body: stubBody(status, lastWords(thread.threadId, 300)), id: stubId(thread.threadId),
    });
    state.stubbed[thread.threadId] = entry.id;
    log(`stub ${entry.id} ${status} for "${thread.title}"`);
  }
  if (snap.stubs.length) snap = { ...snapshot({ now }), state };

  const { home, unhandled, outstanding } = snap;
  if (home && config.tokenFile) {
    const wake = decideWake({
      now, unhandled, outstanding, home, lastWakeIds: state.lastWakeIds,
      deadlineMinutes: config.deadlineMinutes, cli: CLI,
    });
    if (wake) {
      try {
        await dispatch({ threadId: home.threadId, text: wake.text, id: `wake-${now}`, tokenFile: config.tokenFile });
        state.lastWakeIds = wake.ids;
        state.wakes.push({ at: new Date(now).toISOString(), reason: wake.reason, ids: wake.ids });
        log(`wake: ${wake.reason} (${wake.ids.length} unread)`);
      } catch (error) {
        log(`wake failed: ${error.message}`);
      }
    } else {
      const act = activity(home.threadId);
      const last = state.checkins.at(-1);
      // the check-in's own message lands in Jarvis's thread a moment after it is
      // sent, so only a user message well after it counts as Mike answering
      const moved = !last
        || act.lastOthers > last
        || (act.homeLastUser && Date.parse(act.homeLastUser) > Date.parse(last) + 120_000);
      const checkin = decideCheckin({
        now, lastActivity: act.lastAll, movedSinceLast: moved, anyBusy: anyThreadBusy(),
        checkins: state.checkins, quietUntil: config.quietUntil, unhandledCount: unhandled.length,
        rules: config.checkins, cli: CLI,
      });
      if (checkin) {
        try {
          await dispatch({ threadId: home.threadId, text: checkin.text, id: `checkin-${now}`, tokenFile: config.tokenFile });
          state.checkins.push(new Date(now).toISOString());
          log('check-in sent');
        } catch (error) {
          log(`check-in failed: ${error.message}`);
        }
      }
    }
  }
  saveServiceState(state);
  return snap;
}
