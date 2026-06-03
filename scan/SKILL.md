---
name: scan
description: Scan Claude Code conversations for a date range / project and answer a specific question about them. Dumps clean session digests (titles, user messages, assistant actions) then reasons over them. Use when user says scan my chats, scan conversations, what did I do in <project> today, search my Claude history, recap a specific project, or asks a question about past Claude Code sessions.
---

# /scan

Answer a question about past Claude Code conversations by scanning them and reasoning over the digest. Unlike `/morning` (which builds a fixed daily plan), this is **question-driven** — the user asks something specific, and the job is to answer *that*, not to summarize everything.

## Workflow

### Step 1: Identify the question and scope

From the user's request, pull out:
- **The question** — what do they actually want to know? (e.g. "what did I decide about auth", "what's left unfinished", "did I touch the parser today"). If they just say "scan today", the question is an open recap.
- **When** — `today` (default), `yesterday`, `3days`, `week`, `Ndays`, or a `YYYY-MM-DD`.
- **Scope** — current project (default) or all projects (`--global`).

### Step 2: Run the scan

```bash
node <skill-dir>/scripts/scan.mjs [when] [--project <cwd>] [--global] [--full]
```

- Default `when` is `today`; default scope is the current working directory (pass it as `--project`).
- Use `--global` when the user asks across all projects.
- Use `--full` only when the question needs verbatim detail and the session count is small — it stops truncating messages.
- Output is structured markdown: one block per session with title, date, branch, user messages, assistant actions.

### Step 3: Answer the question

Read the digest and answer **the user's question directly**:
- Lead with the answer. Cite which session/project/date it came from.
- Pull only the relevant threads — don't replay every message.
- If the answer isn't in the scanned range, say so and suggest widening (`week`, `--global`).

## Scale guard

If the scan returns many long sessions (digest is huge / would bloat context), don't read it all inline. Spawn **sonnet subagents — one per session or per project cluster** — each given the question and told to return only matching findings, then synthesize. This mirrors the `ai-cv-scanner` fan-out pattern.

## Rules

- Question first, summary second. A generic recap is the fallback, not the default.
- No hallucinated activity — if sessions are thin, say so.
- Match the user's language (Czech in → Czech out).
- One line per session max when listing; expand only the threads relevant to the question.
