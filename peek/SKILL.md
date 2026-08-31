---
name: peek
description: Read another Claude Code session's transcript straight from its JSONL on disk, with zero footprint on the observed session, and list which sessions are running right now. Use before sending a message to another session, when observing or coaching a session that must stay untouched, or when asked to peek at, read, or follow what another session is doing.
---

# peek

Every Claude Code session writes its transcript to `~/.claude/projects/` as it
goes. Reading that file is invisible to the session that owns it: no turn spent,
no context consumed, nothing in its history. That makes peeking the cheap way to
know what another session is doing before you touch it.

## Commands

```bash
node <skill-dir>/scripts/peek.mjs live                        # sessions running right now
node <skill-dir>/scripts/peek.mjs <session-id> --last 6       # the last six messages
node <skill-dir>/scripts/peek.mjs <session-id> --since N      # only what happened since cursor N
node <skill-dir>/scripts/peek.mjs list [projectFilter] [-n 15] # recent sessions on disk, live or dead
```

`live` prints every running `claude` process oldest first: project, start time,
how long it has been quiet, pid, session id, title, and the last thing each side
said. It is Linux-only (it joins `/proc` to `~/.claude/session-env/` by start
time). `list` is the wrong tool for "what is open" because it returns this
morning's dead sessions too; use it to find a session that has already ended.

Every render ends with `# next: --since N`. Pass that back on the next call and
you get only the new messages, which is how you follow a session over time
without re-reading it. `--thinking` adds the assistant's thinking blocks;
`--max 0` lifts the per-message truncation.

## Peek before you message

`SendMessage` to another session costs that session a turn, and an uninformed
message costs two: it asks, waits for the reply, then instructs. Peek first and
send one message that already knows where the session is. The `live` output
carries the session id; `ListAgents` carries the `SendMessage` name and reports
start age rather than id, so pair the two lists per project in start order.

## Coach and driver

When one session must stay clean (a recorded demo, a submission transcript, a
benchmark run), do the thinking in a second session that peeks the first. The
driver's transcript then holds only its own work; the coach's guidance never
appears in it.

## What the transcript does not show

The JSONL trails the live turn: you see the last written entries, not the
response being generated. Good enough for steering, too slow for real-time
interruption. Tool results are not rendered, only tool calls with their inputs;
read the raw JSONL when a result matters.
