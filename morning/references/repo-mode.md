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

- One stream per branch/topic, branch name in the header: `## UC-8 accept invitation (feature/55) — in review`
- If multiple sessions exist for the same branch, merge their context into one coherent narrative rather than listing per-session
- Cross-reference git commits with session discussions — commits made during a session are done work, told as prose
- Ship state per branch comes from the Branch status section plus the MR/PR lookup (Step 2)

## Example

```markdown
# Morning Briefing — yesterday

## UC-8 accept invitation (feature/55) — in review

Fixed the three remaining bugs (resume-after-sign-in, accept redirect, terminal-screen exit) and verified on the S24 plus an iOS sim smoke pass. MR !142 is open, pipeline green, description updated.

- [ ] **Chase review** on MR !142, self-merge if approved (est. 10min)
- [ ] **Close bd bugs** and update the UC-8 epic (est. 10min)

## Map stress test (branch 200) — shipped

Payload fix and marker-cap raise merged yesterday afternoon. Nothing left; pracino-oss tracks the BE follow-up.

## UC-2 company profile — in progress

Codex produced a first implementation of the profile screen; untested, typecheck not run.

- [ ] **Review Codex implementation** and run typecheck (est. 45-60min)
- [ ] **Test on Android emulator** (est. 15min)
```
