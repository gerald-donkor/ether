# 001 - Ether landing page

**Status:** executed
**Depends on:** `design-system.md` (repo root)
**Reference:** `public/assets/ui/ref/AI Generator.pdf`, `public/assets/ui/ref/AI Generator.svg` - one artboard, 1440 × 3392pt

---

## Goal

Build the full Ether landing page as a single scrolling route at `/`, matching the reference artboard, using `design-system.md` as the sole source of tokens. Every color, size, radius, and spacing value comes from that document - nothing is invented at implementation time.

## Scope

**In:** the seven sections of the reference, top to bottom - nav, hero, logo wall, feature pair, stat block, gallery strip, footer. Fonts, tokens, assets, responsive behaviour down to 375px, motion, accessibility floor.

**Out:** routing beyond `/`, real generation backend (the prompt field is a non-submitting presentational input), CMS, auth, analytics, dark/light toggle (the page is dark-locked).

---

## Preconditions

1. Read `node_modules/next/dist/docs/` for the App Router and font guides **before writing any component**. This Next.js is 16.3.0 and diverges from training data; do not assume API shapes.
2. Read `design-system.md` in full.
3. `package.json` currently has only `next`, `react`, `react-dom`, `tailwindcss@4`, `@tailwindcss/postcss`. Anything else must be installed explicitly - state the install command before importing.

## Dependencies to add

```
npm i motion @phosphor-icons/react
```

- `motion` - imported as `motion/react`, for the hero stagger, scroll reveals, stat count-up, and gallery drift.
- `@phosphor-icons/react` - nav chevrons, arrow glyphs, footer socials, at `weight="regular"` throughout. No hand-rolled icon SVG.

No GSAP: nothing on this page pins or scrubs, so `whileInView` covers every reveal.

## Assets

1. Extract rasters:
   ```
   mkdir -p public/assets/ui/img
   pdfimages -all -j "public/assets/ui/ref/AI Generator.pdf" public/assets/ui/img/ether
   ```
   Keep and rename: the 2310² macaw (hero anchor), six gallery photographs, three community avatars. Discard the logo crops and smask duplicates.
2. Partner logos from Simple Icons as inline SVG, single white tint: brave, circle, discord, google, jump, lollapalooza, magiceden. Logo wall only - no category labels beneath any mark.
3. Extract the `Ether` wordmark and the abstract brand mark from `AI Generator.svg` as inline SVG components.
4. Delete the leftover `public/*.svg` CNA placeholders (already staged as deleted).

All rasters render through `next/image` with explicit `width`/`height`; the hero macaw carries `priority`.

## Fonts

`next/font/google`: **Outfit** (300/400/500/600) as `--font-outfit`, **Tektur** (500) as `--font-tektur`. Both `display: "swap"`, exposed as CSS variables on `<html>` in `app/layout.tsx`. Tektur is bound to the wordmark component only.

## Token setup

Put every token from `design-system.md` §1 into `app/globals.css` under Tailwind v4's `@theme`, so they are reachable as utilities (`bg-ink`, `text-text-3`, `rounded-card`). Gradients live as CSS custom properties on `:root`, not as Tailwind utilities. No raw hex literals in any component file - that rule is the thing that keeps the palette locked.

## Structure

```
app/layout.tsx          fonts, <html class="dark"> lock, metadata
app/page.tsx            server component, composes the seven sections
app/globals.css         @theme tokens, gradients, base reset, focus ring
components/brand/       Wordmark.tsx, Mark.tsx (inline SVG)
components/ui/          Button.tsx, Container.tsx, PromptField.tsx
components/sections/    Nav.tsx, Hero.tsx, LogoWall.tsx, Features.tsx,
                        Stats.tsx, Gallery.tsx, Footer.tsx
```

`page.tsx` and every section stay Server Components. `'use client'` appears only on the isolated leaves that actually need it: `Nav` (mobile menu state), `HeroReveal`, `StatCounter`, `GalleryDrift`. Motion values use `useMotionValue`/`useTransform` - never `useState` for continuous values.

## Section specs

Sizes are the desktop (≥1280) values from `design-system.md` §1.3.

**1. Nav** - 72px, `--container-wide`, transparent over the hero wash. Wordmark left; `Learn / Build / Product / Community` right with chevrons. Single line at `lg`+. Below `md`, hamburger opening a full-screen `--ink` panel with focus trap and `Esc` to close.

**2. Hero** - `--grad-hero` wash from the top-left corner. Two-column head: H1 left at 60/90 across three lines (`Harnessing Artificial / Intelligence Tools for / Naturally Image Generator`), reaction emoji row plus the reference paragraph right at 15/26 in `--text-2`. Below it the five-cell asymmetric tile grid from §2.3: macaw card with `AI Generator` caption, lime `300+ Projects`, violet community card with avatar stack, violet brand block, lime `Try Free ↗`. Hero top padding 40px - it must not float.

