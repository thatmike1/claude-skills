# Landing Craft

Anti-slop methodology for landing pages, portfolios, and marketing sites (distilled from Leonxlnx/taste-skill). Not for dashboards, data tables, wizards, or product UI — say so and route to ux.md when the brief is one of those.

## The three dials

Set after the design read; every layout/motion/density call is gated by them.

| Use case | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| Landing (SaaS mainstream) | 7 | 6 | 4 |
| Landing (agency/creative) | 9 | 8 | 3 |
| Landing (premium consumer) | 7 | 6 | 3 |
| Portfolio (designer) / (developer) | 8 / 6 | 7 / 5 | 3 / 4 |
| Editorial/blog | 6 | 4 | 3 |
| Trust-first / public-sector | 3 | 2 | 5 |
| Redesign: preserve / overhaul | match / +2 | +1 / +2 | match |

- VARIANCE 1–3 symmetric grid · 4–7 offsets and mixed aspect ratios · 8–10 masonry, fractional grids, huge empty zones. Above 4: centered heroes give way to split-screen or asymmetric compositions. All asymmetry collapses to single column below 768px.
- MOTION 1–3 hover/active only · 4–7 fluid CSS transitions and load-in cascades · 8–10 scroll-driven choreography. Motion claimed = motion shown: a static page with MOTION 7 is broken; if you can't ship working motion, drop the dial to 3 and ship clean static.
- DENSITY 1–3 art gallery (`py-32+`) · 4–7 standard (`py-16–24`) · 8–10 cockpit (1px rules, mono numbers, no card boxes).

## Real design systems

If the brief reads as an established ecosystem, install the official package instead of hand-rolling its look: Fluent (Microsoft-ish), `@material/web`, Carbon (IBM-ish), Polaris (Shopify), Primer (GitHub-ish), govuk-frontend/USWDS (public sector), shadcn/ui or Radix Themes (modern SaaS), Tailwind v4 utilities (indie default). One system per project. For pure aesthetics (glass, bento, brutalism, editorial) there is no official package — build honestly with CSS/Tailwind and say so.

## Stack defaults

- React/Next.js, Server Components by default; anything with Motion, scroll, or pointer physics is an isolated `'use client'` leaf.
- Tailwind v4 (`@tailwindcss/postcss`, not the old plugin). Animation: Motion — `import { motion } from "motion/react"`.
- Fonts via `next/font` or self-hosted `@font-face` + `font-display: swap`.
- Continuous input-driven values (mouse, scroll, magnetic hover) use `useMotionValue`/`useTransform`/`useScroll` — `useState` re-renders per frame and collapses on mobile.
- Icons priority: `@phosphor-icons/react`, `hugeicons-react`, `@radix-ui/react-icons`, `@tabler/icons-react`. Lucide only on request. One family, one `strokeWidth`, no hand-drawn icon paths.

## Typography

- Display default: sans with character — Geist, Outfit, Cabinet Grotesk, Satoshi, PP Neue Montreal. Inter only when the brief asks for neutral/Linear or public-sector.
- **Serif discipline:** serif display is the most-tested AI tell. Reach for it only when the brand names one, or the brief is genuinely editorial/luxury/heritage AND you can say why this serif fits this brand. Fraunces and Instrument Serif are banned as defaults. Emphasis inside a headline = italic/bold of the same family, never a serif word dropped into a sans headline.
- Italic display words with descenders (`y g j p q`): `leading-[1.1]` minimum + `pb-1` reserve, or they clip.
- Body: `max-w-[65ch]`, relaxed leading.

## Color

- One accent, saturation < 80%, locked across the whole page — no blue CTA appearing on a warm-grey site in section 7. One gray family (warm or cool, never both).
- The AI-purple glow aesthetic is a fingerprint — neutral bases (zinc/slate/stone) with one considered accent (emerald, electric blue, deep rose, burnt orange). If the brand IS purple, execute purple with intent.
- **Premium-consumer palette rotation:** the beige+brass+espresso "warm craft" palette is the default AI reach for cookware/wellness/artisan briefs — banned unless the brand explicitly owns it. Rotate: cold luxury (silver/chrome/smoke), forest (deep green/bone/amber), black+tan, cobalt+cream, terracotta+slate, olive+brick+paper, monochrome+one pop.
- Page theme lock: ONE theme (light/dark/auto) for the whole page; sections never flip modes mid-scroll. Tints within the family are fine.

## Layout hard rules

- **Hero fits the viewport:** headline ≤ 2 lines, subtext ≤ 20 words and ≤ 4 lines, CTA visible without scroll. 4-line headline = font-size error. Sensible scale: `text-4xl md:text-5xl lg:text-6xl`; the 7xl+ range only for 3–5-word headlines. Top padding ≤ `pt-24`.
- **Hero stack ≤ 4 text elements:** (eyebrow OR brand strip) + headline + subtext + CTAs (1 primary + ≤1 secondary). Trust strips, pricing teasers, feature bullets, avatar rows move below the hero. Logo walls live UNDER the hero.
- **Eyebrow ration:** max 1 eyebrow per 3 sections, hero counts. Mechanical check: count `uppercase tracking` micro-labels; count ≤ ceil(sections/3). Default replacement: none — the headline is enough.
- **Section variety:** a layout family (3-col cards, full-width quote, split text+image) appears at most once per page; 8 sections need ≥ 4 families. Zigzag image/text alternation caps at 2 consecutive. The split-header pattern (big left headline + small right floater paragraph) defaults to a vertical stack instead.
- **Bento:** exactly as many cells as content items — no blank filler tiles. 2–3 cells per grid carry real visual variation (image, tinted background, pattern), not all white-on-white text.
- **Nav:** one line at desktop, ≤ 80px tall.
- **CTAs:** label fits one line (≤ 3 words); one label per intent page-wide ("Get in touch" and "Let's talk" on one page = same intent, pick one).
- Cards only when elevation means hierarchy; otherwise `border-t`, `divide-y`, or space. Tint shadows to the background hue. One corner-radius system page-wide (all-sharp / all-soft / all-pill, or a documented mixed rule).

