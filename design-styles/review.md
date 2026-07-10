# Review

Review an existing UI (screenshot, mock, HTML, or PR) against ux.md. The output is built for an ADHD reader: verdict first, one-line findings, hard caps. A review that is right but unreadable has failed.

## Workflow

1. State assumptions in ONE line: surface + page type, primary task, primary CTA.
2. Sweep with ux.md: system principles → states → affordance → CRAP/spacing → motion → copy.
3. Prioritize into P0/P1/P2. Diagnose each P0/P1 with the vocabulary from ux.md (execution/evaluation gulf, slip/mistake).
4. Deliver in the format below. Completion bar: every screen/section provided got the full sweep — a review of only the first screenshot when three were given is not done.

## Output format (binding)

```
Verdict: <one sentence — overall state and the single biggest problem>

P0 — blockers (max 3)
- <location> — <problem> [execution gulf] → <fix>

P1 — important (max 5)
- <location> — <problem> [mistake] → <fix>

P2 — polish (max 5, one line each, no diagnosis needed)
- <location> — <problem> → <fix>

Also noticed: <single line rolling up everything that didn't make the caps>

Quick wins: <up to 3 fixes doable in minutes, picked from any tier>
```

Rules:

- Every finding is ONE line: `location — problem → fix`. Evidence goes inside the problem clause ("CTA is #999 on #fff, 2.1:1"), not as separate bullets.
- The caps are real. More findings than slots means ranking harder, not listing longer — overflow lives in the "Also noticed" line.
- No preamble, no methodology narration, no restating what the user showed you.
- When the user asks to go deeper on one finding, expand that one: evidence, diagnosis, fix, acceptance check. Depth on request, never by default.

## Verify-after checklist

Offer (don't dump) this after fixes land: primary CTA singular and obvious · states present (loading/empty/error/success/permission) · clickables look clickable · errors preventable and recoverable · groups match mental model · spacing on scale, alignment true · icons consistent, zero emoji · copy minimal, verbs concrete.
