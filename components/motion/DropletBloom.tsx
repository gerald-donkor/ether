"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Lights the water beads on the hero macaw, and lets one run every few seconds.
 *
 * The beads are baked into the photograph, so nothing can animate them in
 * place. This is a drawn layer sitting over the picture, anchored to where the
 * real beads are: the svg's viewBox is the image's own pixel space and its
 * `xMidYMid slice` crops identically to the `object-cover` beneath it, so a
 * bloom placed at a source pixel stays on its bead at every viewport width.
 *
 * The layer carries `data-photo` as well, so `LivePhoto`'s drift, breath and
 * hover magnify drive image and bloom as one array of targets. One tween, two
 * elements, no way for the lights to slide off the beads they belong to.
 *
 * Everything is neutral white on `mix-blend-mode: screen`, so a bloom adds
 * light to what is already there rather than painting a grey disc on top:
 * invisible over the bright feathers, strongest over the dark ones, which is
 * the right way round. Resting opacity is low on purpose. The brief is that the
 * beads look lit, not that they are lamps.
 *
 * Motion is transforms and opacity only. A bead swells with `scale` about its
 * own centre, never by animating `r`. Each one breathes on its own duration and
 * its own start offset, both derived from its index, so the set never blinks in
 * unison and every load looks the same. The drip is one repeating timeline
 * walking a fixed rotation of beads several seconds apart, re-targeting a pool
 * of two drop elements rendered once in the markup rather than building and
 * discarding svg nodes on a loop.
 *
 * Neither the breathing nor the drip pauses on hover: a bead frozen mid-fall
 * while the frame magnifies is a bug the eye catches at once. They also never
 * collide with the hover tween's `overwrite: "auto"`, which targets
 * `[data-photo]` while these target their own circles.
 *
 * Under `prefers-reduced-motion: reduce` no timeline is created at all. The
 * bloom still renders, held at the resting opacity the markup gives it, because
 * the glow is a look rather than a motion, and no drop is ever visible.
 * See design-system.md 5.2.
 */

/** The photograph's own pixel space. Matches the `<Image>` intrinsic size. */
const VIEW_W = 1060;
const VIEW_H = 606;

/**
 * Verified against the source: specular maxima, then checked by eye. The
 * catchlight in the eye and the paint fleck on the beak are not beads and are
 * not here, and neither are the far-right and bottom-most drops, which are the
 * first pixels a tall crop discards.
 */
const BEADS = [
  { x: 370, y: 46, r: 20 },
  { x: 250, y: 199, r: 14 },
  { x: 722, y: 84, r: 16 },
  { x: 776, y: 323, r: 12 },
  { x: 706, y: 282, r: 7 },
  { x: 757, y: 377, r: 9 },
  { x: 771, y: 425, r: 7 },
  { x: 838, y: 545, r: 7 },
  { x: 891, y: 557, r: 6 },
  { x: 933, y: 537, r: 6 },
  { x: 946, y: 483, r: 6 },
  { x: 954, y: 453, r: 6 },
  { x: 597, y: 398, r: 8 },
];

/** Where the bloom rests, and the band it breathes across. */
const REST_OPACITY = 0.35;
const DIM_OPACITY = 0.22;
const LIT_OPACITY = 0.46;
const REST_SCALE = 0.94;
const LIT_SCALE = 1.08;

/**
 * Which beads run, in what order, and how far each drop falls. Fixed, not
 * generated: every fall clears the frame edge and none travels toward the
 * caption in the bottom-left corner.
 */
const DRIPS = [
  { bead: 2, fall: 90 },
  { bead: 12, fall: 70 },
  { bead: 0, fall: 85 },
  { bead: 5, fall: 60 },
  { bead: 3, fall: 75 },
  { bead: 11, fall: 55 },
  { bead: 1, fall: 80 },
  { bead: 6, fall: 50 },
];

