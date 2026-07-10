# UX Baseline

The functional layer: whether the thing works for a human, independent of how it looks. Distilled from oiloil-uiux. Apply top-down — system principles first, then components.

## System principles

- **Concept constancy** — one business concept keeps one name, meaning, and behavior everywhere. Learned once, transfers everywhere.
- **Primary task focus** — one dominant objective per screen, identifiable in < 3 seconds, one primary CTA.
- **State perceptibility** — modes, scopes, selections, unsaved changes must be perceivable. Signal order, lowest-noise first: structural change → control state (tabs/toggles) → inline signifier (scope chip, selection count) → post-action feedback → persistent banner (high-risk sticky modes only). A status label restating what the layout already shows is noise.
- **Feedback loop closure** — every action completes the loop: received → in progress → result → next step. At any moment the user can tell what the system is doing and what to do next.
- **Prevention + recoverability** — easy to do right, safe to recover when wrong. Constraints, defaults, and inline validation before submit; undo or deliberate confirmation for the destructive.
- **Progressive complexity** — minimum controls by default, advanced capability revealed by context. Novices finish fast, experts keep throughput.
- **Cognitive load budget** — limit new terms, rules, and interaction modes per screen; reuse beats novelty. As information grows, comprehension cost stays flat.
- **Copy source discipline** — UI copy comes from user task, system state, result + next step, or trust context. Style constraints, implementation notes, and self-referential process framing ("this page showcases…") stay internal.

## Help text layering

Dumping every hint on screen feels safe and destroys hierarchy.

- L0 always visible: only what's needed to complete the task correctly.
- L1 nearby: short guidance on high-risk or ambiguous inputs.
- L2 on demand: examples, advanced detail, "learn more".
- L3 after action: result, error, recovery, next step.

One clear helper line beats three repetitive hints. A page needing many persistent hints needs better IA or defaults, not more copy.

## Affordance and signifiers

- Primary actions are real buttons labeled with verbs ("Create", "Publish" — "OK"/"Done" say nothing). Icon-only is reserved for the universally known (search, close, more, settings).
- Links look like links (underline or strong hover), never color-only subtlety.
- Custom clickable surfaces get `cursor: pointer` + visible focus style; clickable rows get hover + chevron or an explicit "View".
- Controls sit near what they affect: filters above the list, section actions in the section header.
- Constraints (format, units, required) shown before submit, not revealed by the error.

## Diagnosis vocabulary (for reviews)

Label each major issue:

- **Execution gulf** — user can't find *how* (entry point, signifier, IA).
- **Evaluation gulf** — user can't tell *what happened* (state, feedback).
- **Slip** — right goal, wrong execution (misclick, wrong target) → fix targets, spacing, confirmations.
- **Mistake** — wrong mental model (labels/mapping mislead) → fix naming, grouping, conceptual model.

## Surface checklists

**States (every interactive surface):** loading = stable-height skeleton, no double-submit · empty = what empty means + a next step · error = what happened + what to do, input preserved · success = outcome + next action · permission = why blocked + where to ask.

**Lists:** one primary field, secondary muted · search/filter/sort before the list, early not late · active filters visible and removable · frequent row actions visible, long-tail behind "more".

**Forms:** defaults and prefill reduce thinking · group fields by meaning under headings · inline validation · one primary submit · error placement consistent · labels never inside placeholders.

**Settings:** grouped by mental model (account, security, notifications, appearance) · destructive actions separated, never among benign toggles.

**Dashboards:** decide the decision the screen serves · small top KPI set, no wall of numbers · time range and filters obvious and persistent · every key metric has a drill-down.

## CRAP + spacing

- **Contrast** — emphasize the few things that matter (CTA, current state, key numbers).
- **Repetition** — tokens and spacing follow one scale; "almost the same" styles are bugs.
- **Alignment** — one grid, fix 1–2px drift, align baselines where text matters.
- **Proximity** — tight within a group, loose between groups; spacing is the grouping tool, not boxes.

Spacing: base 4px, allowed set 4/8/12/16/24/32/40/48; off-scale values need a reason. Same component type = same internal spacing. Wrappers that only add border/background get removed — group with space instead.

## Motion

Motion explains hierarchy (what is a layer) or state change (what just happened) — decoration doesn't qualify. Vocabulary: fade → small translate+fade → tiny scale+fade for overlays. The work surface stays still; panels move. Feedback feels immediate — the UI never makes the user wait for an animation. Red flags: breathing backgrounds, floating cards, elastic overshoot, page-level transitions for routine navigation.

## Icons and copy

- One consistent icon set, one stroke width, labels wherever ambiguity exists. Emoji are never icons.
- Short labels over helper paragraphs. Helper text earns its place only by preventing an error, defining a non-obvious term, explaining consequences, or building trust. For every string: if removed, does layout + position still carry the meaning? Then remove it.

## Anti-AI self-check (after generating any UI)

- Gradients convey meaning (progress, depth, state) — max one decorative gradient per page; background + buttons + borders all gradiented = pick one, flatten the rest.
- No emoji slipped in as section icons, status markers, or button labels.
- Every purely visual effect (blur, glow, entrance animation, layered shadow) answers "what does this help the user understand?" — no answer, no effect.
