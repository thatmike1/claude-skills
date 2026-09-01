---
name: wonder-pill
description: Turns open-ended requests into things to think WITH instead of answers to accept. Audits the hidden assumptions inside a topic, inverts them into sharp "what if" provocations, branches each one outward, and delivers an interactive mind map (a standalone html file opened locally) plus the written wonderings. Use this whenever someone wants ideas, brainstorming, exploration, inspiration, or a direction to head in — "give me ideas for X", "help me brainstorm", "I'm stuck on what to do for my science fair / project / story / thesis", "what are some angles on X" — and especially when they seem to want to think alongside you rather than be handed a finished answer. Also use when someone invokes /wonder, /wonderpill, or asks Claude to "wonder about" something. Do NOT use when they need one decided answer fast, a factual lookup, or execution of a plan they've already chosen.
---

# Wonder Pill

Ported from [ara-mkr/Wonder-Pill](https://github.com/ara-mkr/Wonder-Pill) (MIT). Stages 1–4 and 6
are the author's method, kept as written. Stage 0 asks in plain text instead of claude.ai's
tappable-options widget, and Stage 5 writes a standalone html map to the repo instead of calling
the claude.ai Visualizer.

## What this skill is for

Ordinary brainstorming gets treated like a search query: find the nearest well-trodden answers, rank them, hand them over. That produces a list the person picks from, which quietly makes them the *chooser* instead of the *thinker*, and anchors them to whatever you happened to say first.

This skill produces something different: **provocations to think with.** Questioned assumptions, sharp what-ifs, and branches that keep going — handed back as a map of the thought-space rather than a recommendation. The person stays the thinker. Nothing converges unless they ask it to.

## The one failure mode that matters

The thing that kills this skill is **"generic wild"** — what-ifs that *sound* expansive but have no hook to pull on. "What if plants were different?" is worse than useless: it hands the work back without giving anything to push against. "What if plants could hear?" is alive, because you can immediately feel what would have to change.

Everything below exists to force specificity. The central mechanism:

> **Never invent a what-if freely. Always derive it by inverting a named assumption.**

That traceability is the whole trick. If you can't say which assumption a what-if is pushing against, it isn't ready.

---

## Stage 0 — Intake

Ask **three questions, no more**, before any thinking. These aren't generic clarification — the quality of a what-if is almost entirely determined by how far it's allowed to drift from the person's reality, and that's unguessable. "What if plants could hear" is great for a curious kid and useless for someone submitting a materials list in three days.

Ask them as a numbered list in plain text, each with its options on one line, and stop for the reply:

1. **Leash length** — pure wondering, should be buildable eventually, or has a real deadline?
2. **Hard walls** — anything I shouldn't bother questioning? (budget, timeline, materials on hand, or nothing — go wild)
3. **Opening move** — hunt for a genuinely weird real fact to start from, or work from your framing as-is?

Numbered so they can answer "1, nothing, go find something weird" in one line. Do not ask them one at a time.

**Skip intake entirely** if the request already answers all three. A person who writes "I have two weeks, $30, and it has to fit on a poster board" has told you everything; asking again is annoying and wastes their patience.

---

## Stage 1 — Oddity hunt (once per session only)

If Stage 0 gave permission, take **one cheap pass** to find a genuinely odd, specific fact or unresolved tension in the topic. Search if that helps. This becomes the session's opening spark and sets the tone — it's the most alive entry point because it's rooted in something real rather than an abstract inversion.

Two rules:

- **Once per session, never per branch.** Per-branch oddity hunting becomes padding, slows everything down, and starts to feel like showing off.
- **Fail fast.** If nothing genuinely odd surfaces quickly, drop it without ceremony and move on. A forced "huh, interesting" is worse than not doing this at all.

A real oddity is specific and slightly uncomfortable — a thing that shouldn't work but does, a measurement nobody can explain, two accepted facts that don't quite fit together. Not a trivia factoid.

---

## Stage 2 — Assumption audit (the backbone)

Surface **3–5 load-bearing assumptions** buried in the request. Load-bearing means: if it stopped being true, the shape of the whole thing would change.

For "science fair project," the buried assumptions might be:
- it needs a physical demo
- it needs results measurable in one sitting
- one person builds it
- it uses materials you can buy
- the judges have to understand it in three minutes

Rules that keep this honest:

- **State each assumption plainly as a premise, not as a question.** The premise is a separate artifact from the what-if, and writing it out is what prevents drift into vagueness.
- **Drop anything the person named as a hard wall.** Those aren't up for inversion — inverting them produces useless output dressed as boldness.
- **Prefer the assumptions nobody says out loud.** "Needs to be safe" is stated. "Has to be *finished*" usually isn't, and inverting it is far more interesting.
- **Then invert each one. The inversion IS the what-if.** One per assumption, phrased sharply and concretely.
- **Keep the seed.** When an assumption came from somewhere — a real fact, a historical precedent, an oddity from Stage 1 — record where. These become *seed* nodes on the map, sitting outside their branch, showing why the thought happened at all. A map that shows its provenance is far more useful than one that presents conclusions from nowhere.

### Good vs. bad inversions

| Assumption | Weak what-if (generic wild) | Strong what-if (has a hook) |
|---|---|---|
| A project has to be finished to be judged | What if it weren't finished? | What if the project were a *thing still running* — measurements arriving during the judging, no known result yet? |
| Plants don't perceive stimuli like animals do | What if plants were different? | What if plants could hear, and had been responding to sound the whole time? |
| The experiment happens where you are | What if location changed? | What if the same experiment ran in 40 kitchens at once and the *disagreement between them* was the data? |

The pattern: strong what-ifs name a specific mechanism or consequence, so there's something to grab. Weak ones just negate.

---

## Stage 3 — Tendrils (keep branches from dead-ending)

Each what-if from Stage 2 spawns **2–3 follow-on what-ifs** — "and if that's true, then…". This is where the *wondering* quality comes from; a single question that stops after one hop reads like a prompt, not thinking.

Generate tendrils by running the branch through these **dimensions**, rather than freewheeling (freewheeled tendrils feel arbitrary):

- **Scale** — 1000× bigger, or small enough to be invisible
- **Time** — much slower, much faster, or running forever
- **Reversal** — swap cause and effect; run it backwards
- **Audience** — built for someone it was never meant for
- **Material** — made of the wrong substance entirely
- **Sense** — perceived through a different channel (sound, smell, touch)
- **Causality** — what if the thing you thought was the output is actually the input

**Vary which dimensions you use across branches.** Running all five branches through "scale" makes the output read like a template, which is its own kind of death.

**Let depth be uneven.** Some branches deserve one hop; some deserve four. If a tendril opens a real question, follow it — tendril to sub-wondering to sub-sub-wondering. A map where every branch is exactly three deep is a map that stopped thinking on schedule rather than when the thread ran out. Uneven depth is evidence of actual attention.

**Keep the scraps.** When a what-if gets generated and then discarded, don't delete it — log three separate things about it, not one blended line:

- **Derivation** — which assumption or dimension it came from, same as a branch's premise.
- **Flaw** — what's actually wrong with it, stated plainly.
- **Judgment call** — a separate sentence saying *why that flaw was disqualifying.* Not a restatement of the flaw — the reasoning that got from flaw to "kill it."

**Plausibility and generativity are different axes, and only one of them may kill a what-if.** A what-if may be scrapped for failing *generativity* — it's a genuine dead end, nothing more to ask once you're standing in it. It may **never** be scrapped for failing *plausibility* — sounding unlikely, weird, or hard to build is not a valid reason on its own. Implausible-but-generative stays every time; plausible-and-flat can still die. Say so explicitly in the judgment-call line: name that this was checked against "does it open anything further," not "does it sound reasonable."

This distinction has to be written down and applied deliberately because the kill decision happens in the same breath as the generation — there's no outside check on it, which is exactly the moment a bias toward safe-sounding output would sneak back in unannounced.

Worked example: "What if the bridge floated?" — **derivation:** inverting the assumption that a bridge has to be a fixed structure. **flaw:** trades a 500-year erosion problem for a 5-year mooring-maintenance problem. **judgment:** scrapped for generativity, not plausibility — floating is perfectly buildable, but the thread just swaps one bounded maintenance problem for another and doesn't open a new question past that trade.

Scrapped threads live detached at the edge of the map, not attached to any branch — and the person can still see all three fields and disagree with the call.

---

## Stage 4 — Gut-check pass

One line per branch naming **where the real difficulty or interest is buried.** Not an answer. Not a feasibility verdict. It tells the person where to push if they chase that thread.

Shape: *"This only gets interesting if the hard part is actually X, not Y."*

Also tag each branch **tethered** or **feral**:
- **tethered** — has a plausible shadow back in reality; something could be built or tested from it
- **feral** — pure provocation, kept deliberately because it might spark something sideways

**Never prune the feral ones.** They're not failures of the process, they're the point of allowing the process to run loose. The tags feed the map's styling in Stage 5.

---

## Stage 5 — Deliverable

Three parts, **in this order**. Read `references/mindmap.md` before building the map — clutter is the real risk and that file has the layout spec and the exact data format.

### 1. The mind map — a local html file

There is no inline visualizer here. Write the map's data as JSON and render it with the bundled shell:

```bash
node ~/.claude/skills/wonder-pill/scripts/render-map.mjs <data.json> --open
```

The script writes `<repo-root>/wonder-pill/<kebab-slug-of-topic>-<yyyy-mm-dd>.html` relative to the
repo you are working in, prints the path, and `--open` hands it to `xdg-open`. Put the JSON in a
temp directory, not the repo. It refuses data that breaks the spec (unknown node type, edge to a
node that doesn't exist, a scrapped node missing one of its three fields, a node off-canvas) and
warns about boxes that look like they overlap. Fix what it reports and re-run rather than shipping
a map you haven't seen.

The result is fully expanded from the start: drag to pan, buttons to zoom, click any node to read
its gut-check in the strip below. Nothing hidden behind a reveal — the whole thought-space exists at
once and the person moves around inside it.

It must **not** look like a tidy tree radiating uniformly from a center. Real thinking isn't uniform, and a map that pretends otherwise hides the information the person actually wants. So:

- **Branches sit at different distances and different angles** around the topic, in whatever direction they were reached from.
- **Seed nodes sit outside their branch**, further from the center than the thing they caused — the map reads inward as well as outward. This is where "why did it think that" lives.
- **Depth varies per branch.** One hop where the thread ended, four where it kept going.
- **Scrapped what-ifs float detached** at the edges, struck through, showing all three of: where it came from, what's wrong with it, and why that was judged disqualifying.
- **Cross-links** connect branches that collided on the same tension — this is what makes it a web rather than a tree.

Tell the person the path once it is written; the browser opens on its own.

### 2. Orientation paragraph

Short. Names the **throughlines, not the nodes**: which tension kept recurring, which direction turned out most interesting, where it went genuinely feral. This orients the person *before* they read the map — it is not a synopsis of it. Listing the nodes back in prose is wasted space; they're right there in the map.

### 3. The written wonderings

The readable linear companion, for anyone who'd rather read than scan. Per branch, exactly this spine:

```
### [Short branch title]
**Premise:** [the assumption, stated plainly]
**What if:** [the sharp provocation]
- [tendril]
- [tendril]
- [tendril]
**Gut-check:** [where the real difficulty or interest hides]
```

Write them into the chat. If the person asks for a file, put it next to the map as
`<same-slug>-<date>.md`.

---

## Stage 6 — End open

**Do not converge.** Close with an invitation only — something like *"if one of these is itching at you, say which and I'll go deeper on just that thread."*

The strongest temptation in this whole skill is to quietly turn back into a recommendation engine by the last paragraph — ranking the branches, picking a favorite, suggesting which is most practical. That undercuts the entire premise. The person asked for a space to think in, not a verdict. If they want convergence they'll say so, and then you can help them land one.

## If they pick a thread

Re-run Stages 2–4 on that single branch. The branch becomes the new topic; its tendrils become the new assumptions to audit. Skip intake (already calibrated) and skip the oddity hunt (already spent). Still don't converge.

The map's detail strip has a *copy go-deeper prompt* button that puts `Go deeper on the thread: …`
on the clipboard, which is how a person hands a branch back from the map itself.
