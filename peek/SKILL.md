---
name: peek
description: Read another agent session's transcript straight from its log on disk, with zero footprint on the observed session, and list which sessions are running right now. Covers both Claude Code and the Antigravity CLI (agy/Gemini). Use before sending a message to another session, when observing or coaching a session that must stay untouched, or when asked to peek at, read, or follow what another session is doing.
---

# peek

Every Claude Code session writes its transcript to `~/.claude/projects/` as it
goes, and every Antigravity CLI conversation writes one to
`~/.gemini/antigravity-cli/brain/<id>/`. Reading either is invisible to the
session that owns it: no turn spent, no context consumed, nothing in its
history. That makes peeking the cheap way to know what another session is doing
before you touch it.

## Commands

```bash
node <skill-dir>/scripts/peek.mjs live                        # sessions running right now
node <skill-dir>/scripts/peek.mjs <session-id> --last 6       # the last six messages
node <skill-dir>/scripts/peek.mjs <session-id> --since N      # only what happened since cursor N
node <skill-dir>/scripts/peek.mjs list [projectFilter] [-n 15] # recent sessions on disk, live or dead
```

`live` prints every running session oldest first: project, harness, start time,
how long it has been quiet, pid, session id, title, and the last thing each side
said. It is Linux-only. `list` is the wrong tool for "what is open" because it
returns this morning's dead sessions too; use it to find a session that has
already ended.

Both commands cover both harnesses and tag each row `cc` or `agy`. `--cc` and
`--agy` narrow them to one. A session id is enough on its own — `peek.mjs <id>`
works out which harness it belongs to.

Every render ends with `# next: --since N`. Pass that back on the next call and
you get only the new messages, which is how you follow a session over time
without re-reading it. `--thinking` adds the model's thinking blocks;
`--max 0` lifts the per-message truncation.

## Peek before you message

`SendMessage` to another session costs that session a turn, and an uninformed
message costs two: it asks, waits for the reply, then instructs. Peek first and
send one message that already knows where the session is. The `live` output
carries the session id; `ListAgents` carries the `SendMessage` name and reports
start age rather than id, so pair the two lists per project in start order.
`ListAgents` covers Claude Code only — an agy conversation is peeked, not
messaged.

## Coach and driver

When one session must stay clean (a recorded demo, a submission transcript, a
benchmark run), do the thinking in a second session that peeks the first. The
driver's transcript then holds only its own work; the coach's guidance never
appears in it.

## What the transcript does not show

The log trails the live turn: you see the last written entries, not the
response being generated. Good enough for steering, too slow for real-time
interruption.

For Claude Code, tool results are not rendered, only tool calls with their
inputs; read the raw JSONL when a result matters. Antigravity logs each result
as its own step, so peek shows them, prefixed `←`, and `--no-results` drops
them.

## How each harness is found

Claude Code: `/proc` for `claude` processes, joined to `~/.claude/session-env/`
by start time within 15s; that dir's SessionStart hook file holds the real
transcript path, which matters because a `--resume` session's dir name points at
a jsonl that does not exist.

Antigravity: `/proc` for `agy` processes, each of which holds an open file
descriptor on `~/.gemini/antigravity-cli/presence/<conversation-id>.lock` for
its whole life. That is an exact process-to-conversation join, not a
heuristic. The transcript is
`brain/<id>/.system_generated/logs/transcript_full.jsonl`, the title is
`annotations/<id>.pbtxt`, and the workspace comes out of the metadata blob in
`conversations/<id>.db`. `conversation_summaries.db` looks like the obvious
index and is not — on this machine it stopped being written on 31 August 2026.
