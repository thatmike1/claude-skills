---
name: cc-audit
description: Audits Claude Code setup and usage patterns, flagging anti-patterns (wrong launch dirs, context bloat, orphaned memories, missing CLAUDE.md) with severity-ranked fixes. Use when user says audit, health check, setup check, cc audit, or wants to improve their Claude Code workflow.
---

# /cc-audit

Analyze Claude Code usage patterns and produce a severity-ranked audit report with actionable fixes.

## Workflow

### Step 1: Gather data

Run the gathering script from this skill's `scripts/` directory:

```bash
node <skill-dir>/scripts/gather-audit-data.mjs [--days 30] [--repos-dir ~/git]
```

- `--days` controls the lookback window for session pattern analysis (default: 30)
- `--repos-dir` points to where git repos live (default: ~/git)
- Script outputs structured markdown with session stats, directory analysis, memory org, and CLAUDE.md coverage

### Step 2: Synthesize

Read the gathered data and produce an audit report. See [references/output-format.md](references/output-format.md) for the template and [references/anti-patterns.md](references/anti-patterns.md) for the full catalog.

Key synthesis tasks:
- Map raw data to the anti-pattern catalog — match findings to known issues
- Assign severity: **critical** (actively degrading output quality), **warning** (suboptimal, noticeable impact), **suggestion** (nice-to-have improvement)
- Write a specific fix for each finding — not generic advice, but the exact command or action
- Identify the top 2-3 "quick wins" — changes with the best effort-to-impact ratio
- If data is thin (few sessions, new install), say so — don't manufacture issues

### Step 3: Present

Show the report. Offer to:
- Walk through fixing the top issues right now
- Generate a CLAUDE.md for repos that are missing one
- Help reorganize orphaned memories

## Rules

- Never read conversation content — this is a metadata-only audit
- Be specific: "launch from ~/git/my-project instead of ~" beats "use project directories"
- If the setup is actually healthy, say so — don't find problems where there aren't any
- Adapt thresholds to the user's volume — 50 sessions/month is different from 5
