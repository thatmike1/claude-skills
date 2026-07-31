# Output Format

A briefing is prose with a few actions — not a task tree. Each stream states where the work stands now and what is holding it, then carries only the checkboxes you'd actually tick today. Skip sections with no content rather than showing empty placeholders.

## Template

```markdown
# Morning Briefing — [label, e.g. "yesterday" or "Friday-Sunday" or "last 7 days"]

## [Stream name] — [ship state / status]

[Current state: what exists now, its ship state, and what is holding it. Add history only where it changes what to do today — a decision that constrains the next step, an approach already tried and rejected. A shipped stream gets one sentence; a stream nobody can act on today gets one sentence and the reason. Finished work lives here as prose, never as checked-off boxes.]

- [ ] **[Verb-first action]** (est. X-Ymin, [risk flag if any])
- [ ] ...

## [Next stream]
...

---
**Today's budget:** X-Y hrs realistic
**Suggested sequence:** [one concrete ordering insight]
**Parking lot:** [deferred, blocked, or scope-creep items — one line each]
```

## Next Up (clean slate only)

When every stream is shipped and no actions carry over, replace budget/sequence with a pick-list of next work:

```markdown
## Next up

Yesterday's streams all shipped. Candidates for today:

1. **[GitLab #N / bd id] [title]** — [one line: why it's a candidate, rough size]
2. ...
```

- Max 5 candidates, ordered by your best guess at priority (assigned + labeled in-progress first, then planned, then bd ready work)
- Recommend one, but the pick is the user's — end by asking which to start


## Status Labels

Ship states from the verify step take precedence for branch-backed streams: `shipped`, `in review`, `unshipped`. For streams without a branch: `in progress`, `blocked`, `ready to start`, `research`.

## Checkbox Rules

A checkbox is an action you'd take today. Everything else is prose.

- Max 4 per stream; `shipped` streams get zero
- Verb-first, bold the action: `- [ ] **Rebase onto main** and resolve conflicts`
- Every checkbox must be consistent with the stream's verified ship state
- Scope-creep ideas go to the parking lot, not into checkboxes

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
