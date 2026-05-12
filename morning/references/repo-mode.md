# Repo Mode

Activated by `/morning` when run from a project directory (default mode).

## Scope

- Only sessions from the current project's working directory
- Git log for this repo only
- Memory from this project's memory directory
- Open beads issues if `.beads/` exists

## Synthesis Focus

In repo mode, go deeper on the single project:

1. **Branch context** — note which branch(es) were active, any branch switching
2. **Specific code areas** — if sessions discussed particular files/components, mention them
3. **Task continuity** — identify work that was started but not finished, PRs in progress
4. **Blocker detail** — if something was blocked (API not ready, review pending), surface it prominently
5. **Decision trail** — capture key decisions made ("switched to approach X because Y")

## Output Adjustments

- Use more granular blocks (smaller subtasks, more detail per item)
- Include branch names in block headers where relevant: `**Block 1: Rebase feature/14 onto main**`
- If multiple sessions exist for the same branch, merge their context into one coherent narrative rather than listing per-session
- Cross-reference git commits with session discussions — if a commit was made during a session, note it as done

## Example

```markdown
# Morning Briefing — yesterday

## pracino — in progress

**Where you left off:** UC-1.1 address wiring blocked by backend; pivoted to setting up macOS VM for iOS testing. UC-2 company profile screen implementation started in Codex.

- [ ] **Block 1: UC-1.1 address wiring** (est. 30-45min, blocked by BE push)
  - [ ] **Check if BE pushed** address refactor branch
  - [ ] Rebase feature/14 onto main if new changes available
  - [ ] Wire address fields to real API shape
- [ ] **Block 2: UC-2 company profile** (est. 1-2hr)
  - [ ] **Review Codex implementation** from yesterday's session
  - [ ] Run typecheck and fix compiler errors
  - [ ] Test on Android emulator
- [ ] **Block 3: iOS testing setup** (est. 30min, low priority)
  - [ ] Boot macOS VM (already downloaded/configured)
  - [ ] Verify Xcode + simulator work
- [x] ~~GitLab issue 569~~ (done: Austrian locale support committed and pushed)
```
