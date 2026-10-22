---
name: thread-explainer
description: A page of every open T3 Code thread, sorted into lanes by what each one wants from Mike, read straight from T3's own database. Use when he asks for the thread explainer, what his open threads want from him, or to catch up on all of them at once.
---

# thread explainer

Mike fires threads as ideas arrive, then comes back and cannot tell what each one wants. The page answers that per thread in one line he can act on, sorted into lanes and numbered by sidebar position, so Ctrl and the number jumps straight to it. You do the judging; the scripts collect and lay out.

`S=~/.claude/skills/thread-explainer/scripts`

## 1. Gather

`node $S/gather.mjs` reads T3's state read-only and prints a new run folder holding `facts.json` for the build and `read.md` for you. The thread you run in is found from your session id and left out, and so are snoozed threads.

## 2. Judge every thread

Read `read.md` whole, then write `judgments.json` beside it, one entry per thread id:

```json
{ "threads": { "<thread id>": {
  "kind": "answer",
  "about": "What the thread is about now, one sentence.",
  "you": "The one thing he does next.",
  "happened": "What it did and found, two or three sentences.",
  "context": "Optional: what he needs to know before acting.",
  "links": [{ "label": "overnight page", "href": "/home/thatmike1/.../index.html" }]
} } }
```

The lanes, one `kind` per thread:

- `answer`: the last reply asks him something he can answer from the chat.
- `look-answer`: it made something (a page, an image, a PR) and wants his verdict on it.
- `do`: his next step happens outside the chat: a click, a setting, a key to rotate, a fresh thread to start.
- `look`: it made something worth opening, and nothing waits on a reply.
- `running`: a run or a delegated agent is still going; `you` says what comes back.
- `none`: finished, settling it is all that is left; `you` stays empty.

Reading a thread:

- His own messages carry the ask, and the tail is often progress lines. When they disagree, his latest real message wins.
- A Jarvis thread runs for a day or more, plans and hands off, so `read.md` gives it four of his messages: read them all. Its next step often sits in his own long message. On 22 Oct 2026 that was "write a handoff, I start a fresh Jarvis, settle this one", while the tail still talked about decisions he had moved past.
- Date-bound wording (tonight, tomorrow, before the trip) gets checked against the run date at the top of `read.md`; a step whose day has passed is stale.
- When he wrote last and nothing is running, the thread never answered him: that is `do`, and `you` says so.
- `about` is what the thread is about now, since titles go stale. `you` is an imperative short enough for a strip of label tape, about fifteen words, in his plain words: no ids, model names or the thread's own jargon.
- `links` are the pages and files listed under the thread that exist, plus anything a reply names that he must open to act.

The step is done when every thread in `read.md` has an entry. A thread you skip shows on the page as "Not read in this run".

## 3. Build and open

`node $S/build.mjs <run folder>` prints the page, `~/.cache/thread-explainer/latest.html`; open it with `xdg-open`. Reply in a line or two: how many threads want an answer or a move from him, and that the page is open.
