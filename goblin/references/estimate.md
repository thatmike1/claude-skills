# Estimate Mode

Realistic time estimates that account for how brains actually work.

## Input

A task or list of tasks. Can come from compile/decompose output or user-typed.

## Process

1. Estimate the "focus time" — pure uninterrupted work
2. Apply multipliers for real-world factors
3. Output a clear range FIRST, then the breakdown

## Output Format — Single Task

```
**Clean the apartment: 1-2 hours (realistic: 2-2.5 hr)**

Why longer: low-dopamine task (1.4x), setup/context-switch getting started (+15 min)
```

## Output Format — Multiple Tasks

```
| Task | Range | Realistic | Flag |
|------|-------|-----------|------|
| Call dentist | 5-10 min | 10 min | — |
| Do taxes | 1-4 hr | 3-5 hr | rabbit hole + decisions |
| Clean kitchen | 30-60 min | 45-75 min | low-dopamine |

**Total realistic: 4.5-7 hr**
**With breaks: 5.5-8 hr**

Fits in: a full day, but honestly split across 2 days.
```

The range comes FIRST (like goblin.tools does it — quick scannable answer). The "why" detail comes after for anyone who wants it.

## Multipliers

Apply these to the base "focus time" estimate:

| Factor | Multiplier | When to apply |
|--------|-----------|---------------|
| Context switching | 1.3x | Task requires opening new tools/environments |
| Research rabbit hole | 1.5x | Task involves looking things up |
| Decision fatigue | 1.3x | Task has choices to make mid-way |
| Unfamiliar territory | 1.5-2x | First time doing this type of thing |
| Boring/low-dopamine | 1.4x | Admin, paperwork, repetitive work |
| Perfectionism trap | 1.5x | Creative work, writing, UI polish |
| Setup/teardown | +15 min | Any task requiring environment prep |

Multiple multipliers stack (multiply together), but cap at 3x total.

## Spiciness (Range Width)

Like goblin.tools, spiciness here controls how wide the range is:
- **Tight** — confident, narrow range (task is well-defined)
- **Normal** — moderate uncertainty
- **Wide** — lots of unknowns, give a wide honest range rather than false precision

Default to normal. If the task is vague, automatically widen.

## Rules

- ALWAYS give a concrete range. Never "it depends."
- The range is the headline — show it immediately, not buried in a table
- Show the gap between focus-time and realistic — builds time awareness over time
- Round to nearest 15 min for tasks under 2 hours
- Round to nearest 30 min for tasks over 2 hours
- If total exceeds 4 hours, suggest splitting across days
- If total exceeds 8 hours, flag: "this is multi-day work — want me to help plan which day gets what?"
- Include break time for anything over 90 min total
- For known user patterns (over-researches, perfectionist spirals): factor those in explicitly and name them
- Vague tasks should get HONEST wide ranges, not optimistic guesses. "fix the thing" with no context = "15 min to 4 hours depending on what's broken" — not "a few seconds"
