---
name: settle-sweep
description: Answers "what can I settle", "what's open", "which threads can I close" with one line per open T3 Code thread, settle it, it needs him, or still running, read from T3's own database. Use for any quick pass over his open threads; the full page of every thread is thread-explainer.
---

# settle sweep

Mike leaves threads open after they are done, and the sidebar fills with ones he could close. The sweep tells him which, in a reply he can act on without opening any of them.

## Run

`node ~/.claude/skills/settle-sweep/scripts/sweep.mjs` prints every open thread, newest first: title, status, how long it has been quiet, its link, his last real message and the agent's last words. Settled, snoozed, archived and subagent threads are left out, and so is the thread you run in.

## Judge

One line per thread, led by its link exactly as printed, so the line is clickable:

- `settle: why` — finished, or its next step already lives in a bead or on his hub.
- `needs you: the decision` — the last reply asks him something, or he wrote last and nothing answered.
- `running: what comes back` — a run, delegated agent or job it started is still going.

His latest real message beats the agent's tail when they disagree. Date-bound wording (tonight, tomorrow) is checked against today; a step whose day has passed is stale.

When 400 characters of last words are not enough to judge, read that one thread with `t3_thread_read` (low `limit`, `maxCharsPerItem` around 1500) rather than guessing. The script stays the first pass: one call covers every thread, where T3's tools would need a list plus a read per thread.

## Settling

You cannot settle threads yourself: T3's database has one writer, and Mike clicks. Lead the reply with the count he can settle, then the lines, settles first.

The whole board, sorted into lanes on a page, is the `thread-explainer` skill.