## Content density

- Per section: headline ≤ 8 words, sub ≤ 25 words, one visual OR one CTA.
- Lists > 5 items get a real component (2-col groups, card grid, tabs, scroll-snap pills, marquee — max one marquee per page), not a longer `<ul>`. Spec tables: 3–4 hero specs as display tiles + "view full specs" disclosure, or grouped clusters — never 10 rows of hairlines.
- Numbers are real, or labeled mock, or absent — no invented precision (`5.8mm`, `92%`).
- **Copy self-audit before ship:** reread every visible string; rewrite anything grammatically broken, referent-free, or LLM-poetic ("elegant nothing" phrases). Plain beats cute.

## Images

Priority: (1) image-generation tool if available — section-specific assets at the right aspect ratio; (2) `https://picsum.photos/seed/{descriptive-seed}/{w}/{h}`; (3) labeled TODO slots + tell the user what's needed. Even minimalist pages need 2–3 real images. Logo walls use real SVG marks (`https://cdn.simpleicons.org/{slug}/{color}`), logos only — no category labels beneath. Div-built fake product screenshots are banned; use a real screenshot, a generated one, a live mini-component, or nothing.

## Scroll motion patterns

- Simple viewport reveals: Motion `whileInView` + `viewport={{ once: true, amount: 0.3 }}`, stagger `i * 0.06s`, ease `[0.16, 1, 0.3, 1]`. Save GSAP for pin/scrub work.
- Sticky-stack (GSAP): every card except the last pins with `start: "top top"`, `pin: true`, `pinSpacing: false`; the previous card's scale/opacity scrubs against the NEXT card's trigger. `"top center"` starts = the classic half-pinned bug.
- Horizontal pan (GSAP): pin the wrapper `start: "top top"`, `end: "+=${track.scrollWidth - innerWidth}"`, scrub the inner track's `x`. `invalidateOnRefresh: true`.
- Always `gsap.context()` + cleanup in `useEffect`; gate everything behind `useReducedMotion`.
- Never mix GSAP/Three.js with Motion in one component tree.

## AI tells (hard bans)

The signatures of "trying to look designed". Zero tolerance unless the brief demands one:

- **Em/en-dash characters (`—`, `–`) anywhere visible.** Hyphen for ranges, period/comma/colon for prose. Binary rule, no "sparingly".
- Version labels in the hero (`V0.6`, `BETA`, `EARLY ACCESS`) · section-number eyebrows (`001 · Capabilities`) · `01 / 4` pagination labels · rotated vertical text · decorative crosshair/hairline grids.
- Middle-dot separator chains (`foo · bar · baz`) — ration to 1 per line · decorative status dots (only real semantic state earns a dot, max one per section).
- "Quietly trusted by" · "Field notes" / "From the field" poetic labels · mock-humble asides · weather/locale/time strips (`LIS 14:23 · 18°C`) · `BRAND. MOTION. SPATIAL.` decoration strips · scroll cues (`↓ Scroll to explore`) · version footers (`v1.4.2 · main`) on marketing pages · pills/captions overlaid on images (`Plate 03 · House archive`) · generic step labels (`Step 1 / Phase 01` — the verb is the label).
- Jane Doe effect: no "John Doe", "Acme Corp", "Sarah Chan", egg avatars, `99.99%`, Lorem Ipsum — realistic names, invented-but-believable brands, organic numbers, real draft copy, sentence case headers.
- Filler verbs: "Elevate", "Seamless", "Unleash", "Next-Gen", "Revolutionize", "Delve" — concrete verbs only.
- Quotes: ≤ 3 lines, real typographic quotes or none, attribution as name + role (+ company).

## Pre-flight (mechanical, before delivering)

- [ ] Design read declared; dials stated and reasoned
- [ ] Zero `—`/`–` on the page
- [ ] Theme lock, accent lock, radius lock all hold page-wide
- [ ] Hero: ≤ 2-line headline, ≤ 20-word sub, ≤ 4 elements, CTA above fold, `pt-24` max
- [ ] Eyebrow count ≤ ceil(sections/3)
- [ ] No layout family repeats; zigzag ≤ 2 consecutive
- [ ] Every CTA: AA contrast, one line, unique intent
- [ ] Real images present; no div-screenshots; logos are real SVGs
- [ ] Copy self-audit done; no tells from the list above
- [ ] Reduced-motion honored; only `transform`/`opacity` animated; no raw scroll listeners
- [ ] `min-h-[100dvh]`; explicit mobile collapse for every multi-column section
- [ ] Loading/empty/error states exist where the page has interactive elements
- [ ] Both color modes tested (unless print-emulating editorial)

One unticked box = not done.
