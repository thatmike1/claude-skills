# Redesign

Upgrading an existing site without breaking it. Work with the existing stack — no framework or styling-library migrations, no big-bang rewrites.

## Detect the mode first

- **Preserve** — modernize within the brand. Audit, extract tokens, evolve.
- **Overhaul** — new visual language, same content and IA. Treat visuals as greenfield.
- Ambiguous? Ask once: "preserve the existing brand, or start visually from scratch?"

## Audit before touching

Document current state: brand tokens (colors, type, logo, radii) · IA and conversion paths · which content blocks work vs filler · signature patterns to preserve · tells and broken patterns to retire · SEO baseline (slugs, meta, structured data — the #1 redesign risk).

Then diagnose against this checklist. Each finding: `location — problem → fix`.

**Typography** — default/Inter-everywhere fonts → swap for character (Geist, Outfit, Satoshi) · weak headlines → bigger, tighter tracking, lower leading · body wider than 65ch · only 400/700 weights → add 500/600 · proportional figures in data → `tabular-nums` · orphaned last words → `text-wrap: balance`.

**Color/surfaces** — pure `#000` backgrounds → off-black · oversaturated accents → desaturate below 80% · multiple accents → pick one · mixed warm+cool grays → one family · AI-purple gradients → neutral base + one accent · pure-black shadows → tint to background hue · flat sterile sections → noise, grain, or low-opacity imagery · random dark section in a light page → consistent theme · inconsistent light direction across shadows → unify.

**Layout** — everything centered → break symmetry · three equal feature cards → zig-zag, asymmetric grid, or masonry · `100vh` → `100dvh` · flexbox percentage math → CSS Grid · no max-width container → add 1200–1440px · uniform radius everywhere → tighter inner, softer outer · CTAs at random heights in card rows → pin to bottom · misaligned baselines across side-by-side panels → align shared elements · mathematically-centered icons that look off → 1–2px optical nudges.

**States** — missing hover/active/focus → add (scale 0.98 press, visible focus ring) · spinners → skeletons matching layout shape · no empty/error states → design them · dead `#` links → real or disabled · no active-nav indicator → add · instant anchor jumps → `scroll-behavior: smooth`.

**Content** — Jane Doe names, Acme brands, `99.99%`, Lorem Ipsum, "Oops!", exclamation-mark success toasts, Title Case Everywhere → realistic names, believable brands, organic numbers, real copy, direct error messages, sentence case.

**Code** — div soup → semantic tags · inline styles → the project's styling system · missing alt text · `z-index: 9999` → a documented scale · hallucinated imports → check `package.json` · missing meta/OG tags.

**Typically forgotten** — legal links, back navigation, custom 404, form validation, skip-to-content link, favicon.

## Fix priority (impact ÷ risk)

1. Font swap — biggest lift, lowest risk
2. Color cleanup
3. Hover/active states
4. Layout and spacing rhythm
5. Replace generic components
6. Loading/empty/error states
7. Typography scale polish

Stop when the brief is satisfied; ~70% of the value lives in levers 1–4.

## Never change silently

URL slugs · primary nav labels · form field names/order (analytics + autofill) · logo/wordmark · legal and consent copy · existing accessibility wins (focus states, alt text, contrast) · analytics event hooks. Test after every change; keep diffs reviewable.
