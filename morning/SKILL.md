---
name: morning
description: Daily briefing skill that aggregates yesterday's work context from Claude Code conversations, Codex sessions, git history, and memory files into an actionable morning plan with time estimates and sequencing. Use when user says morning, start of day, or what was I doing yesterday.
---

# /morning

Produce an actionable morning briefing by gathering and synthesizing context from the previous workday.

The briefing succeeds when the reader finishes it knowing what state each thing is in and what to do first, and fails when it is thorough enough that reading it becomes its own task. What earns space is what changes today's decision — not what happened yesterday.

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
- For each stream, state where it stands now: ship state, what exists, what is holding it
- Checkboxes only for today's actions, with time estimates where possible
- Add sequencing recommendation and day-fit assessment
- Flag scope-creep risks with timebox warnings (see goblin patterns)

**Clean slate:** when every stream is shipped/done and yesterday leaves no real actions, pull next work instead — GitLab issues assigned to the user (`my_issues`, state opened; filter to this project in repo mode) plus `bd ready`. Present as a "Next up" section (see output-format) and let the user pick; don't start anything.

Cover every action, not every session. The gathered context is material to select from, not a list to account for — a session that leaves nothing to do today needs no line at all. What must appear is every branch carrying an open action, every decision still owed to someone, and anything settled yesterday that was never written down anywhere.

Mode-specific details: [references/repo-mode.md](references/repo-mode.md) | [references/global-mode.md](references/global-mode.md)

### Step 4: Present

Show the briefing and stop. Where something in it is a guess — an estimate, a priority call, a stream you couldn't classify — say so in the line where it appears, rather than closing with a menu of ways the user could correct you.

## Rules

- Open with the single thing to do first, before any heading
- Write each bullet as one plain clause the reader can act on without expanding it
- A research or discussion session earns a line only where it produced a decision or a thing to do

Checkbox rules, work-repos-first ordering, and thin-context handling live in the references.

If the session carries a standing instruction about how to write — a hook, an output style, an active register skill — it wins over this skill's shape. Keep the ship-state discipline and the actions; give up the format.
