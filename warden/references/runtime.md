# Warden runtime

The local controller owns the clock and saved plan. T3 owns the conversation
and provider process. A tick uses T3's authenticated message API; opening a
second Codex process on the same provider thread bypasses that ownership.

## First use

Run commands from this skill's real directory. `scripts/install-local.mjs`
installs its Codex symlink and a passive Linux user service. The panel is at
<http://127.0.0.1:1339>; it also works in T3's browser preview. The sidebar's
clock widget shows the current block and next check without opening the panel.

```bash
node scripts/warden.mjs doctor
node scripts/warden.mjs status
```

If the installed service is stopped, `systemctl --user start warden.service`
starts it. Use `node scripts/install-local.mjs` for a fresh installation.
No checks run until a day is started. The controller's `--help` is the
authoritative action schema, including optional port and data-directory flags.

The T3 bridge needs a dedicated environment credential in a local file with
mode 0600. This machine's credential is `~/.local/state/warden/t3-token`.
Bind from the Warden conversation, saving only identifiers and the credential
path (the token itself is never printed):

```bash
node scripts/t3-bridge.mjs bind --token-file ~/.local/state/warden/t3-token > /tmp/warden-binding.json
node scripts/t3-bridge.mjs doctor --binding /tmp/warden-binding.json
```

 A binding names
the exact T3 thread and its provider thread; infer it only from the current
`CODEX_THREAD_ID`, never from a recent-thread list or a matching title. A
missing or ambiguous mapping requires a confirmed thread, not a guess.

## Start a day

Build a start JSON from the verified binding and the agreed blocks, then feed
it on stdin to `node scripts/warden.mjs start`. Use an ISO finish time with the
local UTC offset (or converted to UTC). A block is `{id,title,minutes}`;
each id is unique. Reminders are optional `{id,title,at}` objects with fixed
future ISO times. The start payload is:

```json
{
  "binding": {"baseUrl":"http://127.0.0.1:3773","threadId":"verified-t3-id","bearerTokenFile":"/local/private/credential"},
  "endAt":"2026-09-16T17:00:00+02:00",
  "blocks":[{"id":"first","title":"The agreed first action","minutes":45}],
  "reminders":[]
}
```

Those are illustrative values: use the bridge's binding unchanged and derive
the date, finish, and blocks from the actual session. A running day already
bound to another thread should be resumed there or explicitly handed over.

## Changes and ticks

Send one JSON object on stdin to `node scripts/warden.mjs action`:

| Intent | JSON |
| --- | --- |
| Finish current block | `{"action":"done"}` |
| Skip it | `{"action":"skip"}` |
| Add time | `{"action":"extend","minutes":15}` |
| Pause / resume | `{"action":"pause"}` / `{"action":"resume"}` |
| Timed break, with early resume available | `{"action":"break","minutes":10}` |
| Stop all checks and reminders | `{"action":"stop"}` |
| Replace/reorder future blocks | `{"action":"replan","blocks":[...]}` |
| Move the finish | `{"action":"replan","endAt":"...","blocks":[...]}` |
| Confirm / postpone a reminder | `{"action":"ack-reminder","id":"..."}` / `{"action":"snooze-reminder","id":"...","minutes":15}` |
| Finish a current tick | `{"action":"check-in","id":"pending-tick-id","verdict":"on-plan","note":"...","nextMinutes":25}` |

`replan` replaces **all pending blocks**; preserve every future block that
should remain. It does not change the current or completed ones. A tick may
arrive after a pause or plan change. Match its id against `pendingTick` before
doing anything; stale ticks are harmless and need no acknowledgment.

Read evidence with `node scripts/signals.mjs`. Its lookback is 15 minutes;
freshness is separate. On-plan and declared breaks need no desktop alert.
For an intervention, `node scripts/notify.mjs "one next action"` sends one
notification and the configured sound; `--silent` suppresses sound.

## Recovery and completion

State lives at `~/.local/state/warden/state.json`. Only the controller writes
it; use actions instead of editing JSON behind a running process. Its lock
prevents two service instances from owning the same state. A restart keeps
the pending tick and coalesces missed checks, rather than sending a backlog.
When the result of a send is uncertain, the panel says so and holds further
checks; inspect the T3 conversation before acknowledging that tick.

The service can outlive T3. If T3 is unavailable, the panel shows the delivery
error and bounded retries use the same message id. Reopening T3 preserves the
thread; use the bridge's connection check if delivery remains unavailable.
An expired day stops automatically. Start tomorrow as a new day, with a fresh
binding; do not silently restart yesterday's obligations.

Completed blocks preserve `estimateMinutes` and `activeSeconds`. Use them for
the short end-of-day comparison. Pause and break time are excluded.

## Independently openable work

Use the sibling `peek/scripts/peek.mjs live` roster, then read the relevant
session's last turns. Codex can coordinate existing Claude jobs through shell
commands without Claude's agent-message tools. When the user asks for a new
background job, verify the installed `claude --help` flags, launch with
`claude --bg --name <name> --model <chosen-model> "<task>"`, and return its
`claude attach <job-id>` target. Keep the user's choice of model and workspace.
Check the resulting worktree and diff before describing a job as finished.