/** Seconds between one drip starting and the next. */
const DRIP_GAP = 5.5;
const SWELL_DURATION = 0.5;
const FALL_DURATION = 1.6;
const DROP_OPACITY = 0.5;
const SWELL_SCALE = 1.4;
/** Two in the pool, alternating, so a drip can never land on a live one. */
const DROP_POOL = [0, 1];

export function DropletBloom() {
  const scope = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const glints = gsap.utils.toArray<SVGCircleElement>("[data-glint]");
        const shells = gsap.utils.toArray<SVGGElement>("[data-shell]");
        const drops = gsap.utils.toArray<SVGCircleElement>("[data-drop]");
        if (!glints.length || !shells.length || !drops.length) return;

        // Each bead on its own duration and its own point in the cycle, both
        // off the index, so the set breathes as a set of separate things.
        glints.forEach((glint, i) => {
          const duration = 4 + ((i * 1.37) % 3);
          const breathe = gsap.fromTo(
            glint,
            { opacity: DIM_OPACITY, scale: REST_SCALE },
            {
              opacity: LIT_OPACITY,
              scale: LIT_SCALE,
              transformOrigin: "50% 50%",
              duration,
              ease: "sine.inOut",
              yoyo: true,
              repeat: -1,
            },
          );
          breathe.progress((i * 0.19) % 1);
        });

        // The swell rides the wrapping group, so it composes with the breath on
        // the circle inside rather than overwriting it.
        const tl = gsap.timeline({ repeat: -1 });

        DRIPS.forEach(({ bead, fall }, i) => {
          const { x, y } = BEADS[bead];
          const shell = shells[bead];
          const drop = drops[DROP_POOL[i % DROP_POOL.length]];
          const at = i * DRIP_GAP;

          tl.set(drop, { x, y, scale: 0.6, opacity: 0 }, at)
            .to(
              shell,
              {
                scale: SWELL_SCALE,
                svgOrigin: `${x} ${y}`,
                duration: SWELL_DURATION,
                ease: "sine.out",
              },
              at,
            )
            .to(
              shell,
              {
                scale: 1,
                svgOrigin: `${x} ${y}`,
                duration: 0.7,
                ease: "sine.inOut",
              },
              at + SWELL_DURATION,
            )
            .to(
              drop,
              { opacity: DROP_OPACITY, scale: 1, duration: 0.35 },
              at + SWELL_DURATION * 0.6,
            )
            // A falling thing accelerates, and gives up its light on the way.
            .to(
              drop,
              { y: y + fall, duration: FALL_DURATION, ease: "power2.in" },
              at + SWELL_DURATION,
            )
            .to(
              drop,
              { opacity: 0, duration: FALL_DURATION * 0.4, ease: "power1.in" },
              at + SWELL_DURATION + FALL_DURATION * 0.6,
            );
        });

        // A fixed tail so the last drip clears before the rotation restarts.
        tl.to({}, { duration: DRIP_GAP }, DRIPS.length * DRIP_GAP);
      });

      return () => mm.revert();
    },
    { scope },
  );

  return (
    <svg
      ref={scope}
      data-photo
      aria-hidden="true"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      // `slice` crops exactly as `object-cover` does at the default centre
      // origin, which is what keeps every bloom on its bead as the card's
      // aspect ratio changes.
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ mixBlendMode: "screen" }}
    >
      <defs>
        {/* One gradient, reused by every bead and every drop. White only: a
            water glint is light, not brand colour. */}
        <radialGradient id="droplet-bloom">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="35%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {BEADS.map((bead) => (
        <g key={`${bead.x}-${bead.y}`} data-shell>
          <circle
            data-glint
            cx={bead.x}
            cy={bead.y}
            r={bead.r}
            fill="url(#droplet-bloom)"
            opacity={REST_OPACITY}
          />
        </g>
      ))}

      {DROP_POOL.map((i) => (
        <circle
          key={i}
          data-drop
          cx={0}
          cy={0}
          r={5}
          fill="url(#droplet-bloom)"
          opacity={0}
        />
      ))}
    </svg>
  );
}
