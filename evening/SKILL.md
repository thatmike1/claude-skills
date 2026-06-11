---
name: evening
description: End-of-day recap that proves what actually got done today — aggregates today's Claude Code sessions, git commits, and beads activity into an honest accomplishment log. The counter to the "I did nothing today" feeling. Use when user says evening, end of day, wrap up, recap today, "what did I actually do today", "did I do anything today", or feels like the day was a mess/wasted.
---

# /evening

Produce an honest end-of-day accomplishment log. The sibling of /morning: morning plans the day forward, evening proves the day backward. The user often invokes this feeling like the day was wasted — the job is to show the receipts, not to flatter.

## Mode Detection

| Signal | Mode |
|--------|------|
| `/evening` | **global** — everything today (default) |
| `/evening repo` / `/evening here` / "what did we do HERE" or similar this-project phrasing | **repo** — only the current project's day |

Unlike /morning, global is the default — the end-of-day question is usually "what did I do overall". In global mode, still pass the current project's stream first if it had activity.

## Workflow

### Step 1: Gather

Reuses the /morning gather script (sibling skill in the same repo) with the `today` range:

```bash
node <skills-repo>/morning/scripts/gather-context.mjs --mode <repo|global> --range today [--project <cwd>]
```

Supplement with anything visible in the current conversation (work done in this very session won't be in the session index yet — include it from context).

### Step 2: Synthesize the receipts

Group into a timeline of work streams, then for each stream pull out:

- **Shipped**: commits, closed beads issues, merged branches — the hard receipts
- **Decided**: decisions made, approaches settled, things de-risked (a settled architecture question is output even with zero diff)
- **Invisible work**: triage, planning, issue filing, tooling/skills/infra, seeds, env setup, reviews of agent output — name it explicitly; this is the work the "did nothing" feeling erases
- **Open loops**: what's mid-flight, parked, or handed to an AFK instance — with where it stands

### Step 3: The verdict

End with 2-4 sentences of honest day assessment:

- Count the receipts ("4 commits, 3 issues closed, 2 filed, 1 skill shipped")
- Name the day's shape ("scattered morning, locked-in afternoon" is a pattern, not a failure)
- If the day genuinely was thin, say so plainly and point at the single most useful thing it produced — don't inflate
- If meta/tooling work dominated, say why it counts (it compounds; tomorrow is faster)

## Rules

- Receipts over vibes: every claim links to an artifact (commit hash, issue id, file, doc)
- Chronological-ish, but group by stream, not by hour — nobody needs minute-level accounting
- Don't moralize about distraction gaps; mention them only if the user asks where time went
- Include work done by directed agents/instances today — directing is doing
- If context is thin, say so honestly rather than padding
- Keep it scannable: short sections, bold the artifacts

## Output Format

See [references/output-format.md](references/output-format.md).
