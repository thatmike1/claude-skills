---
name: gpt-pro
description: Hand a question to ChatGPT's Pro model or its image generator through the user's own chat window, off the Codex meter — the agent packs the prompt and context, the user pastes it and copies the answer back. Use when a plan or design wants a second opinion from another model family, for a large divergent idea run, for self-contained 3D or math-heavy code, for an image, or when the user says gpt-pro or asks to put something to ChatGPT.
---

# gpt-pro

Typed messages in ChatGPT's **Chat** mode are metered apart from the Work and Codex
allowance, and Chat carries the Pro model and image generation. That makes it an
**oracle**: strong, slow (a Pro answer can take tens of minutes), blind to this machine,
and reachable only through the user's hands. One fat prompt goes in, one answer comes out.

The user's hands do the paste and the copy. OpenAI's terms rule out programmatic
extraction of output, and the hand-carry also lets the user work in whichever browser or
ChatGPT app is already open. Your half is everything around it: the prompt, the context,
the clipboard, reading the answer.

## What belongs with the oracle

- A **second opinion** on a plan, design or diagnosis. Another model family finds other holes.
- A **divergent idea run**: many candidates, ranked down to finalists.
- **Self-contained code** that is heavy on 3D or math: a single-file scene, a shader, an algorithm.
- An **image**.

Work that needs more than about two round trips against the codebase belongs with a
worker that can read the repo, because every trip here is re-packed and hand-carried.

When a task in front of you fits and the user has not mentioned the lane, offer it in one
line and wait for a yes. `send` takes over their clipboard, so nothing is prepared on spec.

## A run

Runs live in `gpt-pro/<date>-<slug>/` inside the project the question belongs to.
`scripts/gpt-pro.mjs` owns the folder layout and the clipboard; its header is the reference.

1. `new <slug> --root <project-root>` prints the run folder.
2. Write `prompt.md` there. Copy every file the oracle needs into `context/`, including
   uncommitted and untracked work. It unpacks a zip without trouble, so pack generously.
3. `send <run-dir>` zips `context/`, puts the prompt on the clipboard and opens the folder
   for the drag. Tell the user what to do: Chat mode, the Pro model (or image generation),
   paste, attach `context.zip`, send. Then end your turn; the wait belongs to them.
4. When they say it is done and they have clicked Copy on the answer, `receive <run-dir>`
   writes `answer.md`. Exit 2 means the clipboard still holds the prompt or no text: ask
   them to copy again.
5. Files it produced (images, a zip of outputs) arrive in the downloads folder.
   `collect <run-dir>` moves the one file newer than the send into `returned/` and unpacks
   a zip. Exit 2 lists several candidates: name the right ones as arguments.
6. A follow-up in the same chat is `prompt-2.md`, then `send` and `receive` again.

The run is complete when the answer is on disk, you have read it, and you have told the
user what it changes about the work in front of you.

## Writing the prompt

The oracle knows nothing: no repo, no conversation, no user. The prompt states the goal,
what each file in the zip is, what has been decided and is out of scope, and the exact
shape of the answer. Ask for one markdown answer, since the Copy button returns markdown.
When several files should come back, ask for them as a single zip: one download for the
user, where loose files cost one click each.

Ask big. One observation so far: a 300-candidate idea run took about as long as a
100-candidate one, so widening a single prompt is cheaper than sending a second.

A chained run (an idea refinery fed by its own past results) starts a new run folder and
puts the previous run's `answer.md` into `context/`. The folders are the chain, so the
user never re-pastes old results.

## The GitHub connector

If the user has GitHub connected in ChatGPT, the oracle can read a pushed repo itself, but
only after the user tags the connector in the message box. Reach for it when the
exploration is the point ("look around this repo and say what you think"), and name the
repository in the prompt. The packed zip stays the default: you choose exactly what is in
it, and it carries work that was never pushed.
