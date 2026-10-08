# Launching outside T3

Inside T3 Code a job is a thread (`create_threads`), covered in SKILL.md. This is the route when T3 cannot run the job or Mike said he does not need to see it. The shared rules point here for the flag details, messaging a running job, the Codex recipe and the worktree check.

## Claude Code background job

```bash
cd <repo> && claude --bg --name <short-name> --model opus --effort high "<task>"
```

It prints an eight-character job id and returns. Two things the flags do not
confess: without `--model` the job takes the `model` from
`~/.claude/settings.json`, and `--name` is what makes it addressable, so pass
both. The prompt is positional; `--bg` rejects `-p`.

Both routes in stay open. The user takes it with `claude attach <id>` or from the
agent view, where a finished job idles at its prompt instead of exiting, so they
continue the same conversation. You reach it while its process is alive:
`ListAgents` lists it as kind `bg` under the name you gave, `SendMessage`
delivers, and its answer lands in its own transcript rather than returning to
you. Read that with `peek.mjs` and the full `sessionId` from
`~/.claude/jobs/<id>/state.json`. `claude logs <id>` prints raw terminal output,
escape codes and all.

A `--bg` job edits in the checkout it was launched from unless it decides on
its own to call `EnterWorktree`, which some do and most do not; there is no
flag or setting driving it. Do not mention worktrees when launching; the user
knows. When a job reports done, run `git worktree list` in its repo before
reading results, and fast-forward `main` from any `worktree-<name>` branch
it left. The worktree stays locked until `claude stop <id>`.

## Codex job

A Codex job outside T3 is a detached `codex exec`: write the task to a file,
then `nohup codex exec -C <repo> -o <result-file> - < <task-file> > <log-file> 2>&1 &`.
Pass `-m <model>` and `-c model_reasoning_effort=<level>` on every job, picked
from the "Codex models" section of the shared rules; without them it falls back
to `~/.codex/config.toml`'s low-effort default. The workspace-write sandbox
comes from that file too. There is no attach:
report the log and result paths, and the session id printed at the top of the
log, which `codex resume <id>` opens.

## Reading the view

`claude agents` lists background jobs only, never live
interactive sessions, which is why the roster comes from `peek.mjs live`. Its
right-hand column is a duration (`createdAt` → `firstTerminalAt`), not an age, so
a job that idled alive for a month reads `33d`. Rows sort oldest-first by start.
