# 006 — Put the hero macaw tile in motion, and magnify it on hover

The circled tile in the reference screenshot is the hero's macaw image (`components/sections/Hero.tsx`, the `lg:col-span-5 lg:row-span-2` cell). It is the page's anchor visual and the largest thing in the hero, and it is currently completely still while the brand block beside it simulates, the logo wall marquees and the gallery drifts. Give it two things:

1. **Ambient motion** — a continuous slow drift so the frame reads as alive rather than as a placed JPEG.
2. **Hover magnify** — a pointer-tracked zoom into the photograph, so the tile answers the cursor.

## New component

`components/motion/LivePhoto.tsx`, a client component in the same shape as `MarkSpiral` and `ColumnDrift`: `"use client"`, `gsap` + `useGSAP` from `@gsap/react`, `gsap.registerPlugin(useGSAP)`, a `scope` ref, one `gsap.matchMedia()`, and a header comment in the house voice explaining the model and closing with `See design-system.md 5.2.`

It wraps the existing `next/image` in `Hero.tsx`:

```tsx
<LivePhoto>
  <Image … data-photo />
</LivePhoto>
```

The wrapper element must not disturb the tile's layout — the card is `relative overflow-hidden` with the image at `h-full w-full object-cover`, so the wrapper needs to fill the card the same way (`absolute inset-0`, or a block wrapper that keeps `h-full w-full`), and the `AI Generator` caption must stay a child of the *card*, not of the wrapper, so it never moves, scales or clips with the photo. The caption stays exactly where and how it renders today.

Only `LivePhoto.tsx` is new. `Hero.tsx` changes only by importing it, wrapping the image, and adding whatever data attribute the wrapper targets. No other section is touched.

## The model

Everything animated is `scale`, `xPercent`/`yPercent` and nothing else — transforms only, per design-system.md 5.2. No `width`, `height`, `top`, `left`, no `filter`, no `object-position`.

**Base overscale.** The photo sits at a resting scale slightly above 1 (start at `1.08`) so there is slack on every edge for the drift to travel into. This is the containment guarantee: at scale `s` the slack per side is `(s - 1) / 2` of the element, so at `1.08` the budget is 4% each way. Keep the drift amplitude inside that budget with margin (start at ±2.5% on each axis) so a bare card edge can never appear on any frame, at any aspect ratio the responsive grid produces.

**Ambient drift.** One long yoyo-repeat timeline moving the photo diagonally across its own slack — start at 22s per pass, `sine.inOut`, so the motion has no visible start or stop and never draws attention away from the headline. Pair the pan with a small breathing scale (e.g. `1.08 → 1.11`) on a different duration so the two never sync into an obvious loop. Two tweens on one element, not a per-frame ticker: this is a keyframed loop, unlike the brand block's simulation.

**Hover magnify.** On `pointerenter` on the card, tween the photo to a magnified scale (start at `1.18`) over ~600ms `power3.out`, and track the pointer: map the cursor's position within the card to a small counter-offset (start at ±4%, and check it against the slack the magnified scale buys) so moving the cursor moves the frame *into* the photograph — the eye and the water beads are what the magnify should be able to reach. Drive the offset with `gsap.quickTo` (per `gsap-performance`), not a new tween per `pointermove`, and never with React state — design-system.md 5.2 forbids `useState` for continuous values.

The ambient drift and the magnify must not fight. Pause the drift timeline on enter and resume it on leave, and on leave tween the photo back to the drift's own resting values so there is no jump when the loop takes over again. Prefer `overwrite: "auto"` on the hover tweens.

**Touch and keyboard.** Pointer tracking is a hover affordance; the tile is not a link and gains no new interactive role, so do not add `tabIndex` or a focus handler. Guard the magnify so it only arms for a device that actually hovers (`(hover: hover)` in the `matchMedia` query, or `event.pointerType`), and make sure a tap on a touch device leaves nothing stuck magnified.

**Reduced motion.** Two branches on the one `gsap.matchMedia`:

- `(prefers-reduced-motion: no-preference) and (hover: hover)` — the drift and the pointer-tracked magnify, as above.
- `(prefers-reduced-motion: reduce)` — no drift, no loop, no pointer listeners, no `quickTo`. The photo renders at scale 1, exactly as the static artboard. A hover may do at most the documented tile response (`scale(1.02)`, 200ms) and nothing else.

Both branches must clean up: listeners removed and tweens reverted through the `useGSAP` context / `mm.revert()`, as `MarkSpiral` and `ColumnDrift` already do.

## Constraints

- The macaw keeps `priority` and stays the page's only priority image. Adding motion must not cost LCP: no new network work, no blur-up, no second copy of the image, and the wrapper must not delay the image's paint.
- Add `will-change: transform` for the photo inside the existing `@media (prefers-reduced-motion: no-preference)` block in `app/globals.css` — per `gsap-performance`, on this element because it actually animates, and nowhere else.
- No `window.addEventListener("scroll")`, no ScrollTrigger — this is not a scroll effect.
- Zero em-dashes in any visible string; nothing here adds visible copy anyway.
- The caption's contrast over the photograph must still hold once the frame drifts and magnifies. The overlay label is already a documented §5.1 deviation; check the brightest region the drift can bring under it and keep the label legible (its existing weight and position, with the overlay `z` from `lib/z.ts`, should be enough — verify, do not assume).

## Documentation

- Add a row to the §3 motion table for the hero photo: the drift and the hover magnify, with the reason.
- Note in §5.1 that this tile's hover exceeds the table's `scale(1.02)` tile response, and why: the user asked for a magnify on the hero image specifically, the photograph is the one element on the page with detail worth magnifying into, and the tile itself still does not scale — only the photograph inside its fixed frame does, so the grid never moves.
- Extend the reduced-motion sentence in §3 so the hero photo drift is named alongside the arc, the drift, the marquee, the brand block and the reveals.

## Verify

- `npm run lint` and `npm run build`.
- Dev server, watch the hero tile for ~40 seconds: continuous, unhurried motion with no visible loop seam, and no card edge or letterbox ever showing at any viewport width (check the `sm` single-column layout too, where the tile's aspect ratio is very different).
- Hover and move across the tile: the photo magnifies smoothly and the frame follows the cursor without lag or jitter; leaving returns it to the ambient drift with no jump. The caption does not move.
- `prefers-reduced-motion: reduce`: the photo is static at scale 1 and the tile renders as the artboard.
