# 003 - Logo wall scrolls as a continuous horizontal marquee (GSAP)

**Status:** proposed
**Depends on:** `001-landing-page.md` (executed), `002-gallery-column-vertical-drift.md` (executed), `design-system.md` §3, §5
**Touches:** `components/sections/LogoWall.tsx`, new `components/motion/LogoMarquee.tsx`, `design-system.md` §3 and §5.1/§5.2
**Reference:** user screenshot `Screenshot_20260812_144423.png` (the red-circled partner row) and screencast `Screencast_20260812_144222.webm` (the target behaviour)

---

## Goal

The seven partner marks stop sitting in a static, centred, wrapping row. They run as one continuous right-to-left marquee, full-bleed edge to edge, forever, at a constant speed, with no visible seam and no reset jump. The eyebrow above them (`POWERING TOOLS AND INTEGRATIONS FROM COMPANIES ALL AROUND THE WORLD`) stays exactly where it is, centred and still.

The screencast is the behavioural spec, and three things were read off it frame by frame:

- Motion is **right to left**, linear, never pausing, never easing.
- Speed is roughly **60px/s** (a given mark crosses ~325px of the 1245px-wide capture in 8s, scaled back to the capture's native width).
- The strip is **full-bleed**: marks enter and leave at the screen edges, not at the container measure, and they clip hard at those edges. There is **no fade mask** on either end.
- The heading above the strip does not move.

## Scope

**In:** the partner row becomes an infinite GSAP-driven horizontal marquee, full-bleed, seamless, disabled under `prefers-reduced-motion`.

**Out:** logo assets, logo order, logo sizing, the eyebrow's copy or styling, the section's vertical rhythm, any other section, ScrollTrigger or any scroll-linked behaviour, hover interaction of any kind.

---

## Preconditions

1. Read the relevant guide in `node_modules/next/dist/docs/` before writing the client component. This Next.js is 16.x and diverges from training data.
2. Read `.agents/skills/gsap-react/SKILL.md`, `.agents/skills/gsap-core/SKILL.md` (§ `gsap.matchMedia()`), `.agents/skills/gsap-performance/SKILL.md`, `.agents/skills/gsap-utils/SKILL.md`.
3. Read `design-system.md` §3, §5.1, §5.2 in full, and `components/motion/ColumnDrift.tsx` - the new component is its sibling and should read like it.

## Deviations to record

| Rule | What we do | Why |
|---|---|---|
| §3 / §5.2 "One marquee per page" | The logo wall becomes a second marquee region | The user asked for it explicitly, pointing at the row in `Screenshot_20260812_144423.png` and at the target behaviour in `Screencast_20260812_144222.webm`. Per `AGENTS.md` §1, an explicit user request overrides the rule; the rule is not silently bent, it is retired and rewritten. |

`design-system.md` must be edited in the same change, not left contradicting the code:

- §3's table gains a `Logo wall` row: *Continuous right-to-left marquee, ~60px/s, full-bleed, never pauses* - reason: *the row's argument is breadth of adoption, and a row that keeps producing new names argues it better than a row of seven that fits on one line.*
- §3's `**One marquee per page**` sentence becomes `**Two marquee regions, both ambient**` - the gallery on both its axes, and the logo wall on one - and keeps the rest of its `prefers-reduced-motion` clause verbatim, extended to name the logo wall.
- §5.1's existing `§5.2 / §3, one marquee per page` row stays (it still records why the gallery has two axes) and the row above records this second deviation.
- §5.2's `**One marquee per page**` bullet is rewritten to match, naming both regions. Everything else in §5.2 stays binding, in particular: **transform and opacity only**, and **reduced motion collapses everything**.

Nothing else in `design-system.md` changes.

---

## Mechanism

Same trick the gallery track uses, with one correction that the gallery does not need.

**Why the gallery's two-pass approach is not enough here.** Two passes work when one pass is already wider than the viewport, which is true of the gallery's photo strip and false here: seven marks at `h-5` measure roughly 900px including gaps, so on a 1440px or 1920px screen a two-pass track would run out of content and show empty ground before the loop came round. So the track holds **four passes** and travels `xPercent: -25`, which is exactly one pass. Four passes of ~900px cover a ~2700px viewport with a full pass still off-screen to the right.

Concretely:

- **New client component** `components/motion/LogoMarquee.tsx`, `"use client"`, structured like `ColumnDrift.tsx`: a `useRef` scope, `useGSAP` with `{ scope }`, `gsap.registerPlugin(useGSAP)` at module level, and a `gsap.matchMedia()` block gated on `(prefers-reduced-motion: no-preference)` so that under reduced motion **no tween is ever created** and the row renders as a plain static strip. `return () => mm.revert()`.
- It takes `children` and renders `<div ref={scope} className="overflow-hidden">` around them. The tween targets `[data-logo-marquee]` inside the scope, never a bare selector.
- The tween: `gsap.to(track, { xPercent: -25, duration: 15, ease: "none", repeat: -1 })`. 15s for one ~900px pass is the ~60px/s read off the screencast. `ease: "none"` because a marquee that eases is a marquee that stutters.
- **No hover pause.** The gallery pauses on hover because its tiles are content a reader may want to stop on. Seven partner marks are not; pausing would only make the strip feel broken when the pointer crosses it on the way somewhere else.
- **In `LogoWall.tsx`:** the `<h2>` stays inside `<Container>` and inside `<Reveal>`, untouched. The strip moves **outside** `Container` so it is full-bleed, and gets its own `<Reveal>` so it still fades in on scroll.
- The track is `<ul data-logo-marquee className="flex w-max items-center">`, holding the seven marks **four times**. Each `<li>` carries `shrink-0` and a **right margin**, not a flex `gap` - the same reason the gallery track uses margins: four passes must measure exactly four times one pass, and a flex `gap` does not apply across the seam between passes. Margin is `mr-9 md:mr-12`, matching the current `gap-x-9 md:gap-x-12`.
- Each `<Image>` keeps its current `width`/`height`/`className` exactly as they are today: `h-5 w-auto opacity-85 md:h-[22px]`.
- **Accessibility:** only the first pass is announced. Passes two through four render with `aria-hidden="true"` on the `<li>`, so a screen reader hears seven partners, not twenty-eight. The `<ul>` keeps its list semantics under the existing `aria-labelledby="partners-title"` section.
- Build the four passes from one `PARTNERS.flatMap` or a `[0,1,2,3].map` over the array, with a `key` of `` `${pass}-${p.src}` ``. Do not paste the list four times.
- `will-change: transform` on the track, per `gsap-performance`. Nothing else gets it.

The existing `flex-wrap items-center justify-center gap-x-9 gap-y-7` layout on the `<ul>` is gone; wrapping and centring are meaningless once the row is a track.

---

## Acceptance

1. The marks scroll right to left, continuously, at a steady ~60px/s, from the moment the section is on screen.
2. No seam, no jump, no gap in the content at any viewport width from 360px to 2560px. Watch one full 15s cycle at 1920px specifically - that is the width where a two-pass track would have failed.
3. The marks run to both screen edges, not to the container measure, and clip hard there. No fade mask.
4. The eyebrow does not move.
5. Under `prefers-reduced-motion: reduce`, the strip is static and legible: no tween exists, and the first pass is what is on screen.
6. A screen reader announces seven partner names, not twenty-eight.
7. `npm run lint` and `npm run build` are clean.
8. `design-system.md` no longer says "one marquee per page" anywhere.

## Test steps to hand back

```
npm run dev
```

Open `http://localhost:3000`, scroll to the partner row below the hero. Then:

- Resize the window across 1440px and 1920px and watch a full cycle at each for a seam.
- In Chrome DevTools, Rendering panel, `Emulate CSS prefers-reduced-motion: reduce`, reload, confirm the strip is static.
- Tab through the section with a screen reader, or inspect the DOM, and confirm three of the four passes are `aria-hidden`.
