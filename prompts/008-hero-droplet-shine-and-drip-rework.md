# 008 — Make the macaw's beads read as wet: specular cores, travelling glints, real drips

`007` shipped a bloom layer that is, on the running page, invisible. The user's screenshot and screencast show a photograph that drifts and a droplet layer that does nothing the eye can find. The brief is unchanged and now explicit: **with no cursor anywhere near the tile, the beads must look shiny, dripping and droppy.** This prompt reworks `components/motion/DropletBloom.tsx` so that it does.

Nothing about the registration approach changes. The svg stays in the image's own pixel space with `xMidYMid slice`, stays `data-photo`, and stays driven by `LivePhoto`'s single set of tweens. That part of `007` is correct and must not be touched.

## Why the current layer is invisible

Diagnose before rewriting, and keep these four causes in mind — every decision below answers one of them.

1. **Big and faint loses to a bright photograph.** Every bead is one soft radial gradient, white, resting at `0.35`, on `mix-blend-mode: screen`. Screen only ever brightens, and the real beads sit on bright green leaf and bright blue feather, where adding 35% white to an already near-white pixel changes almost nothing. The layer is strongest exactly where there are no beads.
2. **A soft gradient has no edge, so its motion cannot be seen.** Scaling a shape with no hard boundary from `0.94` to `1.08` over five seconds is a change nothing in the frame registers. The breath is running; it is simply unwatchable.
3. **The drips are too rare and too small.** Eight drops in a fifty second loop, `r: 5`, `opacity: 0.5`, soft-edged, white on screen over a lit leaf. For most of any given ten seconds the layer is doing nothing at all, and when it does something it cannot be seen.
4. **Nothing in the layer says "water".** A glow says "lamp". What reads as a bead of water is a **hard specular pinpoint** plus a **bright crescent** where light refracts through the far wall of the drop, plus the fact that both **travel** as the light source and the drop move.

The governing principle for the rewrite: **small and bright beats large and faint.** A pinpoint of near-opaque white two or three source pixels across survives `screen` over the brightest leaf; a twenty pixel wash at `0.35` does not.

## Verify the bead coordinates before drawing anything

`007`'s thirteen coordinates were eyeballed and several look off in the running page. Redo this properly, as the first implementation step:

- Write a throwaway script in the scratchpad that loads `public/assets/ui/img/macaw.jpg`, converts to luminance, and reports local maxima: pixels brighter than their surroundings by a clear margin, clustered, with the cluster centroid and rough radius. Sharp specular hits on water beads are the brightest small features in the frame.
- Filter the result **by eye against the photograph**. Keep beads. Discard: the eye's catchlight near `(561,164)`, the paint fleck on the beak near `(114,494)`, the yellow beak's broad sheen, and the white paint speckles on the dark lower beak, which are pigment and not water.
- Nothing may be drawn inside the eye. Ever.
- The card's crop is centre-anchored `slice`. At the narrowest card the visible source band is roughly `x ∈ [110, 950]`; keep every bead inside it, so nothing pops in and out across breakpoints.
- The `AI Generator` caption occupies the bottom-left corner. No bead there, no drip that travels into it.

Land on roughly **eighteen to twenty-four beads** — the photograph has that many good ones on the leaf and the right-hand feathers, and the current thirteen make the wetness look spotty. The array stays hoisted at module scope, fixed, never generated, never random, exactly as now.

Each entry carries its centre, its halo radius, and the **direction of its specular hit** (a unit-ish offset, or an angle) read off the source, because the highlight in the photo is not centred on the bead and the drawn core must sit where the real one does. Beads on the leaf catch light from the upper left; check rather than assume, and let the array record what the image actually shows.

## What each bead is made of

Three drawn parts per bead, all white, all on the one `screen` layer, all fed by shared `<defs>` — one halo gradient and one core gradient reused by every bead, never one definition per bead.

