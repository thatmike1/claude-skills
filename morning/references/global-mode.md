# Global Mode

Activated by `/morning global`.

## Scope

- All CC and Codex sessions from the date range, across all projects
- Git log across all repos in ~/git/ that had commits
- Memory from all project memory directories
- Repos tagged as work (gitlab) or personal (github)

## Synthesis Focus

In global mode, go broader — high-level overview across projects:

1. **Project grouping** — group work streams by project, work repos first
2. **Time allocation** — note which projects got the most attention (session count, commit count)
3. **Cross-project dependencies** — if one project's work affects another, flag it
4. **Context switching cost** — if many projects were touched, note the overhead
5. **Priority signal** — what felt urgent vs. what was filler/procrastination

## Output Adjustments

- Coarser than repo mode: one short paragraph + max 3 checkboxes per project — this is an overview, not a deep dive
- Lead with work projects, personal projects go in a separate section at the end
- If a project only had minor activity (1 short session, few commits), summarize in one line
- Include a "time split" summary: "~60% pracino, ~30% b2b-3d-planner, ~10% personal"
- The script skips Branch status in global mode — ship state still needs the MR/PR lookup (Step 2) before any push/MR action

## Example

```markdown
# Morning Briefing — Friday-Sunday

## b2b-3d-planner — shipped

Issue 569 (Austrian locale) merged Friday, review comments addressed.

- [ ] **Check staging deploy** with PM (est. 5min)

## pracino — in progress

UC-1.1 address wiring is blocked on the BE push. UC-2 got a first Codex implementation, still unreviewed. iOS VM is configured but never booted.

- [ ] **Check BE status**, continue UC-1.1 if unblocked
- [ ] **Review and test** UC-2 Codex implementation
- [ ] **Boot iOS VM** and verify simulator (filler)

## Personal

**aw-watcher-git:** PR cleanup, reviewed Windows support branch.

---
**Today's budget:** ~6-7hrs focused work
**Suggested sequence:** BE check first (2min), UC-2 review as the main chunk, iOS as filler
**Time split Friday-Sunday:** ~50% pracino, ~40% b2b-3d-planner, ~10% aw-watcher-git
```
