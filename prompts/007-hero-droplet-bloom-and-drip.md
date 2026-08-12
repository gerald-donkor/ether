# 007 — Light the macaw's water beads, and let them run

The user asked for the hero photograph's droplets to be "glowy and drippy". The beads are baked into `macaw.jpg`, so nothing can animate them in place. Instead, a drawn layer sits over the photograph, anchored to where the real beads actually are: roughly a dozen of them gain a soft specular bloom that breathes, and every few seconds one swells, releases, and runs a short trail down before fading.

This extends `006`. The tile already drifts and magnifies; the bloom layer has to ride that motion in perfect register, or the lights slide off the beads they belong to.

## The registration problem, and the fix

The photograph is `object-cover` inside a card whose aspect ratio changes with the breakpoint, so a percentage-positioned overlay would drift off the beads. The layer is therefore an inline `<svg>` with `viewBox="0 0 1060 606"` — the image's own pixel space — and `preserveAspectRatio="xMidYMid slice"`, which crops **identically** to `object-cover` with the default centre `object-position`. Bead coordinates below are literal source pixels and land on the right beads at every viewport width.

The layer is `absolute inset-0 h-full w-full` on the card, so its box matches the `<img>` box exactly, and it must carry the **same transform as the photo on every frame**. Do this by giving the svg the `data-photo` attribute too, so `LivePhoto`'s existing selector picks up both elements and every tween (`pan`, `breathe`, the hover scale, both `quickTo` instances) drives them as one array. Do not write a second tween, do not mirror values by hand: one tween, two targets, no possibility of drift between them. `gsap.quickTo` accepts multiple targets, so no signature changes.

Both elements share the same box and the same default `50% 50%` transform origin, so identical transforms render identically. Verify this holds at the `sm` and `lg` crops before calling it done.

The svg is `aria-hidden`, `pointer-events-none`, and sits at `z.overlay - 1`... there is no such token, so it needs no `z-index` at all: it is a later sibling of the `<img>` and an earlier sibling of the caption, which stacks it correctly by DOM order. The caption must stay the last child of the card and stay above the bloom.

## The beads

Verified against the source by locating specular maxima and then checking each one visually. The eye's catchlight at `(561,164)` and the paint fleck on the beak at `(114,494)` are **not** beads and must not bloom. Neither may anything be added inside the eye.

Source-pixel centres, with a rough highlight radius:

```
crown scales    (370, 46) r 20   (250, 199) r 14
brow droplet    (722, 84) r 16
feather drops   (776, 323) r 12  (706, 282) r 7
leaf edge       (757, 377) r 9   (771, 425) r 7
leaf beads      (838, 545) r 7   (891, 557) r 6   (933, 537) r 6
                (946, 483) r 6   (954, 453) r 6
centre bead     (597, 398) r 8
```

Hoist this array to module scope per `vercel-react-best-practices` `rendering-hoist-jsx`. Nothing is random and nothing is generated at runtime: the set is fixed, so the tile looks the same on every load, exactly as `MarkSpiral`'s seeds are fixed.

Keep the far-right `(1019, 306)` and the very bottom `(938, 582)` out of it: they are the first pixels a tall crop discards.

## The look

**Neutral white only.** A water glint is white light, not brand colour. `#6c2fff` or the lime anywhere in this layer breaks §6's two-accent lock, and no bead may be tinted.

Each bead is a `<circle>` filled from one shared `<radialGradient>` — white at full stop, falling to fully transparent at the edge, with the mid stop pulled in so the falloff reads as a specular bloom rather than a flat disc. One gradient definition reused by every circle, not one per bead.

The layer carries `mix-blend-mode: screen` so the bloom **adds light to what is already there** instead of painting grey discs over the photograph. This is what makes it read as wet rather than as dots, and it also means the bloom is invisible over the image's bright regions and strongest over the dark ones, which is physically the right way round.

Resting opacity must stay low. Start around `0.35` and tune down rather than up: at full strength this reads as a lens defect. The brief here is "the beads look lit", not "the beads are lamps".

## The motion

