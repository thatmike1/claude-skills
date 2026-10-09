# Style pack: High-End Agency

The $150k-agency look: haptic depth, cinematic spatial rhythm, obsessive micro-interactions, fluid motion. Apple-esque / Linear-tier. Never generate the same layout twice — pick archetypes per project.

## Pick one vibe archetype

1. **Ethereal Glass** (SaaS / AI / tech) — deepest OLED black `#050505`, radial mesh glows (subtle purple/emerald orbs), vantablack cards with `backdrop-blur-2xl` and white/10 hairlines, wide geometric grotesk type.
2. **Editorial Luxury** (lifestyle / real estate / agency) — warm creams `#FDFBF7`, muted sage or espresso, high-contrast variable serif for massive headings, CSS noise overlay at `opacity-[0.03]` for paper feel.
3. **Soft Structuralism** (consumer / health / portfolio) — silver-grey or white, massive bold grotesk, floating components with ultra-diffused ambient shadows.

## Pick one layout archetype

1. **Asymmetrical Bento** — masonry-like grid of varying card sizes (`col-span-8 row-span-2` beside stacked `col-span-4`). Mobile: single column, `gap-6`.
2. **Z-Axis Cascade** — cards physically stacked, slight overlap, `-2deg`/`3deg` rotations. Mobile: remove rotations and overlaps below 768px.
3. **Editorial Split** — massive type on the left half, interactive scrollable cards or image pills on the right. Mobile: vertical stack, type first.

## Component signatures

- **Double-bezel cards** — never place a card flat on the background. Outer shell: `bg-white/5`, `ring-1 ring-white/10`, `p-1.5`, `rounded-[2rem]`. Inner core: own background, inner highlight `shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]`, concentric radius `rounded-[calc(2rem-0.375rem)]`.
- **Island CTAs** — full pills, `px-6 py-3`. A trailing arrow sits inside its own circular wrapper (`w-8 h-8 rounded-full bg-white/10`) flush with the button's inner edge, never naked beside the text.
- **Eyebrow tags** — pill badge above major headings: `rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em]` (respect landing-craft's eyebrow ration).
- **Macro-whitespace** — `py-24` to `py-40` per section. The design breathes heavily.

## Motion choreography

All motion simulates mass and spring physics: `duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]`.

- **Fluid island nav** — floating glass pill detached from the top (`mt-6 mx-auto w-max rounded-full`). Hamburger lines morph into an X (`rotate-45`/`-rotate-45`); menu opens as a full-screen `backdrop-blur-3xl` overlay; links stagger in (`translate-y-12 opacity-0 → 0/100`, delays 100/150/200ms).
- **Magnetic buttons** — `active:scale-[0.98]` press; nested icon circle translates diagonally and scales to 105% on hover.
- **Scroll entry** — heavy fade-up on viewport entry: `translate-y-16 blur-md opacity-0` resolving over 800ms+. IntersectionObserver or `whileInView`.

## Fonts and materials

- Fonts with character: `Geist`, `Clash Display`, `PP Editorial New`, `Plus Jakarta Sans`. Generic system stacks (Inter, Roboto, Arial, Open Sans) read as template, use them only on explicit request.
- Icons: ultra-light precise lines (Phosphor Light, Remix Line).
- Borders: hairlines (`white/10`, `black/5`) instead of 1px solid gray. Shadows: diffused and ambient instead of harsh drops.
- `backdrop-blur` on fixed/sticky elements only; grain overlays on `fixed inset-0 pointer-events-none` layers only.

## Ship check

Double-bezel on all major cards · island CTA pattern · `py-24`+ sections · custom cubic-beziers everywhere · scroll entries on all major blocks · single-column collapse below 768px · reads as "agency build", not "template with nice fonts".
