# Examples

## Two-task shower run (Pracino, 2026-06-11)

Task selection: from ~8 open tasks, only these two were decision-free AND self-verifiable. Rejected: a form-UX task (needed the user's taste), two bugs (intermittent repro), an investigation needing a recording review.

```
Work through two beads tasks in the Pracino repo, one at a time, autonomously — I'm AFK.
Invoke the beads skill, then for each: claim it, read the description, implement, close.

Task 1 — pracino-ose.3: rename "Adresa" to "Adresa bydliště" in candidate registration
AND the Základní údaje profile section, plus a tap-to-show (i) tooltip "Adresa nebude
zveřejněna". The tooltip must stay subtle — follow existing UI patterns in
apps/mobile/src/features/shared rather than inventing a new component style. Take
before/after screenshots for my review.

Task 2 — pracino-ose.2: the company workplace gallery upload is image-only
(apps/mobile/src/features/company/components/gallery-edit-form.tsx + shared
use-image-upload hook). First check whether the BE upload endpoint accepts video at all
(api contract + upload module in apps/api — read-only, do NOT change backend code). If BE
rejects video: skip the FE change, write findings via bd note, close as
investigation-complete. If BE looks fine: loosen the picker to allow video, then test
end-to-end on the connected physical device (agent-device; Galaxy S21 over USB) — log in
as the company account, edit the company profile gallery, upload the short screen
recording at the top of the gallery, and verify it appears/plays. Screenshot the result.

Gates per task: typecheck + lint from apps/mobile (npm run lint). Commit each task
separately: one line, lowercase, feat:/fix: prefix. If a task turns out to need a
decision from me, bd note what's blocking and move on rather than guessing.

Report at the end: gist only — what changed, what you found, screenshot paths. No full
code blocks.
```

### What this run taught

- **Name the verification environment.** The first version said "Android emulator"; the instance booted a fresh emulator alongside the user's connected physical phone and burned 20 minutes on crashes before being redirected. The fix is the explicit line: "connected physical device (agent-device; Galaxy S21 over USB)" — and when relevant, "do NOT boot the emulator."
- **Conditional branches paid off.** Task 2's "if BE rejects video → note + close as investigation-complete" meant the run couldn't wedge on an unimplementable task.
- **State the account.** "Log in as the company account" exists because the gallery is company-side and the app could be sitting on any login.
