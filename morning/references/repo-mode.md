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
5. **Decisions that still bind** — a call made yesterday that constrains today's options. A decision with no consequence for today is not one worth a line

## Output Adjustments

- One stream per branch/topic, branch name in the header: `## UC-8 accept invitation (feature/55) — in review`
- If multiple sessions exist for the same branch, merge them into one statement of where that branch stands rather than listing per-session
- Cross-reference git commits with session discussions to establish what is already done — done work is context for the actions, not an item of its own
- Ship state per branch comes from the Branch status section plus the MR/PR lookup (Step 2)

## Example

```markdown
# Morning Briefing — yesterday

## UC-8 accept invitation (feature/55) — in review

MR !142 is open, pipeline green, description written. All three bugs (resume-after-sign-in, accept redirect, terminal-screen exit) are fixed and verified on the S24 plus an iOS sim smoke pass. Nothing gates it but a reviewer.

- [ ] **Chase review** on MR !142, self-merge if approved (est. 10min)
- [ ] **Close bd bugs** and update the UC-8 epic (est. 10min)

## Map stress test (branch 200) — shipped

Merged; pracino-oss tracks the BE follow-up.

## UC-2 company profile — in progress

Codex produced a first implementation of the profile screen; untested, typecheck not run.

- [ ] **Review Codex implementation** and run typecheck (est. 45-60min)
- [ ] **Test on Android emulator** (est. 15min)
```
