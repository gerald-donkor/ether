# 005 — Bounce the hero brand marks off each other for real

Replace the spiral-orbit motion in `components/motion/MarkSpiral.tsx` with a small
deterministic physics simulation, so the four brand marks genuinely travel across
the tile, touch, and bounce off one another aggressively.

## Why the current version does not work

Verified against `components/motion/MarkSpiral.tsx`, `components/brand/Mark.tsx`
and a screen recording of the running page:

1. **The orbits are too small to reach anything.** The viewBox is 426 × 221 user
   units. The orbit amplitudes are `ax: 7–12`, `ay: 1.5–3` — 2–3% of the frame.
   On screen the four shapes read as static with a faint jitter.
2. **Four of the six pairs can never fire.** `contact` is the pair's resting
   distance × `CONTACT` (0.94), so a pair must close by 6% of how far apart it
   rests. Resting distances: bolt–triangle ≈ 67, asterisk–dot ≈ 99,
   triangle–dot ≈ 138, bolt–asterisk ≈ 216, bolt–dot ≈ 205, triangle–asterisk
   ≈ 165. With orbits this small, only the two adjacent pairs are candidates at
   all, and the phase offsets mean even those rarely trip.
3. **Contact ignores shape size.** Centre distance against a fraction of resting
   distance does not correspond to the shapes' edges meeting, so even a firing
   contact does not read as a touch.

Raising the amplitudes alone cannot fix this: the four paths are drawn
interlocking and fill the viewBox, so there is no free space to travel through
and no rest state where their bounds are apart.

## The model

Drop the ring/keyframe orbit, the `Orbit` amplitudes, `STATIONS`, `BREATHS`,
`TIGHT`, `CONTACT`, `RELEASE`, and the fraction-of-resting-distance contact test.
Keep the group swing, the reduced-motion guard, the two-wrapper structure, and
the DOM-order restacking idea.

Each shape becomes a body with a position, a velocity and a radius, integrated on
`gsap.ticker` and written to `[data-mark-shape]` with `gsap.set` (`x`/`y`/
`rotation` only — transforms, no layout).

- **Room to move.** The drawing has no slack, so scale `[data-mark-group]` down
  about `CENTRE` (start at `0.72`) when motion runs. This is set only inside the
  `(prefers-reduced-motion: no-preference)` branch, so the reduced-motion render
  stays exactly as `Mark` draws it.
- **Radius.** Read each shape's untransformed `getBBox()` once (as today) for its
  resting centre, and take its collision radius as a fraction of its bounding
  box — start at `0.44 * min(width, height)` clamped to a sensible floor, so the
  asterisk's arms are allowed to pass through a neighbour's corner while the
  bodies still bounce. Tune so contacts look like touches, not near-misses.
- **Walls.** Bounce off the viewBox inset by each body's radius, so no shape ever
  crosses the tile edge. This replaces the amplitude budget as the containment
  guarantee.
- **Pair collisions.** Six pairs, checked every tick. On overlap: separate the two
  along the line between centres so they are exactly touching (no sinking), then
  exchange velocity along that normal with a restitution above 1 (start at `1.06`)
  so the set stays lively rather than damping to a stop. Give each body a mass
  from its area so the dot is thrown hard and the bolt barely yields — that is the
  composition note from prompt 004, now expressed as mass instead of `push`.
- **Speed floor and ceiling.** Clamp each body's speed into a band (start at
  roughly 14–34 units/sec) after every resolve, so the restitution above 1 cannot
  run away and nothing can stall in a corner.
- **Frame-rate independence.** Integrate against `deltaTime` from the ticker,
  clamped (e.g. to 1/30 s) so a background tab returning does not teleport bodies
  through each other.
- **Impact read.** Keep the squash-and-spring on `[data-mark-bump]`: on a
  collision, fire the existing `recoil`-style tween on the inner wrapper — a fast
  compress along the normal, then `elastic.out` back. Since the outer wrapper now
  carries the physics position, the inner wrapper is purely the flourish. Because
  the bodies now genuinely separate after a hit, the contact/release re-arming
  state on `Pair` is no longer needed.
- **Rotation.** Give each body a small angular velocity, nudged on impact, so a
  hit is legible even when the bounce is head-on.

Seed positions from each shape's resting centre and velocities from fixed
per-shape constants (not `Math.random`), so the animation is deterministic and
the same on every load.

## Constraints

- `Mark.tsx` stays a server component; its path data and `viewBox` are unchanged.
  Only `MarkSpiral` changes. If a wider viewBox turns out to be needed instead of
  the group scale, prefer the group scale — the tile framing at rest must not
  shift.
- Transforms only. No layout-affecting properties, no per-frame DOM writes beyond
  `gsap.set` and the existing restacking.
- `gsap.matchMedia` must still create no tween and no ticker under
  `prefers-reduced-motion: reduce`, and the ticker must be removed on cleanup as
  it is today.
- Rewrite the file's header comment to describe the physics model. The current
  comment explains the ring/waypoint scheme in detail and would otherwise be
  actively wrong.
- Update `design-system.md` 5.2 where it describes the mark's motion.

## Verify

- `npm run lint` and `npm run build`.
- Run the dev server and watch the hero block for ~30 seconds: all four shapes
  should traverse the tile, make repeated visible contact, and rebound sharply.
  No shape should leave the tile, sink into another, or come to rest.
- Toggle `prefers-reduced-motion: reduce` and confirm the mark renders exactly as
  the static artboard, at full size.
