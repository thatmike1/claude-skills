---
name: morning
description: Daily briefing skill that aggregates yesterday's work context from Claude Code conversations, Codex sessions, git history, and memory files into an actionable morning plan with time estimates and sequencing. Use when user says morning, start of day, or what was I doing yesterday.
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
- Script outputs structured markdown with sections for CC sessions, Codex sessions, git activity (including per-branch **Branch status** in repo mode), memory, and open issues
- Each CC session also reports a **Tools** line (e.g. `Bash×67, Edit×10, Agent×1`) and **Model** — use these to tell real building from research/yapping when grouping work streams

### Step 2: Verify ship state

Classify every branch the briefing will mention, before writing any action. Sources: the script's **Branch status** section, then the platform (GitLab MCP `list_merge_requests` filtered by source branch, or `gh pr list --head`) for anything not clearly unpushed.

- **shipped** — MR/PR merged, or upstream gone. Prose context only; no actions.
- **in review** — MR/PR open. Actions are review-shaped: address comments, watch pipeline, chase reviewer.
- **unshipped** — unpushed commits, or pushed with no MR/PR yet. Push/open-MR actions are legitimate here and only here.

Local git understates shipping: squash merges leave a branch looking unmerged, so "in sync" or "ahead of main" never proves unshipped — only the MR/PR lookup does.

Done when every branch named in the briefing carries a verified ship state and no proposed action contradicts it.

### Step 3: Synthesize

Read the gathered context and produce a briefing. See [references/output-format.md](references/output-format.md) for the exact template.

Key synthesis tasks:
- Group sessions into **work streams** by project/topic
- For each stream, tell what happened as prose: work done, decisions made, blockers hit, ship state
- Checkboxes only for today's actions, with time estimates where possible
- Add sequencing recommendation and day-fit assessment
- Flag scope-creep risks with timebox warnings (see goblin patterns)

**Clean slate:** when every stream is shipped/done and yesterday leaves no real actions, pull next work instead — GitLab issues assigned to the user (`my_issues`, state opened; filter to this project in repo mode) plus `bd ready`. Present as a "Next up" section (see output-format) and let the user pick; don't start anything.

The briefing is complete only when every session in the gathered context appears in a work stream or is dismissed in a one-liner — no session silently dropped.

Mode-specific details: [references/repo-mode.md](references/repo-mode.md) | [references/global-mode.md](references/global-mode.md)

### Step 4: Present and refine

Show the briefing. Ask if the user wants to:
- Add context you missed ("oh yeah, I also need to do X")
- Adjust priorities or skip items
- Get time estimates refined

## Rules

- No motivational fluff — straight into the plan
- Max 15 words per bullet point
- If a session was just yapping/research with no actionable output, summarize in one line, don't list every message

Checkbox rules, work-repos-first ordering, and thin-context handling live in the references — follow them, don't improvise.