Transforms and opacity only, per design-system.md 5.2. No `filter`, no `box-shadow`, no `r` animation on the circles — a bead that swells does it with `scale`, about its own centre (`transformOrigin` and `svgOrigin` on the circle's own coordinates, as `MarkSpiral` does about the composition centre).

**Breathing.** Each bead pulses opacity and scale on a slow yoyo, 4s to 7s, and every bead gets its own duration and its own negative start offset so the set never blinks in unison. Derive both from the bead's index deterministically, never from `Math.random`.

**The drip.** One long repeating timeline picks beads in a fixed rotation, several seconds apart, and for each: swell the bead briefly, then run a drop from it. The drop is a small teardrop `<path>` or a second circle that starts at the bead and translates down 40 to 90 source units on `power2.in`, so it accelerates as a falling thing does, fading to zero over the last third. It never leaves the viewBox and never reaches the caption.

Only one or two drips may be in flight at once. The tile is beside the page's headline; a constant rain of them turns the hero into a screensaver.

Reuse a small pool of drop elements rendered once in the markup and re-targeted, rather than creating and destroying SVG nodes on a timeline. No DOM churn on a loop.

**Interaction with the hover magnify.** The bloom layer is scaled by the same tween as the photo, so the beads magnify with the picture, which is correct. The breathing and the drip timeline are independent of hover: they do **not** pause on `pointerenter`, because a bead that freezes mid-drip while the frame magnifies is a bug the eye catches immediately. Confirm the drip timeline is not caught by the existing `overwrite: "auto"` on the hover scale tween — those tweens target `[data-photo]` and the drips target their own elements, so there should be no conflict, but check rather than assume.

**Reduced motion.** Under `(prefers-reduced-motion: reduce)`: no breathing, no drips, no timeline. The bloom layer still renders, held statically at its resting opacity, because the glow is a look and not a motion. Nothing in the layer moves and no drop element is ever visible.

## Files

- `components/motion/DropletBloom.tsx` — new client component holding the bead array, the svg markup and the timelines. Same shape as its neighbours: `"use client"`, `gsap` + `useGSAP`, `gsap.registerPlugin(useGSAP)`, a `scope` ref, one `gsap.matchMedia()`, house-voice header comment closing with `See design-system.md 5.2.`
- `components/motion/LivePhoto.tsx` — no change if the svg carries `data-photo` and the existing selector already returns both nodes. If the selector currently grabs only the first match, widen it to `querySelectorAll` and pass the array. That is the only change permitted in this file.
- `components/sections/Hero.tsx` — renders `<DropletBloom />` inside `LivePhoto`, after the `<Image>`. The caption stays where it is, as the card's last child.
- No CSS changes. The bloom layer shares the photo's transform and therefore its existing `will-change`; do not add a second `will-change`, and do not put one on the individual circles.

## Constraints

- The macaw keeps `priority` and stays the only priority image. The layer is inline SVG: no new network request, no new image, nothing that delays the photo's paint.
- No `window.addEventListener("scroll")`, no ScrollTrigger, no `useState` for continuous values.
- Zero em-dashes in any visible string. Nothing here adds visible copy.
- The `AI Generator` caption must keep clearing 4.5:1. No bead in the list sits in the caption's corner and no drip may travel into it, so this should hold by construction. Re-check it rather than assuming, since `screen` blending only ever brightens.
- Bead count stays in the low teens. Every additional bloom costs a composited element on the page's LCP tile.

## Documentation

- Add a `§5.1` deviation row: `§9.A, no neon or outer glows` against this layer. The reason is that the user asked for it explicitly, pointing at the photograph's water beads; it is light drawn onto beads that are already in the reference image rather than decoration invented to make the page feel designed; it is neutral white so the two-accent lock is untouched; and like the arc it is capped, resting near `0.35` rather than glowing at full strength. Name it as the **second** earned exception to §9.A and say so, so the count is visible.
- Extend the `§3` hero photo row, or add one beneath it, covering the bloom and the drip with the reason.
- Add the bloom and the drips to the `§3` reduced-motion sentence, noting the static bloom is what remains.

## Verify

- `npm run lint` and `npm run build`.
- Dev server: every bloom sits on an actual bead at `sm`, `md` and `lg` widths. Resize slowly through the breakpoints and watch for any bloom sliding off its bead, which would mean the `slice` crop and `object-cover` have diverged.
- Hover and move the cursor: the blooms magnify and track with the photograph, locked to their beads, with no lag between the layer and the image.
- Watch for a minute: drips are occasional, never more than two at once, always fall downward, always fade before the frame edge.
- `prefers-reduced-motion: reduce`: a static bloom, nothing breathing, no drop ever visible.
