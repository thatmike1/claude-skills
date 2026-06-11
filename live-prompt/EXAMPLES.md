# Examples

Both are real prompts from a Pracino session (2026-06-11).

## Off the leash — small, fully-diagnosed task

The beads task already contained the diagnosis; the prompt adds the fix direction, verification, scope guard, and the reporting constraint.

```
Implement beads task pracino-ei5.10 in the Pracino repo. Invoke the beads skill, then
claim it: bd update pracino-ei5.10 --claim. Read the task notes first — the diagnosis
is already done.

Gist: seeded candidate avatars are DiceBear SVG urls (apps/api/scripts/seed-dev-offers.cjs,
around lines 591 and 967), and expo-image's Android blurRadius is a no-op on SVG sources,
so the public-locked blurred-avatar treatment does nothing in dev. Fix: switch the seed
avatar urls to DiceBear's PNG endpoint (/png variant of the same urls). Check whether
company logos / workplace photos in the same script have the same problem; fix only the
candidate avatars unless others are also SVG.

After the change, re-run the seed (docker compose exec -u node app npm run drizzle:seed)
and verify a public-locked candidate card shows a blurred avatar on the Android emulator.

This unblocks pracino-ose.1 (blur display-states rework) — don't start that task, just
close ei5.10 with a short reason. Commit as one line, lowercase, fix: prefix. Report back
the gist of what changed, not full code.
```

## Collaborative — approach still open

Decisions about *what* were locked in the task description; *how* (blurred-text technique, state flow) was open, so the prompt forbids coding and names the open questions.

```
We're working on beads task pracino-ose.1 in the Pracino repo. Invoke the beads skill,
read the task (the decisions are in the description — don't relitigate them), and claim it.
Also skim pracino-ose (parent epic) for call context.

Don't write any code yet. We'll figure out the approach together first — especially how to
visually do "blurred name" in RN (no text blurRadius; placeholder-name + masked blur vs a
redacted-pill style that matches the photo blur, etc.) and how the states flow through the
existing CandidateAvatar/getDisplayLevel pieces. Short back-and-forth, one topic at a time,
gist over essays. Once we've settled the approach, I'll let you off the leash to implement.
```
