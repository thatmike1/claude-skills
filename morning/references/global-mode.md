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

- Use coarser blocks (higher level, fewer subtasks per project)
- Keep each project section to 3-5 items max — this is an overview, not a deep dive
- Lead with work projects, personal projects go in a separate section at the end
- If a project only had minor activity (1 short session, few commits), summarize in one line
- Include a "time split" summary: "~60% pracino, ~30% b2b-3d-planner, ~10% personal"

## Example

```markdown
# Morning Briefing — Friday-Sunday

## b2b-3d-planner — done

**Where you left off:** Issue 569 (Austrian locale) completed, committed, pushed. PR review comments addressed.

- [x] ~~Issue 569: Austrian locale support~~ (done Friday)
- [ ] **Check if PM deployed** to staging

## pracino — in progress

**Where you left off:** UC-1.1 blocked by BE, started UC-2 in Codex. iOS testing setup partially done (macOS VM ready, need to boot and verify).

- [ ] **UC-1.1: Check BE status** and continue if unblocked
- [ ] **UC-2: Review and test** Codex implementation
- [ ] **iOS VM: First boot** and simulator check (low priority)

## Personal

**aw-watcher-git:** PR cleanup, reviewed Windows support branch.

---
**Today's budget:** ~6-7hrs focused work
**Suggested sequence:** Check BE status first (2min), then UC-2 review (biggest chunk), b2b deploy check (5min), iOS as filler
**Time split Friday-Sunday:** ~50% pracino, ~40% b2b-3d-planner, ~10% aw-watcher-git
```
