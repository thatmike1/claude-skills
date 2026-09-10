---
name: peek
description: Read another agent session's transcript straight from its log on disk, with zero footprint on the observed session, and list which sessions are running right now. Covers both Claude Code and the Antigravity CLI (agy/Gemini), and the T3 Code threads wrapped around either. Use before sending a message to another session, when observing or coaching a session that must stay untouched, when asked which T3 threads are still open or unsettled, or when asked to peek at, read, or follow what another session is doing.
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
node <skill-dir>/scripts/peek.mjs t3 [--all]                  # open T3 Code threads
node <skill-dir>/scripts/peek.mjs <session-id> --last 6       # the last six messages
node <skill-dir>/scripts/peek.mjs <session-id> --since N      # only what happened since cursor N
node <skill-dir>/scripts/peek.mjs list [projectFilter] [-n 15] # recent sessions on disk, live or dead
```

`live` prints every running session oldest first: project, harness, start time,
how long it has been quiet, pid, session id, title, and the last thing each side
said. It is Linux-only. `list` is the wrong tool for "what is open" because it
returns this morning's dead sessions too; use it to find a session that has
already ended.

`live` and `list` cover both harnesses and tag each row `cc` or `agy`. `--cc`
and `--agy` narrow them to one. A session id is enough on its own —
`peek.mjs <id>` works out which harness it belongs to.

Every render ends with `# next: --since N`. Pass that back on the next call and
you get only the new messages, which is how you follow a session over time
without re-reading it. `--thinking` adds the model's thinking blocks;
`--max 0` lifts the per-message truncation.

## T3 Code threads

T3 Code is a front end, not a third harness: every thread it opens runs an
ordinary Claude Code or Antigravity session underneath, which is why its rows
reach `live` looking like any other session. A `live` row that belongs to one is
tagged `cc t3` or `agy t3` and carries a `t3:` line with the thread's own title,
whether it is `busy`, `waiting` on the user or `idle`, whether it is settled,
and the `t3 <thread-id>` command that reopens it.

`peek.mjs t3` is the separate roster, because a thread outlives its process:
`live` answers what is running, `t3` answers what is still open. Settled threads
are hidden and that is the point of the command — settled is the one state on
that board the user produced deliberately, it only ever accumulates, and what
is left is the set of loops still on them. Snoozed and archived threads are
parked by the same act and go with it; `--all` brings all three back.

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

Claude Code: `/proc` for `claude` processes. A process started with `--resume`
names its session in its own argv and is read straight off it; anything else is
joined to `~/.claude/session-env/` by start time within 15s. The argv path is
what makes T3 rows resolvable at all, because T3 restarts the underlying process
every turn and resumes it, leaving the session-env dir stamped whenever the
thread first opened. That dir's SessionStart hook file holds the real transcript
path, which matters because a `--resume` session's dir name points at a jsonl
that does not exist.

T3 Code: `~/.t3/userdata/state.sqlite`, read-only, joining
`provider_session_runtime` to `projection_threads`. The underlying session id
lives in `resume_cursor_json` under a per-provider key — `resume` for Claude
Code, `sessionId` for Antigravity — and that field is the only join between a
thread and its session. A T3 process is also recognisable before its state row
lands, because T3 gives every session it starts an MCP server named `t3-code`,
which shows in the process's argv.

Antigravity: `/proc` for `agy` processes, each of which holds an open file
descriptor on `~/.gemini/antigravity-cli/presence/<conversation-id>.lock` for
its whole life. That is an exact process-to-conversation join, not a
heuristic. The transcript is
`brain/<id>/.system_generated/logs/transcript_full.jsonl`, the title is
`annotations/<id>.pbtxt`, and the workspace comes out of the metadata blob in
`conversations/<id>.db`. `conversation_summaries.db` looks like the obvious
index and is not — on this machine it stopped being written on 31 August 2026.