1. **Halo.** The existing soft radial gradient, kept, but pushed **down** to roughly `0.18` resting. It is now atmosphere around the shine, not the shine itself.
2. **Core.** A small circle, radius roughly `0.22` of the bead radius and never below about `1.6` source units, filled with a gradient that is opaque white to about the 45% stop before falling away. Resting opacity `0.85` to `1.0`. This is the part that reads as wet on a bright leaf, and it is the part whose movement the eye can actually track.
3. **Crescent.** A thin arc — a stroked `<path>` or a stroked circle with a `stroke-dasharray` cut so only an arc shows — on the **opposite** side of the bead from the core, at roughly `0.7` of the bead radius, `opacity` around `0.3`, `stroke-width` around `1.2` source units, `fill: none`, `stroke-linecap: round`. This is the refracted rim light, and it is the single cheapest mark that makes a circle read as a glass bead rather than a dot.

Keep them in one `<g>` per bead so the drip swell can scale the whole bead about its own centre, as it does now.

## The motion, with no pointer on the page

Everything below runs on load and never stops. `LivePhoto`'s drift and hover magnify carry the whole layer; nothing here pauses on hover, for the same reason `007` gives.

**Travelling glint.** The core does not just pulse, it **moves**: a small, slow elliptical wander of one to two source units around its resting offset, on `x`/`y`, four to nine seconds a lap, each bead with its own duration and its own phase derived deterministically from its index. This is what sells glass. Pair it with an opacity flicker between roughly `0.7` and `1.0` on a **different** duration from the wander, so no bead settles into a countable rhythm. The crescent breathes on a third duration, between roughly `0.18` and `0.38`, and the halo on a fourth, shallowly. Four independent cycles per bead over a two dozen bead set is what makes the tile look wet rather than animated.

Derive every duration and phase from the index — `gsap.utils.wrap`, `mapRange` and modular arithmetic, per the `gsap-utils` skill. `Math.random` appears nowhere; the tile must look the same on every load, like `MarkSpiral`'s fixed seeds.

Use one tween per property group per bead and set the initial phase with `.progress()` as the current file does, or drive the set with a stagger where the animation is genuinely identical. Prefer `stagger` over many hand-delayed tweens where it applies, per `gsap-performance`.

**Slow creep.** Three or four of the larger beads slide **downward** by two to five source units over fifteen to twenty five seconds, pause, and reset invisibly — a real bead on a leaf loses its grip and settles. Yoyo is wrong here; water does not travel back up. Reset by fading the creep out at the bottom of its travel or by returning it during a moment the bead is dimmest, so the snap is never seen. Keep this on `y` on the bead group.

**The drips, reworked.** This is the "dripping and droppy" half of the brief and it currently reads as nothing.

- **Cadence.** A drip starts every `1.6` to `2.6` seconds, not every `5.5`. Fixed offsets from a rotation, not random. At any instant one to three drops are in flight, so the tile always has something falling. That is the point of the brief; the `007` note about not making a screensaver stands only as a cap on the upper end, and three concurrent drops on a twenty bead tile is nowhere near rain.
- **Pool.** Raise the reused drop pool to **four** elements, still rendered once in markup and re-targeted. No SVG node is created or destroyed on a loop.
- **Shape.** A drop is a teardrop `<path>` authored pointing down at the origin, not a circle: a rounded belly with a drawn-out top. Give it the core's brightness on its belly, not the halo's faintness — a falling drop that cannot be seen is not a drip.
- **The neck.** Before it falls, the bead **stretches**: `scaleY` up to about `1.35` with `scaleX` around `0.85` on the bead group, about `0.35s`, then a fast release back past `1.0` on a slight overshoot as surface tension snaps. That release is the moment the drop separates and it must be visible. `svgOrigin` at the bead's own coordinates, exactly as now.
- **The fall.** `power2.in`, accelerating, `70` to `160` source units — further than `007`'s `50` to `90`, because a short fall reads as a twitch. The drop stretches as it accelerates (`scaleY` to about `1.5`, `scaleX` to about `0.8`) and relaxes as it fades. It fades out over the last third and never reaches the frame edge or the caption.
- **The trail.** Behind each drop, a **wet streak**: a thin vertical line, `stroke` white at low opacity, drawn with `scaleY` growing from `0` as the drop falls and fading behind it. One streak element per drop in the pool, moved with it. This is the difference between a dot moving down and water running.
- **The rebound.** At the end of the fall, the drop does not simply vanish: it flattens briefly (`scaleY` to about `0.6`, `scaleX` to about `1.2`) as it lands and fades on that flatten. Cheap, and it closes the gesture.

