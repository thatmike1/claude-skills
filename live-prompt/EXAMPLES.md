# Examples

One real prompt per mode.

## Off the leash — approach locked in memory + bead (ccChat-general, 2026-08-24)

Day 5 of a hackathon sprint. The approach lived in a memory file with an explicit
RESUME HERE pointer plus a sprint bead, so the prompt points at both and spends its
own lines only on traps the fresh instance couldn't discover cheaply.

```
Read .memory/project_all_things_agentic.md, then invoke the beads skill, read
ccChat-general-5k6 and claim it (bd update ccChat-general-5k6 --claim). The decisions
are in the memory file and bead — don't relitigate them.

Today is D5 of Pixel Patrol (~/git/pixel-patrol, GCP project pixel-patrol-mp). Start
with the RESUME HERE step: run the stability report on smoke-trackers and count the
overnight drift decisions (a handful = fine; many = raise STABILITY_WINDOW). Then D5
proper: the Gemini tools — KB-grounded unknown-host classification, Czech
cookie-policy redline + RoPA row.

Traps: gemini-3.5-flash is Vertex `global` location only (europe-west1 404s). gcloud
must run under the named config `pixel-patrol` (the `default` config is a different
account — don't mix). ADMIN_KEY is in the agent-report file the memory names, not in
git — keep it out.

Commit as you go inside ~/git/pixel-patrol and push (origin is set). Report the gist
of what changed and what the stability count said — a few lines, no full code blocks
unless I ask.
```

What it shows: task pointer first, gist that orients before reading, a traps block
for context NOT in the task, verification folded into the first step (the stability
count), and the reporting constraint.

## Collaborative — approach still open (Pracino, 2026-06-11)

Decisions about *what* were locked in the task description; *how* (blurred-text
technique, state flow) was open, so the prompt forbids coding and names the open
questions.

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
