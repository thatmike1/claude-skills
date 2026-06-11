---
name: afk-prompt
description: Write a copy-paste prompt that hands one or more tasks (usually beads issues) to a fresh Claude instance to run autonomously while the user is away — no questions, no waiting for input. Includes picking which tasks are safe to run unattended. Use when the user says they're going AFK (shower, lunch, errand, overnight), asks "which tasks can just run without me", or wants an autonomous/batch prompt. For attended sessions the user will steer, use the live-prompt skill instead.
---

# AFK Prompt

Write a prompt for a fresh Claude instance that runs unattended. Nobody will answer questions or course-correct, so the prompt trades brevity for explicitness — the opposite bias from live-prompt.

## Step 1: pick (or vet) the tasks

If the user asks which tasks fit, or names candidates, vet each against:

- **Decision-free**: the task description contains every decision; nothing left that needs the user's taste or approval. Tasks with open UX/architecture questions are out.
- **Self-verifiable**: the instance can check its own work (gates, tests, device screenshot) without the user.
- **Bounded**: investigation tasks are fine if "write findings and close" is an acceptable outcome; open-ended repro hunts on intermittent bugs are not.

If the tracker has an agent-ready tag/label, filter by it first. Batching 2-3 small tasks into one instance is good — sequential, one claim/implement/close cycle each.

## Step 2: write the prompt

1. **AFK declaration first**: "Work through these autonomously — I'm AFK." Then per task: invoke beads skill, claim, read, implement, close.
2. **Per-task block**: gist, known file paths, and what done looks like.
3. **Environment, explicitly**: which device/emulator to verify on, how to reach it, and what NOT to touch. Never let the instance guess the verification environment — name it ("connected physical device via agent-device; do NOT boot the emulator"). State account/login if the app needs one.
4. **Scope walls**: name sibling tasks/areas it must not start, and read-only zones ("check apps/api but do NOT change backend code").
5. **The escape hatch — always include**: "If a task turns out to need a decision from me, bd note what's blocking and move on to the next task rather than guessing." For investigations: define the fallback close ("if X turns out false, write findings via bd note and close as investigation-complete").
6. **Gates + commits**: quality gates per task, separate commit per task, commit format.
7. **End report**: "Report at the end: gist only — what changed, what you found, screenshot paths. No full code blocks."

## Rules

- Length: ~15-25 lines is fine — explicitness beats brevity when nobody's watching. Past that, move detail into the beads tasks via bd note.
- Conditional branches beat optimism: write "if A then ship, if B then note+close" rather than assuming the happy path.
- Order tasks cheapest-first so a wedged later task doesn't eat the easy wins.
- Expect the run to be slow and careful — that's correct for unattended work, not a flaw. Don't add "be quick" pressure.
- Don't leak the user's global preference file into the prompt; project-level workflow facts only.

## Examples

See [EXAMPLES.md](EXAMPLES.md) for a real two-task AFK prompt and the environment-guessing failure it teaches.
