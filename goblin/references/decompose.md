# Decompose Mode

Break one overwhelming task into steps you can actually start.

## Input

A single task that feels too big, vague, or paralyzing. Examples:
- "Set up the new project"
- "Do my taxes"
- "Refactor the auth system"

## Spiciness (Granularity)

Detect from context or ask. The more overwhelmed the user sounds, the spicier.

| Level | What it means | Step count |
|-------|--------------|-----------|
| **1 — mild** | Concise high-level phases, you know the domain | 5-7 steps |
| **2 — medium** | Clear next actions, moderate detail | 8-12 steps |
| **3 — hot** | Detailed with specifics, sub-steps where needed | 12-18 steps |
| **4 — nuclear** | Literal hand-holding, "open terminal, type X" level | 20-30 steps, every micro-action |

Default to **2** unless the user sounds overwhelmed (bump to 3) or says they know what they're doing (drop to 1).

## Recursive Decomposition

If any step in the output still feels too big, the user can ask to decompose that sub-step further. When they do, keep the parent task in mind for context — the sub-breakdown should make sense within the larger flow.

Example: "do my taxes" → step 1 is "Gather all financial documents" → user asks to break THAT down → output should know we're gathering docs specifically for tax filing.

## Output Format

```
## [Task Name] — [spiciness] breakdown

1. **[Verb] [specific thing]**
   - Detail if medium/hot
2. **[Verb] [specific thing]**
3. ...

First step to do RIGHT NOW: **[step 1 restated as immediate action]**
```

## Rules

- Every step starts with a verb (open, write, send, create, read, decide)
- No step should take longer than 30 min at hot/nuclear spiciness, 2 hours at mild
- If a step would take longer, it needs its own decomposition
- Include "done signals" — how do you know this step is complete?
- The LAST line always restates step 1 as "do this right now" — reduce activation energy
- Don't include "research" as a step unless you scope it ("spend 15 min reading X, then stop")
- If the task involves a decision point, flag it: "DECISION NEEDED: [what to decide] — use /goblin decide if stuck"
- Even a tiny task ("send one email") should get broken down at nuclear spiciness — open client, click compose, write subject, etc. Trust the spiciness level.

## Anti-patterns to catch

- "Figure out how to..." → too vague, rewrite as time-boxed research
- "Make sure everything is..." → what specifically? List the checks.
- "Clean up..." → name the 3 things to clean
