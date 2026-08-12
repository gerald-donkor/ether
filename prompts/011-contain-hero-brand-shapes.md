# 011 - Keep the hero brand shapes inside their frame

Correct the existing collision simulation in
`components/motion/MarkSpiral.tsx` so all four polygons remain fully visible
inside the violet hero tile for the entire animation. This is next because the
user supplied a direct regression recording showing the signature hero mark
being clipped and disappearing outside its frame. It is a focused repair to
finished landing-page motion, not a new build-sequence feature.

## Design read

Read this as a preservation fix to Ether's finished dark studio-console landing
page. Keep the established high-motion brand flourish and its collision
character, while making the frame behave as a real containing boundary.

Design dials remain those of the existing page: `DESIGN_VARIANCE: 9`,
`MOTION_INTENSITY: 8`, `VISUAL_DENSITY: 4`. This prompt does not redesign or
recalibrate them.

## Reference material read

- User recording:
  `/home/gdk26/Videos/Screencasts/Screencast_20260812_212156.webm`, 456 x 216,
  63.758 seconds. It shows individual shapes becoming partially clipped at the
  violet tile edges and spending intervals outside the visible frame.
- `AGENTS.md`, especially the landing-page stability, motion, prompt, checking,
  and documentation contracts.
- `design-system.md` sections 1.1, 1.4, 1.5, 2.3, 3, 5.2, 5.3, and 6.
- `components/motion/MarkSpiral.tsx`, the current deterministic rigid-body
  simulation and its wall/collision order.
- `components/brand/Mark.tsx`, including the fixed `921 536 426 221` viewBox,
  extracted paths, and nested transform wrappers.
- `components/sections/Hero.tsx`, including the fixed `overflow-hidden` brand
  tile and current mark sizing.
- `prompts/004-brand-mark-spiral-orbit.md` and
  `prompts/005-brand-mark-collision-physics.md`, which establish the original
  containment intent and the present collision model.
- Next.js 16.3 local documentation at
  `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`.

## Root cause to fix

The present wall calculation does not guarantee visual containment:

1. `Body.r` is a deliberately permissive collision radius, calculated as
   `0.44 * min(width, height)`. It is useful for natural-looking contacts but is
   smaller than the farthest visible point of several polygons, especially as
   they rotate. Reusing it as the wall inset lets visible geometry cross the
   viewBox boundary before the body's collision circle reaches the wall.
2. Wall resolution runs before pair separation. A shape can be clamped inside,
   then pushed outside again by a later body-body overlap correction and be
   rendered there for that frame.
3. The whole group swings by 1.2 degrees. Any containment calculation must cover
   that outer transform as well as each body's own continuous rotation.

Do not treat `overflow-hidden` as the fix. It already clips the tile and is what
makes the bad simulation visible. The simulation itself must keep the complete
geometry in coverage.

## Implementation requirements

### Separate contact geometry from containment geometry

- Preserve the existing permissive contact radius for body-body collision feel.
- Add a distinct visual containment extent for each body, derived from its
  untransformed `getBBox()` before any writes. It must conservatively cover the
  full shape at every body rotation. A circle centered on the body's resting
  centre with radius equal to the farthest bounding-box corner is an acceptable
  implementation because rotation cannot enlarge that radius.
- Account for the maximum 1.2 degree group swing when deriving the safe local
  room. The guarantee applies after both the body's transform and the group
  transform are composed.
- Keep the SVG viewBox, path data, tile dimensions, padding, radius, colors, and
  mark's reduced-motion resting scale unchanged.

### Make containment the final authority on every frame

- Integrate movement and resolve pair collisions as now, then perform a final
  containment pass before `gsap.set` writes the body's transform.
- Clamp a body's centre against the safe room using its visual containment
  extent, and reflect only a velocity component that is travelling farther out
  through the contacted wall. Avoid repeated sign flips for a body already
  moving inward.
- If overlap separation places a body outside, the final pass must bring it
  inside on that same frame. No rendered frame may contain an out-of-bounds
  shape.
- Preserve deterministic seeds, mass-weighted collision response, speed band,
  angular motion, impact squash, DOM-order restacking, frame delta cap, and the
  general liveliness shown by the current implementation.
- Keep all per-frame visual writes transform-only. Do not animate or write
  `width`, `height`, `top`, or `left`.
- Keep the current client-leaf architecture: module-scope GSAP registration,
  `useGSAP` with a scope, named reduced-motion handling through
  `gsap.matchMedia`, ticker removal, flourish cleanup, and `mm.revert()`.
  `prefers-reduced-motion: reduce` must create no tween and no ticker.

### Documentation

- Correct the `MarkSpiral.tsx` header and nearby comments so they describe the
  separate contact and visual containment bounds and the final containment
  pass.
