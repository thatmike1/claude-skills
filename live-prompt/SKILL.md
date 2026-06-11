---
name: live-prompt
description: Write a copy-paste prompt that hands a task (usually a beads issue) to a fresh Claude instance the user will actively work with, in either collaborative (discuss-approach-first) or off-the-leash (implement-end-to-end) mode. Use when the user says "give me a prompt", "shoot over a prompt", "prompt for <task-id>", "handoff prompt", or wants to start a fresh instance on a task. For unattended runs (user going AFK), use the afk-prompt skill instead.
---

# Live Prompt

Write a short prompt the user pastes into a fresh Claude Code instance to start it on a task. The fresh instance has zero context — but the beads task usually has plenty, so the prompt's job is to point, not to re-explain.

## Pick the mode

Two modes. If the user doesn't signal one, ask one short question ("collaborative or off the leash?") — don't guess.

**Collaborative (leash on)** — approach/architecture is still open. The instance reads the task, then discusses before writing any code. Lighter than /grill-me: short back-and-forth, one topic at a time, no relentless interrogation. End the prompt with the handover signal: once the approach is settled, the user lets it implement.

**Off the leash** — decisions are locked. The instance claims, implements, runs gates, commits, reports. Only use when the task description genuinely contains the locked-in approach.

## Structure (both modes)

1. **Task pointer first**: name the beads issue, tell the instance to invoke the beads skill, read the task, and claim it (`bd update <id> --claim`). If decisions live in the description, say "the decisions are in the description — don't relitigate them."
2. **Gist line**: 1-3 sentences of what the work is, so the instance orients before reading. Include file paths / line areas only if already known.
3. **Context NOT in the task**: corrections, traps, related/sibling task IDs, things explicitly out of scope ("don't start <other-id>, just close this one").
4. **Mode-specific block**:
   - Collaborative: "Don't write any code yet. We'll settle the approach together first — especially <the 1-2 genuinely open questions>. Short back-and-forth, one topic at a time, gist over essays. Once settled, I'll let you off the leash."
   - Off the leash: verification step (how to check it worked, on which device/emulator), quality gates, commit format if committing is expected.
5. **Reporting constraint — always include**: "Report the gist of what changed / what you found — diagnosis + fix in a few lines, no full code blocks unless I ask."

## Rules

- Output the prompt in a plain fenced code block, nothing else around it needing edits.
- Target length: ~6-12 lines collaborative, ~10-18 off the leash. If it's growing past that, the detail belongs in the beads task — suggest `bd note` instead of inflating the prompt.
- Don't duplicate task-description content into the prompt; point at it.
- Don't leak the user's global preference file contents into the prompt; only include project-level workflow facts (docker usage, commit style, gates) and only when the instance will need them.
- Imperative voice, addressed to the instance ("Read the task", "Don't write code yet").
- No task tracker IDs in source-code comments — if the prompt asks for code, remind only when relevant.

## Examples

See [EXAMPLES.md](EXAMPLES.md) for one real prompt per mode.
