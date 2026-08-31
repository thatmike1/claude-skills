# Audit Report Format

## Template

```markdown
# Claude Code Audit Report

**Overall health:** [HEALTHY | NEEDS ATTENTION | FIX THESE NOW]
**Sessions analyzed:** X (last Y days)

## Quick Wins

The 2-3 changes with the biggest impact-to-effort ratio. Each one is a single concrete action.

1. **[Action verb] [specific thing]** — [why it matters, one sentence]
2. ...

## Findings

### [CRITICAL] [Finding title]

**What:** [one-sentence description of the problem]
**Impact:** [what this costs you — degraded output, wasted context, lost memories, etc.]
**Fix:**
```
[exact command, path change, or step-by-step action]
```
**Evidence:** [data from the audit that triggered this finding]

### [WARNING] [Finding title]
...

### [SUGGESTION] [Finding title]
...

## Stats Snapshot

| Metric | Value | Healthy Range |
|--------|-------|---------------|
| Sessions (last 30d) | X | — |
| Median file size | X | < 500KB |
| Median messages/session | X | 20-60 |
| Compaction rate | X% | > 30% for long sessions |
| Memory locations | X | 1 per active project |
| CLAUDE.md coverage | X/Y repos | all active repos |

## What's Working Well

[Explicitly call out healthy patterns — this isn't just a problem list]
```

## Severity Levels

| Level | Meaning | Examples |
|-------|---------|---------|
| CRITICAL | Actively degrading output quality or losing data | System dir sessions, 500k+ context with no compaction |
| WARNING | Suboptimal with noticeable impact | Home-root sessions, orphaned memories, missing CLAUDE.md on active repos |
| SUGGESTION | Nice-to-have improvement | Low compaction rate, no global CLAUDE.md, unused skills |

## Tone

- Direct, not judgmental — "you're launching from System32" not "you're doing it wrong"
- Every finding gets a fix — no diagnosis without prescription
- Acknowledge what's working — if output quality is good despite setup issues, say so
- Scale advice to the user's level — a power user gets different suggestions than a beginner
