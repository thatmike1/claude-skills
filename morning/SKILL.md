---
name: morning
description: Daily briefing skill that aggregates yesterday's work context from Claude Code conversations, Codex sessions, git history, and memory files into an actionable morning plan with checkboxes, time estimates, and sequencing. Use when user says morning, catch up, recap, start of day, what was I doing, yesterday's context, or wants to review previous day's work before starting.
---

# /morning

Produce an actionable morning briefing by gathering and synthesizing context from the previous workday.

## Mode Detection

| Signal | Mode | Range |
|--------|------|-------|
| `/morning` (in a project dir) | **repo** | yesterday (Friday if Monday) |
| `/morning global` | **global** | yesterday (Friday if Monday) |
| `/morning 3days` | repo | last 3 days |
| `/morning week` | repo | last 7 days |
| `/morning global week` | global + extended | last 7 days |

Combine freely: `/morning global 3days` works.

## Workflow

### Step 1: Gather context

Run the gather script from this skill's `scripts/` directory:

```bash
node <skill-dir>/scripts/gather-context.mjs --mode <repo|global> [--range 1day|3days|week] [--project <cwd>]
```

- **repo mode**: pass `--project` with the current working directory
- **global mode**: omit `--project`
- Script outputs structured markdown with sections for CC sessions, Codex sessions, git activity, memory, and open issues

### Step 2: Synthesize

Read the gathered context and produce a briefing. See [references/output-format.md](references/output-format.md) for the exact template.

Key synthesis tasks:
- Group sessions into **work streams** by project/topic
- For each stream, identify: what was worked on, decisions made, blockers hit, things left unfinished
- Produce nested checkboxes with time estimates where possible
- Add a "where you left off" one-liner per stream
- Add sequencing recommendation and day-fit assessment
- Flag scope-creep risks with timebox warnings (see goblin patterns)

Mode-specific details: [references/repo-mode.md](references/repo-mode.md) | [references/global-mode.md](references/global-mode.md)

### Step 3: Present and refine

Show the briefing. Ask if the user wants to:
- Add context you missed ("oh yeah, I also need to do X")
- Adjust priorities or skip items
- Get time estimates refined

### Step 4: Optional Capacities push

After the user is happy with the briefing, offer to push it to their Capacities daily note using the `/capacities` skill.

## Rules

- No motivational fluff — straight into the plan
- Every item gets a verb (actionable)
- Bold the actionable part of each checkbox
- Max 15 words per bullet point
- If a session was just yapping/research with no actionable output, summarize in one line, don't list every message
- Work repos (gitlab remote) come first, personal (github) second
- If context is thin (few sessions, minimal git), say so — don't hallucinate tasks
