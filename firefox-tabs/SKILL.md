---
name: firefox-tabs
description: Triage Mike's live Firefox tabs (Sidebery tree, the YouTube pile included) when he asks to close, tidy or clear out tabs. Group suggested closures with a reason, open the review page in Firefox, and he flips what to keep and closes them in one click.
---

# Firefox tabs

Firefox answers on `127.0.0.1:1345` itself: `firefox.cfg` loads `~/git/ccChat-general/projects/firefox-tab-bridge/firefox-bridge.js` at startup, so there is no add-on to load and no helper to start. The agent side is `tabs.py` in that folder; run everything below from there.

Every tab comes with its Sidebery parent and panel and the time it was last viewed. YouTube video tabs also carry their length, channel and **how much of the video ActivityWatch heard play** (audible time, not tab focus). These signals are what make a suggestion trustworthy. The first listing of a window full of videos takes about half a minute while yt-dlp fills its cache.

## Steps

1. `python3 tabs.py status`: windows, tab counts, YouTube counts, panels. Pick the window Mike means; the memory note `firefox-tab-bridge` has his window habits.
2. `python3 tabs.py list --window <id>` (add `--videos` for the YouTube pile, `--json` for full data). Lines read `id flags age title [video note] <url>`, indented by Sidebery depth.
3. Judge. Strong close signals: played to the end, never played and two weeks or older, exact duplicates, search and home pages whose results are open beside them, finished setup pages. Half-watched videos and anything ambiguous are his call. Verify a suspected duplicate before calling it one.
4. Write a proposal and run `python3 tabs.py propose <file>`. It checks every id, attaches the video data and opens the review page in that window:

   ```json
   {
     "window": 1,
     "headline": "23 YouTube tabs you are done with",
     "note": "One sentence on what the pile is and what stays.",
     "groups": [
       {"title": "Played to the end", "note": "ActivityWatch heard these play through.",
        "default": "close", "tabs": [34, 57]},
       {"title": "Half watched", "note": "Kept unless you say otherwise.",
        "default": "keep", "tabs": [{"id": 41, "reason": "optional, only when it adds something"}]}
     ]
   }
   ```

   Two to five groups, each a plain title plus one takeaway line. `default: close` only for groups you would defend tab by tab. A video tile already shows the channel, length, played amount and age, so a per-tab `reason` is for judgment the page cannot show. The page is the suggestion, not an inventory: the rest of the window sits behind a collapsed link at the bottom.
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