Transforms and opacity only, per design-system.md 5.2. No `filter`, no `box-shadow`, no animating `r`, no animating `width`/`height`, no layout properties — see the `gsap-performance` skill.

## Structure

Two timelines as now: a per-bead ambient set, and one repeating drip timeline built with the `gsap-timeline` position parameter so the whole rotation is laid out on one line of time. Keep the fixed tail so the last drop clears before the loop restarts. Nothing new is created per frame and nothing is created per drip.

**Reduced motion is unchanged in intent and must be re-checked after the rewrite.** Under `(prefers-reduced-motion: reduce)` no timeline is built at all: halo, core and crescent render statically at their resting values, no drop and no streak is ever visible, and no bead creeps. The static layer is now *brighter* than `007`'s because the core is bright, which is fine and is an improvement — a still bead should still look wet.

Keep the house-voice header comment. Rewrite it to describe what the layer now is; it must explain the small-and-bright principle and the four-independent-cycles idea, and it closes with `See design-system.md 5.2.` as its neighbours do.

## Files

- `components/motion/DropletBloom.tsx` — the whole change.
- `components/motion/LivePhoto.tsx` — **no change.** The registration and the shared transform are correct.
- `components/sections/Hero.tsx` — **no change.**
- No CSS changes, no new `will-change`, no `will-change` on individual beads.

## Constraints

- Neutral white only. No `#6c2fff`, no lime, no tinted bead. The two-accent lock is untouched.
- Element count on the LCP tile: about four drawn nodes per bead plus the pool. At two dozen beads that is roughly a hundred small SVG nodes in one composited layer. That is acceptable; two hundred is not. If the count starts climbing, drop the halo before dropping the core.
- No `window.addEventListener("scroll")`, no ScrollTrigger, no `useState` for continuous values, no `Math.random`.
- The macaw keeps `priority`. Inline SVG only: no new network request.
- The `AI Generator` caption keeps clearing 4.5:1. `screen` only brightens, and the core is now much brighter, so re-measure rather than assume — no bead and no drip may enter that corner.
- Zero em-dashes in any visible string. Nothing here adds visible copy.

## Documentation

- Rewrite the `§3` hero photo bead row to describe what actually ships: the count of beads, the three drawn parts, the four ambient cycles, the creep, and the new drip cadence and shape.
- Update the `§5.1` §9.A row: the resting figure is no longer `0.35`. State the halo's resting `~0.18` and the core's near-opaque pinpoint, and say plainly that the cap now lives in the **size** of the bright mark rather than in its opacity, because a faint wash was invisible against the photograph. It remains the second earned exception to §9.A and the count still stops there.
- The `§3` reduced-motion sentence already names the bead breathing and the drips. Extend it to the glint wander and the creep, and keep the note that a static bloom is what remains.

## Verify

- `npm run lint` and `npm run build`.
- Dev server, and **do not touch the mouse**: within five seconds of load the tile must read as wet and something must be visibly falling. If a screenshot of a random frame shows nothing moving, the prompt has not been satisfied.
- Capture the running tile and compare against the user's screencast. The bar is the user's own words: shiny, dripping, droppy.
- Every bead sits on a real bead at `sm`, `md` and `lg`. Resize slowly and watch for any core sliding off the water it belongs to.
- Hover and move the cursor: the layer magnifies and tracks locked to the photo, and the glints, creep and drips keep running through the magnify without a pause or a jump.
- Watch a full minute: drips are continuous but never more than three at once, always downward, always faded before the frame edge, never into the caption.
- `prefers-reduced-motion: reduce`: static, bright, wet-looking beads. Nothing moves, no drop and no streak anywhere.