Hero stack discipline: eyebrow-free, headline, one paragraph, and the CTA living inside the tile grid. Nothing else.

**3. Logo wall** - `--container`, one `--violet` uppercase eyebrow (`POWERING TOOLS AND INTEGRATIONS FROM COMPANIES ALL AROUND THE WORLD`) above a single row of seven white marks. This spends the page's first of two eyebrow allowances.

**4. Feature pair** - two `--surface` panels, `--r-panel`, 32px padding. Left: `Automated Image Synthesis and Design` + body + `YOUTUBE` / `PODCAST` ghost pills. Right: `Create stunning visual in seconds` + body + the prompt field (label above, pill input on `--surface-2`, inset lime `Generate`). The field is presentational and does not submit; it still gets a real `<label>`, a real focus ring, and is not a placeholder-as-label.

**5. Stats** - 160px block over the ambient arc. `Join a community of millions.` at 40/58 left; `10.2M+ / 300+ / 1000+` right as `--grad-stat` numerals at 84px with `--text-3` uppercase labels. Count-up fires once on scroll-in and snaps to final under reduced motion. Include the `background-clip: text` fallback.

**6. Gallery** - `Journey Through Art of community` heading on `--container`, then a full-bleed edge-to-edge strip at `--r-none` with mixed tile heights, bleeding past both viewport edges. Two cells are data cards (`48,000` in `--lime` over `IMAGES GENERATED BY ARTIFICIAL INTELLIGENCE`) rather than photographs. Slow horizontal drift, pauses on hover, disabled under reduced motion. This is the page's one marquee.

**7. Footer** - `--ink-raised` plate, `--container-wide`. Wordmark, `Managed by Artificial Intelligence`, social icon row left; `ETHER` (Grants / Generator / Careers / Disclaimer) and `GET CONNECTED` (Services / Blog / Newsletter) columns right under `--text-3` uppercase headings.

## Responsive

Declare the `<768px` fallback inside each section - no "Tailwind will handle it".

- Hero H1 `clamp(34px, 6vw, 60px)`, leading held at 1.35-1.5.
- Hero tile grid: 5 cells → 2 columns at `md` → single column at `sm`, ordered macaw, CTA, projects, community, brand block.
- Feature pair stacks at `md`. Stat split stacks, numerals to `clamp(48px, 11vw, 84px)`.
- Gallery keeps its drift and becomes a touch-scrollable strip with `scroll-snap`.
- Footer columns stack; social row stays horizontal.
- Page gutters: 100px → 32px at `md` → 20px at `sm`.

## Quality floor

- Every interactive element shows a 2px `--lime` focus ring at 2px offset.
- Contrast audited against actual backgrounds: lime surfaces carry `--ink` text, never white. `--text-3` is only used at ≥12px.
- Semantic landmarks: `<header>`, `<main>`, `<section>` with `aria-labelledby`, `<footer>`. One `<h1>`.
- Decorative gradients and the arc are `aria-hidden`.
- `prefers-reduced-motion: reduce` disables arc rotation, gallery drift, and all scroll reveals; the counter snaps.
- Images carry descriptive `alt`; purely decorative tiles carry `alt=""`.
- No emoji in code or UI except the hero reaction row, which is in the reference and stays.

## Copy

Headlines, paragraphs, labels, and link text are transcribed verbatim from the reference. Do not rewrite them into smoother marketing prose - the reference copy is the client's. The one edit permitted: fix the reference's own grammar in `Naturally Image Generator` **only if the user asks**; otherwise it ships as designed, since it reads as the product name.

No numbers beyond the reference's `10.2M+ / 300+ / 1000+ / 48,000`. Do not invent additional spec precision.

## Verification

1. `npx tsc --noEmit`
2. `npm run lint`
3. `npm run build`
4. `npm run dev`, then screenshot `/` at 1440, 768, and 375 and compare against the artboard.
5. Keyboard-traverse the whole page and confirm a visible ring at every stop.
6. Run the `web-design-guidelines` skill over `app/` and `components/`.

## Done when

The page renders all seven sections at all three widths, build and typecheck are clean, motion respects reduced-motion, no raw hex appears outside `globals.css`, and the work is committed to `main`.

---

## Note on the workflow contract

`AGENTS.md` §1 step 6 points at "the contract in section 4", and its resume procedure references "section 1's build list" and "section 7 of the spec". `AGENTS.md` currently ends at line 41 with only section 1 present, and there is no spec document in the repo. This file therefore follows a reasonable structure rather than the intended contract. Worth filling in sections 4 and 7 before the next prompt, so numbering and scope resolution have something to resolve against.
