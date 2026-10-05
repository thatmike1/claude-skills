---
name: redline
description: Read and work through the notes Mike left on his own apps with the redline Firefox extension, from the repo the app lives in. Use when he says read the feedback, check the redline notes, go through my notes on the app, or names a note id like rl-k3f2.
---

# redline

Mike marks things on his running apps in Firefox: he clicks an element, drags an area, or writes a whole-page note, and redline saves the text with the page URL, a CSS selector, the element's HTML and styles, its React component names when the build keeps them, and two screenshots. A site is linked to a repo, so `redline` run inside a repo lists that repo's notes. The store is plain files under `~/.local/share/redline/`; the CLI works without the server.

Mike answers in the app, not in chat. Whatever you write with `-m` is what he reads on the note's card next to the element, so write it for him: what changed and where to look, in a sentence or two.

## Work the queue

1. `redline` in the repo lists the open and in-progress notes. `redline show <id>` gives everything about one note, including the screenshot paths. Read the crop screenshot before deciding what a note means: "this is too small" only makes sense next to the picture.
2. Triage before you build. Group the notes that touch the same component, and work out which are quick fixes, which are real features, and which you cannot read. If the repo tracks work in beads and a note is a feature rather than a fix, file a bead, then `redline reply` with its id.
3. `redline take <id>` before you start on a note, so its pin shows the agent is working on it.
4. Find the code from the selector, the `data-testid` or text, the React names, and the section heading. Fix it and check it in the running app. The note's URL is the page to open.
5. Close each note out:
   - `redline fix <id> -m "..." --commit <sha>` when it is done. Mike checks it on the page, then marks it "Looks good" or "Not yet". If he says not yet, the note comes back to `open` with his reply.
   - `redline ask <id> -m "..."` when the note reads two ways. Ask one concrete question; his answer reopens the note.
   - `redline decline <id> -m "..."` when it should not be done, with the reason. He can accept that or push back.

Never close a note yourself. Closing is Mike's verdict.

## When a note is missing

If `redline` says no site is linked, `redline list --all` shows the notes across every site. `redline link <origin>` ties a site to the current repo. A localhost site is guessed from whichever folder serves the port, and a deployed site from the repo whose name matches the hostname.

The extension, the server (`redline.service` on 127.0.0.1:1347) and the install steps are documented in `~/git/ccChat-general/projects/redline/README.md`.
