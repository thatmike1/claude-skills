# Output Format

The briefing follows this template. Adapt sections based on available data — skip sections with no content rather than showing empty placeholders.

## Template

```markdown
# Morning Briefing — [label, e.g. "yesterday" or "Friday-Sunday" or "last 7 days"]

## [Project Name] — [status label]

**Where you left off:** [1-sentence summary of last known state]

- [ ] **Block 1: [name]** (est. Xmin, [risk flag if any])
  - [ ] [verb] [subtask description]
  - [ ] [verb] [subtask description]
- [ ] **Block 2: [name]**
  - [ ] [verb] [subtask description]
- [x] ~~Block done yesterday~~ (context: [what was completed])

## [Next Project]
...

---
**Today's budget:** X-Y hrs realistic
**Suggested sequence:** [one concrete ordering insight]
**Parking lot:** [items explicitly deferred, out of scope, or blocked]
```

## Status Labels

Use one per work stream:
- `in progress` — actively being worked on
- `blocked` — waiting on external dependency
- `ready for CR` — code complete, needs review
- `ready to start` — planned but not started yet
- `research / exploration` — no concrete deliverable yet
- `done` — completed yesterday, shown for context only

## Checkbox Rules

- Parent checkboxes = blocks (logical groups of work)
- Child checkboxes = individual subtasks
- Every subtask starts with a verb: implement, fix, test, rebase, wire, update, review, push
- Bold the actionable part: `- [ ] **Rebase onto main** and resolve conflicts`
- Already-done items use `[x]` with strikethrough
- SKIP items (scope creep parked): `- [ ] ~~SKIP: [idea]~~ (reason)`

## Time Estimates

Only include when you have enough context to estimate meaningfully. Use ranges, not single numbers.

| Column | Meaning |
|--------|---------|
| Focus | Best case, no interruptions |
| Realistic | With context switches, ADHD tax, typical friction |
| Flag | Risk factor: "rebase conflicts", "unknown API shape", "timebox or it'll spiral" |

Apply ADHD-aware multipliers from the goblin/estimate skill when relevant:
- Context switching between projects: 1.3x
- Research rabbit hole risk: 1.5x
- Boring/low-dopamine task: 1.4x
- New/unfamiliar territory: 1.3x

## Sequencing

One concrete insight about ordering, not a generic "do hard stuff first":
- "Batch the iOS testing after all code changes — don't test between each fix"
- "Rebase UC-2 before touching UC-3, the address changes will cascade"
- "Start with the quick wins (rename + remove) to build momentum"

## Day-Fit Assessment

Honest total with a verdict:
- "UC-1.1 + UC-2 is a solid day. UC-3 is bonus round — don't feel bad if it spills."
- "This is 3-4hrs of focused work. You have room for the side project too."
- "This is ambitious for one day. Pick two of these three."

## When Context Is Thin

If gathered data only has 1-2 short sessions and minimal git, don't fabricate a detailed plan. Instead:
- Summarize what little context exists
- Note what's missing ("no Codex sessions found", "no commits yesterday")
- Ask the user to fill in gaps: "What else are you working on today?"