- Amend the Hero brand block row in `design-system.md` section 3 to record that
  every body uses a rotation-safe visual extent and is contained after collision
  resolution. This records the repaired behavior in the file that owns motion.
- Do not add a new motion row. This changes the correctness of an existing
  animation and does not introduce a new animation.

## Measurements and acceptance procedure

- The fixed SVG coordinate frame remains exactly `x=921`, `y=536`, `w=426`,
  `h=221`; do not eyeball or replace it.
- The group scale remains `0.72` and group swing remains 1.2 degrees unless a
  mathematically demonstrated conflict makes a smaller swing necessary. Prefer
  correcting the safe-room math over altering the established motion.
- Derive every body's contact and containment extents from its actual SVG
  `getBBox()` at runtime. Do not add hand-measured per-shape pixel constants.
- Run the page at desktop and narrow/mobile widths. Observe the hero mark for at
  least the full 63.758-second duration of the supplied recording at each size.
  Every visible point of the bolt, triangle, asterisk, and dot must stay within
  all four edges of the violet rounded tile on every frame. No shape may vanish,
  be cut into a sliver, or remain pinned against an edge.
- Confirm repeated body-to-body collisions still occur and all four bodies keep
  moving. Containment must not collapse the composition into a static cluster.
- Enable `prefers-reduced-motion: reduce`, reload, and confirm the untouched,
  full-size interlocking mark matches its present static render with no ticker
  or tween.

## Expected impact

- `/`: animated behavior changes only inside the existing violet hero brand
  tile. Its server-rendered markup, static first paint, layout, copy, colors,
  imagery, and every other section must remain identical.
- `/generate`, `/account`, `/sign-in`, `/sign-up`, and any other route: no
  output or render-mode change.
- No route's static/dynamic render classification changes.

## Non-goals

- No redesign of the hero, grid, brand artwork, or motion language.
- No change to animation speed, collision aggression, model seeds, colors,
  typography, copy, spacing, tile sizing, or responsive layout unless required
  solely to satisfy the containment guarantee. The containment math is the
  intended repair surface.
- No changes to the photo, droplets, gallery, logo wall, stats, nav, footer,
  application routes, backend, dependencies, or configuration.
- No new animation, marquee, asset, icon, test framework, or package.

## File contract

Create:

- `prompts/011-contain-hero-brand-shapes.md`

Modify during implementation:

- `components/motion/MarkSpiral.tsx`
- `design-system.md`

Do not modify:

- `components/brand/Mark.tsx`
- `components/sections/Hero.tsx`
- `app/globals.css`
- any asset under `public/`
- any backend, route, configuration, dependency, or lock file
- the existing untracked `prompts/010-four-nav-routes.md`, which is separate
  user work and must be preserved exactly

Delete: none.

## Checks

Run and report exact output from:

1. `npm run lint`
2. The environment-absent production build required by `AGENTS.md`: temporarily
   move `.env.local` to `.env.local.bak` if it exists, run `npm run build`, and
   restore it even if the build fails.
3. Run `npm run dev` and execute the visual acceptance procedure above at
   desktop and narrow/mobile widths, with both normal and reduced motion.
4. Compare the production build route table with the pre-change route table and
   confirm no render classification changed.
5. Inspect the final diff and confirm only this prompt, `MarkSpiral.tsx`, and
   `design-system.md` changed for this task. Do not include
   `prompts/010-four-nav-routes.md` in the commit.

Record the implemented containment behavior and verification result in
`design-system.md` section 3. Commit the completed prompt to `main` without
pushing.

## SKILLS USED

- `design-taste-frontend` - preserve the established redesign language and run
  its visual pre-flight checks without expanding the repair into a redesign.
- `frontend-design` - keep the signature hero composition and brand artwork
  intentional while correcting its visible framing defect.
- `gsap-core` - verify transform writes, SVG origins, tween behavior, and named
  reduced-motion handling.
- `gsap-react` - preserve the scoped `useGSAP` client-leaf architecture and
  cleanup behavior.
- `gsap-performance` - keep ticker work bounded, transform-only, and free of
  avoidable layout thrashing.
- `gsap-utils` - use verified clamp and collection helpers in the simulation.
- `gsap-timeline` - preserve and correctly clean up the collision flourish's
  squash-and-spring sequence.
- `vercel-react-best-practices` - retain the narrow client boundary and avoid
  introducing React renders into continuous animation state.

No installed `nextjs` or `tailwind-4-docs` skill is available in this session.
The relevant Next.js 16.3 client/server composition API was verified from the
project's local `node_modules/next/dist/docs/`; no Tailwind or CSS change is in
scope.
