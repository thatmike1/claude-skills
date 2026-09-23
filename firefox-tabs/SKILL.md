---
name: firefox-tabs
description: Clean up Mike's live Firefox and Sidebery tabs when he asks to organize or close tabs. Propose a short, reasoned batch for his quick review, then verify the closures through the local bridge.
---

# Firefox tabs

The helper lives at `/home/thatmike1/git/ccChat-general/projects/firefox-tab-bridge/bridge.py`. Firefox's regular tab API supplies live IDs; the newest Sidebery snapshot in `~/Downloads` supplies indentation. The snapshot is context, never an action target.

## Connect

1. Run `python3 <helper> status`. If the helper is stopped, run `python3 <helper> serve` in a persistent process. The first run creates the ignored local key and `extension/local-config.js`.
2. If `status` still reports zero tabs, open `about:debugging#/runtime/this-firefox` and have Mike load `projects/firefox-tab-bridge/extension/manifest.json` with **Load Temporary Add-on**. A temporary add-on disappears on Firefox restart. Wait for a fresh `lastSync` before acting.
3. Read live windows and choose the intended one. Mike's usual eating window has a large YouTube group; his day-to-day window is the other one. Verify against the current tabs, then run `python3 <helper> focus <window-id>`.

## Triage

Do the judgment work. Inspect titles, URLs, Sidebery depth, and relevant current project state. Look for exact duplicates, repeated app instances left open after use, hosted and local copies of the same mock, completed work, and transient setup pages. Verify suspected content duplicates before treating them as identical. Preserve intentional pinned tabs and named collections unless Mike specifically wants them reviewed.

Prepare a **short suggested batch with a concrete reason per tab**. The page is for quick review of your suggestions, not an inventory of every open tab. Write a JSON array of `{ "id": <live integer>, "reason": "..." }` to a temporary file; run `python3 <helper> propose <file>`. The helper records each tab's current URL so a stale proposal will disappear from the page. Open `http://127.0.0.1:1345/review` in Firefox. Suggestions are preselected; Mike can uncheck any and click **Close selected**.

After his click, run `python3 <helper> status` and check `lastResult` for every proposed closure. Repeat with another small batch while the remaining candidates have a defensible reason. The bridge refuses pinned tabs and checks live ID, URL, and window again immediately before closing.

## Finish

Report how many tabs closed in the focus window and what remains by type. Keep the Sidebery JSON export for recovery. Stop the local helper when the cleanup is over; the temporary add-on becomes inert until the next run.
