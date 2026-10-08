# The inbox and the service

## Files

Everything lives in `~/.jarvis/` (`JARVIS_HOME` overrides it):

- `inbox/<stamp>-<id>.md` — one entry per file, front matter then body. Written to
  `tmp/` and renamed into place, never rewritten, so concurrent writers are safe
  and Mike can open, read or drop files there with an editor. A file with no
  `from:` is his note.
- `handled/<id>` — an empty marker: Jarvis has dealt with that entry. Reading
  and resolving stay separate acts; the page shows "jarvis has it".
- `config.json` — written only by the CLI (`bind`, `quiet`), read by the service
  every tick: `home` (the bound thread), `since` (launches watched from),
  `tokenFile`, `port`, `deadlineMinutes`, `silentMinutes`, `checkins`
  (`from`, `to`, `max`, `quietHours`), `quietUntil`.
- `service.json` — written only by the service: stubs written, the last wake's
  entry ids, wake and check-in history.

## An entry

```
---
id: 3f9a2c
created: 2026-10-08T16:47:18.637Z
from: job            # job | jarvis | mike | service
status: done         # done | blocked | failed | needs-you | note | silent
priority: normal     # or now
thread: mcp-…        # filled from the poster's own T3 thread when it can tell
title: nexiflow invoice export
---
What changed: two plain sentences.
Does it work: what was run and what passed. "Untested" is a fine answer.
You decide: the one decision, or "nothing".
Where: PR link, path or page.
```

`silent` is the service's stub for a launched thread that went quiet without
posting; `reconstructed: true` marks an entry Jarvis wrote from a transcript.

## The service

`jarvis.service` (user systemd) runs `jarvis.mjs serve`: the page on
127.0.0.1:1355 and a tick every 20 seconds. A tick:

1. Reads the threads Mike's T3 fork recorded as agent-launched
   (`agent_thread_parents`) since `since`. One waiting on an approval or answer
   gets a `needs-you` stub at once; one idle for `silentMinutes` (10) with no
   entry since its launch gets a `silent` stub.
2. Wakes Jarvis by starting a turn in its home thread through T3's own API
   (`orchestration.dispatchCommand`, `thread.turn.start`, the route Warden's
   bridge uses, with the token at `tokenFile`). Only when the home thread is idle
   and has been for a minute, and only for entries it has not woken Jarvis for:
   at once for Mike's notes, `failed`, `blocked`, `needs-you` and `priority:
   now`; otherwise when nothing launched is still out, or the oldest unread entry
   is `deadlineMinutes` (20) old.
3. Otherwise considers a check-in: no thread moved for `quietHours` (3) between
   `from` and `to` (10 to 18), nothing running, at most `max` (2) a day, none
   until something moved since the last, none while `quietUntil` is ahead.

The rules are pure functions in `scripts/lib/decide.mjs`, tested in
`scripts/test/`. `node jarvis.mjs tick` runs one tick by hand.

## The page

GET `/` is the page, `/board` its 15-second refresh, `/api/entries` the JSON.
POST `/api/note` takes `{"text": …}` and needs the header `x-jarvis: 1`: the
custom header forces a CORS preflight the server never answers, so no website
Mike visits can write into the inbox and steer Jarvis.

## Under T3 Orchestrator V2

V2 (notes in ccChat-general `projects/jarvis/v2-orchestration.md`) drops the
fork's `agent_thread_parents`, and `delegate_task` wakes the parent on each
child's completion by itself. Then: launch with `delegate_task`, drop the stub
watcher and the wake dispatch for delegated work, keep the inbox as what Mike
reads and writes, and keep the check-ins (or move them to `schedule_task`).
