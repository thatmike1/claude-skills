---
name: firefox-tabs
description: Triage Mike's live Firefox tabs when he asks to close, tidy or clear out tabs. Default is window B, his everyday window on the second monitor; with "youtube" as the argument it is window A's YouTube pile. Group suggested closures with evidence, open the review page in Firefox, and he flips what to keep and closes them in one click.
---

# Firefox tabs

Firefox answers on `127.0.0.1:1345` itself: `firefox.cfg` loads `~/git/ccChat-general/projects/firefox-tab-bridge/firefox-bridge.js` at startup, so there is no add-on to load and no helper to start. The agent side is `tabs.py` in that folder; run everything below from there.

## Which window

- **B, the default:** his everyday window on the second monitor, where stacks of work tabs build up. This is what the skill was made for.
- **A, with the argument `youtube`:** the window on his main monitor (another desktop) holding the YouTube pile.

`tabs.py` takes `A` and `B` wherever it takes a window id: A is the window with the most YouTube videos, B the biggest other one. `status` prints which is which.

## What each tab carries

Its Sidebery parent, panel and nearest Sidebery group, and when it was last viewed. Then facts that make a suggestion trustworthy, shown in `{}` in the listing and as a badge on the page:

- blank tab; also open in this or the other window (the copy viewed last is never the duplicate)
- nothing running on a localhost port; a local file saved on disk or deleted (a deleted file's tab is the last copy, so that one is his call)
- bead status for beadside links; pull request or issue state for GitHub links
- YouTube videos: length, channel and **how much ActivityWatch heard play** (audible time, not tab focus). The first listing of a window full of videos takes about half a minute while yt-dlp fills its cache

## Steps

1. `python3 tabs.py status`: windows with their letters, tab counts, panels. The memory note `firefox-tab-bridge` has his window habits.
2. `python3 tabs.py list --window B` (or `A --videos` for the pile; `--json` for full data). Lines read `id flags age title [video] {facts} <url>`, indented by Sidebery depth.
3. Judge. Strong close signals: blank tabs, second copies, stopped local servers, closed beads, merged pull requests, finished setup pages (API keys, DNS, dashboards visited once), search pages whose results are open beside them, videos played to the end or never played and two weeks old. Old artifacts and reading in his Sidebery groups, half-watched videos and anything ambiguous are his call. For project tabs, check the project's current state before calling one finished.
4. Write a proposal and run `python3 tabs.py propose <file>`. It checks every id, attaches the video data and opens the review page in that window:

   ```json
   {
     "window": "B",
     "headline": "17 tabs in window B can go",
     "note": "One sentence on what the pile is and what stays.",
     "groups": [
       {"title": "Played to the end", "note": "ActivityWatch heard these play through.",
        "default": "close", "tabs": [34, 57]},
       {"title": "Half watched", "note": "Kept unless you say otherwise.",
        "default": "keep", "tabs": [{"id": 41, "reason": "optional, only when it adds something"}]}
     ]
   }
   ```

   Two to five groups, each a plain title plus one takeaway line; the headline's number is the tabs in `close` groups. `default: close` only for groups you would defend tab by tab. Every row already shows its facts, site, Sidebery group and age (and videos their channel, length and played amount), so a per-tab `reason` is for judgment the page cannot show. Blank tabs in a group fold into one row. The page is the suggestion, not an inventory: the rest of the window sits behind a collapsed link at the bottom.
5. Mike flips tiles (faded means it closes) and presses **Close**. The bridge recloses nothing that changed: a tab that navigated, got pinned, or is a folded Sidebery parent whose children were not ticked is left open and reported.
6. `python3 tabs.py result` shows what happened. Report the count closed and anything left open with its reason. Another round is fine while defensible candidates remain.

## Safety nets

- The page's **Undo** reopens the last batch unloaded (nothing starts playing), in order, at the bottom of its Sidebery panel. Sidebery places new tabs there whatever index Firefox asks for.
- Every closed batch is appended to `~/.local/state/firefox-tabs/closed.jsonl` (title and url), so a closed tab is never lost.
- Nothing closes without his click. The API can close tabs, but this skill never calls `/close` itself.

## When it does not answer

- **Firefox was started before `firefox.cfg` had the loader, or an apt upgrade replaced `/usr/lib/firefox`.** The upgrade wipes `firefox.cfg` and `defaults/pref/autoconfig.js`; reinstall both from `~/.config/firefox-userchrome/` (see the `firefox-arcwtf-setup` memory note) and restart Firefox.
- **After editing `firefox-bridge.js`:** run `python3 tabs.py reload-bridge`. `review.html` is read from disk on every request, so a page edit only needs a reload of the tab.
- **Testing against the headless profile copy** (`~/.config/firefox-userchrome/harness/`) uses port 1352: set `TAB_BRIDGE_PORT=1352`.
