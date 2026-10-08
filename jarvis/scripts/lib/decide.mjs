/**
 * decide — when the service wakes Jarvis, as pure functions over a snapshot so
 * the rules can be tested without T3 or a clock.
 *
 * The rules, in Mike's terms: never one ping per job. Wake at once for his own
 * note, for anything stuck or failed, and for work marked urgent; otherwise wait
 * until everything sent out is back, or until the oldest unread result has sat
 * for a while, so the last job never strands the rest. Check in on a quiet day
 * at most twice, and never twice in a row with nothing moving in between.
 */

export const DEFAULTS = {
  deadlineMinutes: 20,
  silentMinutes: 10,
  homeQuietSeconds: 60,
  checkins: { from: 10, to: 18, max: 2, quietHours: 3 },
};

const MINUTE = 60_000;

/** an entry that should wake Jarvis without waiting for the batch. */
export function isUrgent(entry) {
  return entry.from === 'mike'
    || entry.priority === 'now'
    || ['failed', 'blocked', 'needs-you'].includes(entry.status);
}

/**
 * agent-launched threads that went quiet without posting, which get a stub
 * entry so they surface; and the ones still out.
 *
 * Idle is a reason to look, never proof of done: the stub says "finished
 * without a report" and Jarvis reads the transcript to write the real entry.
 * A thread waiting on an approval or an answer is stuck on Mike, so it gets a
 * needs-you stub at once.
 *
 * @param {{ now: number, launched: object[], entries: object[], stubbed: Record<string,string>,
 *   silentMinutes?: number }} snap
 * @returns {{ stubs: {thread: object, status: string}[], outstanding: object[] }}
 */
export function sortLaunched({ now, launched, entries, stubbed, silentMinutes = DEFAULTS.silentMinutes }) {
  const stubs = [];
  const outstanding = [];
  for (const thread of launched) {
    if (thread.settled) continue;
    const reported = entries.some(e => e.thread === thread.threadId && e.created >= thread.launchedAt);
    if (reported || stubbed[thread.threadId]) continue;
    const quietFor = now - Date.parse(thread.updatedAt || thread.launchedAt);
    if (thread.status === 'waiting') stubs.push({ thread, status: 'needs-you' });
    else if (thread.status === 'idle' && quietFor >= silentMinutes * MINUTE) stubs.push({ thread, status: 'silent' });
    else outstanding.push(thread);
  }
  return { stubs, outstanding };
}

/** a count line like "3 new: 1 needs you, 2 done". */
export function summarize(entries) {
  const counts = {};
  for (const e of entries) {
    const key = e.from === 'mike' ? 'from Mike' : e.status === 'needs-you' ? 'needs you' : e.status;
    counts[key] = (counts[key] || 0) + 1;
  }
  const order = ['from Mike', 'needs you', 'failed', 'blocked', 'silent', 'done', 'note'];
  const parts = order.filter(k => counts[k]).map(k => `${counts[k]} ${k}`);
  return `${entries.length} new: ${parts.join(', ')}`;
}

/**
 * whether to wake Jarvis now, and with what message.
 *
 * Only entries Jarvis has not been woken for count as fresh, so an entry it
 * read but did not ack never causes a wake loop.
 *
 * @param {{ now: number, unhandled: object[], outstanding: object[], home: {status: string, updatedAt: string} | null,
 *   lastWakeIds: string[], deadlineMinutes?: number, homeQuietSeconds?: number, cli?: string }} snap
 * @returns {{ reason: string, ids: string[], text: string } | null}
 */
export function decideWake({ now, unhandled, outstanding, home, lastWakeIds,
  deadlineMinutes = DEFAULTS.deadlineMinutes, homeQuietSeconds = DEFAULTS.homeQuietSeconds, cli = 'jarvis' }) {
  if (!home || home.status !== 'idle') return null;
  // Mike may be mid-conversation with Jarvis; let a just-finished turn breathe
  if (now - Date.parse(home.updatedAt || 0) < homeQuietSeconds * 1000) return null;
  const seen = new Set(lastWakeIds);
  const fresh = unhandled.filter(e => !seen.has(e.id));
  if (!fresh.length) return null;

  const oldest = Math.min(...fresh.map(e => Date.parse(e.created)));
  let reason = null;
  if (fresh.some(isUrgent)) reason = fresh.some(e => e.from === 'mike') ? 'Mike wrote' : 'needs attention';
  else if (!outstanding.length) reason = 'everything sent out is back';
  else if (now - oldest >= deadlineMinutes * MINUTE) reason = `oldest result waiting ${deadlineMinutes}+ min`;
  if (!reason) return null;

  const running = outstanding.length ? `, ${outstanding.length} still running` : '';
  const ids = unhandled.map(e => e.id);
  return {
    reason,
    ids,
    text: `[jarvis inbox] ${summarize(unhandled)}${running}. Why now: ${reason}.\n`
      + `Read: \`${cli} list --unread\`. Give Mike one digest, then \`${cli} ack ${ids.join(' ')}\`.`,
  };
}

/** "3h 12m" from milliseconds. */
export function duration(ms) {
  const minutes = Math.floor(ms / MINUTE);
  const h = Math.floor(minutes / 60);
  return h ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}

/** the local calendar date of a timestamp, for the per-day check-in count. */
function localDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * whether a quiet-day check-in is due.
 *
 * Quiet means no thread, Jarvis's own included, has moved for `quietHours` and
 * nothing is running. After a check-in, the next one needs something to have
 * moved since (the service works that out, because a check-in's own message
 * lands in Jarvis's thread and must not count), so an unanswered check-in is
 * never repeated.
 *
 * @param {{ now: number, lastActivity: string, movedSinceLast: boolean, anyBusy: boolean,
 *   checkins: string[], quietUntil?: string, unhandledCount: number,
 *   rules?: typeof DEFAULTS.checkins }} snap
 * @returns {{ text: string } | null}
 */
export function decideCheckin({ now, lastActivity, movedSinceLast, anyBusy, checkins, quietUntil,
  unhandledCount, rules = DEFAULTS.checkins, cli = 'jarvis' }) {
  if (quietUntil && now < Date.parse(quietUntil)) return null;
  const hour = new Date(now).getHours();
  if (hour < rules.from || hour >= rules.to) return null;
  if (anyBusy || !lastActivity) return null;
  const today = checkins.filter(at => localDate(Date.parse(at)) === localDate(now));
  if (today.length >= rules.max) return null;
  if (checkins.length && !movedSinceLast) return null;
  const quiet = now - Date.parse(lastActivity);
  if (quiet < rules.quietHours * 60 * MINUTE) return null;
  const unread = unhandledCount ? `${unhandledCount} unread in the inbox` : 'inbox empty';
  return {
    text: `[jarvis check-in] Quiet for ${duration(quiet)}, nothing running, ${unread}.\n`
      + `Check in with Mike the way the skill says (\`${cli} sweep\` for what is open).`,
  };
}
