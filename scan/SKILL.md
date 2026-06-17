---
name: scan
description: Scan Claude Code conversations for a date range / project and answer a specific question about them. Searches full message bodies (keyword/regex), lists sessions as a lightweight index, or dumps per-session digests, then reasons over the result. Use when user says scan my chats, scan conversations, find a message where I said X, what did I do in <project> today, search my Claude history, recap a specific project, or asks a question about past Claude Code sessions.
---

# /scan

Answer a question about past Claude Code conversations by scanning them and reasoning over the result. Unlike `/morning` (which builds a fixed daily plan), this is **question-driven** — the user asks something specific, and the job is to answer *that*.

## Step 1: Identify the question, scope, and mode

From the request, pull out:
- **The question** — what do they actually want to know?
- **When** — `today` (default), `yesterday`, `3days`, `week`, `Ndays`, or `YYYY-MM-DD`.
- **Scope** — current project (default) or all projects (`--global`).
- **Mode** — pick based on the question:
  - **Search** — finding a *specific message or moment* ("the message where I sent the requirements", "when did I decide X", "where did we run the migration"). Use `--search`.
  - **Digest / recap** — open-ended "what did I do" over a range. Use the default mode.

## Step 2: Run the right mode

```bash
node <skill-dir>/scripts/scan.mjs [when] [--project <cwd>] [--global] [--full]
```

### Search (targeted lookup — prefer this for "find the message…")
```bash
node <skill-dir>/scripts/scan.mjs --search "<query>" [--scope messages|actions|all] [--regex] [--context N] [--limit N] [--global] [--from --to]
```
- Searches **full, untruncated** message bodies and returns each hit with surrounding context and a session/file pointer — so long or buried messages are found in full.
- `--scope messages` (default) searches your + Claude's prose only (lean, fast). `--scope actions` also searches tool calls / commands run; `--scope all` also searches Claude's reasoning. Reach for the wider scopes only when a plain search misses.
- `--regex` switches the query to a regular expression.

### Digest (open recap)
- Default mode dumps a per-session markdown digest (title, date, branch, model, your messages, what Claude did + tool counts).
- **Auto-routing:** if the range has more than ~12 sessions, scan returns a lightweight **index** instead of a giant digest (to protect context). Read the index, then load only the relevant sessions:
  ```bash
  node <skill-dir>/scripts/scan.mjs --sessions <id,id,...> [--full]
  ```
- Force the index yourself anytime with `--index` (add `--deep` for message/tool counts per session).
- `--full` stops truncating message bodies — use only when the question needs verbatim detail and the session count is small.

## Step 3: Answer the question

- Lead with the answer. Cite which session/project/date it came from (the search/index output includes session IDs and file paths).
- For search hits, quote the relevant message; widen (`week`, `--global`, broader `--scope`) if nothing matched.
- Pull only the relevant threads — don't replay everything.

## Scale guard

If a digest is still huge after auto-routing, spawn **sonnet subagents — one per session or project cluster** — each given the question and told to return only matching findings, then synthesize (mirrors the `ai-cv-scanner` fan-out).

## Rules

- Question first, summary second. A generic recap is the fallback, not the default.
- Prefer `--search` over reading a whole digest when the user wants one specific thing.
- No hallucinated activity — if sessions are thin, say so.
- Match the user's language (Czech in → Czech out).
