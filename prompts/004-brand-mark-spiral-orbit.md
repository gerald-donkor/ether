# 004 - Brand mark spiral orbit

Animate the four shapes inside the hero's violet brand block so they orbit,
bounce over one another, and drift on a slow spiral.

## Target

`components/sections/Hero.tsx:88-93` - the violet tile carrying `Mark`
(`components/brand/Mark.tsx`). Its four paths are the animation subjects:

| Shape | Fill | Role in the loop |
|---|---|---|
| Bolt | `#040c1f` | Largest, slowest orbit, anchors the composition |
| Triangle | `#fff` | Counter-orbits the bolt so the two cross twice per cycle |
| Asterisk | `#d2ff3a` | Fastest orbit, widest radius, does most of the crossing |
| Dot | `#6843ec` | Smallest, tightest orbit, reads as the satellite |

Nothing else in the hero changes. No other tile gains motion.

## Behaviour

One continuous ambient loop, no trigger, no scroll dependency:

1. **Orbit.** Each shape travels a closed loop around the block's centre on its
   own radius, direction and phase, so the four are never in step and the
   crossings land at different moments.
2. **Bounce.** The orbit is stepped, not smooth: each shape hops between
   waypoints on its ring with `back.inOut`, so arriving at a station reads as a
   small overshoot and settle rather than a glide.
3. **Bump.** *(Amended mid-execution: the user asked for the shapes to bump
   into each other "like in a bouncy castle", which the easing above does not
   give on its own.)* A ticker watches all six pairs. When two shapes close on
   each other they shove apart along the line between their centres, squash,
   and spring back on `elastic.out`. Contact is centre distance against a
   fraction of the pair's resting distance, not bounds overlap: the four shapes
   interlock where they are drawn, so there is no rest state to detect overlap
   from. A pair fires once on closing and re-arms only after opening again.
4. **Spiral.** The whole set rotates slowly about the block centre in the
   opposite direction to the fastest orbit, and each shape's radius breathes
   between a tight and a wide value across the cycle. Orbit plus a drifting
   centre plus a breathing radius is what makes the path read as a spiral
   instead of a carousel.
5. **Passing over.** SVG has no `z-index`; stacking is DOM order. As each shape
   reaches its crossing waypoint, re-append it to its parent so it passes *over*
   the shapes it meets. Order therefore changes across the cycle and no single
   shape is permanently on top.
6. **Self rotation and scale.** Each shape rotates about its own centre and
   pulses scale slightly (no more than `1.08`) in sympathy with its radius, so
   the near pass reads as nearer.

Cycle length ~14s, slow enough to be ambient. `prefers-reduced-motion: reduce`
creates no tween at all: the mark renders exactly as it does today.

## Implementation

### `components/brand/Mark.tsx`

- Wrap each of the four paths in a `<g data-mark-shape="bolt|triangle|asterisk|dot">`.
  The wrapper is what gets transformed, so the path data stays untouched and the
  motion layer never has to know the drawing.
- Widen the `viewBox` so the orbit amplitude has room and no shape is clipped by
  the tile's `overflow-hidden`. Current box is `945 548 378 197`; expand it
  symmetrically by the maximum orbit radius plus the scale headroom, and raise
  the `w-[70%]` in `Hero.tsx` so the mark's rendered size stays as it is now.
  Verify against the reference: the mark must look unchanged when the animation
  is paused at t=0.
- Round any new coordinates to one decimal place (`rendering-svg-precision`).
- The component stays a server component. It gains no `"use client"`.

### `components/motion/MarkSpiral.tsx` (new)

A client component in the shape of the two motion components already here
(`ColumnDrift`, `LogoMarquee`): `"use client"`, `gsap.registerPlugin(useGSAP)`,
`useGSAP` with a `scope` ref, `gsap.matchMedia` for reduced motion, returning
`() => mm.revert()`.

- Takes `children` and renders them inside the scoped wrapper, so `Hero.tsx`
  composes `<MarkSpiral><Mark …/></MarkSpiral>` and `Mark` stays presentational.
- Read the four shapes with `gsap.utils.toArray<SVGGElement>("[data-mark-shape]")`
  inside the scope. Per-shape radius, direction, duration and phase come from a
  hoisted module-scope config keyed by the `data-mark-shape` value, never from
  the array index (same rule `ColumnDrift` follows).
- Build one timeline per shape with `keyframes` for `x`/`y` around its ring,
  `ease: "back.inOut(1.5)"` on the keyframe block, plus `rotation` and `scale`
  tweens, `repeat: -1`, and a `delay`/`progress` offset for phase. Use
  `gsap.utils.mapRange` / `gsap.utils.wrap` for the ring maths rather than
  hand-written trig constants where it reads more clearly.
- Set `transformOrigin: "50% 50%"` on each `<g>` so self-rotation pivots on the
  shape, and drive the group's spiral drift on the wrapper `<g>` or the svg
  itself with `svgOrigin` at the composition centre.
- Restack with a `call` at each crossing waypoint: `el.parentNode.appendChild(el)`.
  It touches no layout and is the only DOM mutation in the file.
- No `useState`, no `useEffect`, no scroll listener, no `window` event listener.
- Animate transform properties only. No `width`, `height`, `top`, `left`,
  no `attr` tweens on path data.

### `design-system.md`

- Add a §3 motion row: hero brand block, four marks on a stepped ~14s spiral
  orbit, reason: the block is the page's one purely decorative tile and the only
  place the brand mark exists at size, so it is where a brand flourish belongs.
- Add a §5.1 deviation row recording that the user asked for this explicitly and
  that it is **not** a third marquee region: no strip of repeating content
  translates, so the "two marquee regions" rule in §5.2 stands unchanged and is
  not being silently bent. Note the same §3 line disables it under reduced
  motion, matching the arc, drift, marquee and reveals.

## Checks

- `npm run lint` and `npx tsc --noEmit` clean.
- `npm run build` succeeds.
- Reduced motion on: the mark is static and identical to today's render.
- No shape leaves the violet tile at any point in the cycle.
- Nothing about the other four hero tiles moves.

## Test steps

1. `npm run dev`, open `http://localhost:3000`.
2. Watch the violet brand block in the hero's top right. The four shapes should
   orbit, hop with a slight overshoot, pass over one another with the stacking
   changing, and drift on a slow spiral over roughly 14s.
3. Enable `prefers-reduced-motion: reduce` (DevTools rendering panel) and reload.
   The mark should be completely still.
