"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Makes the water on the hero macaw read as wet, and keeps it dripping.
 *
 * The beads are baked into the photograph, so nothing can animate them in
 * place. This is a drawn layer sitting over the picture, anchored to where the
 * real beads are: the svg's viewBox is the image's own pixel space and its
 * `xMidYMid slice` crops identically to the `object-cover` beneath it, so a
 * mark placed at a source pixel stays on its bead at every viewport width. The
 * layer carries `data-photo`, so `LivePhoto`'s drift, breath and hover magnify
 * drive image and beads as one set of targets: one tween, two elements, no way
 * for the lights to slide off the water they belong to.
 *
 * The governing rule is **small and bright beats large and faint**. Everything
 * is neutral white on `mix-blend-mode: screen`, which only ever brightens, so a
 * wide soft wash at low opacity disappears over a lit leaf, where most of these
 * beads live. A near-opaque pinpoint two or three source units across survives
 * the same leaf. So each bead is three marks: a faint halo for atmosphere, a
 * hard specular core carrying nearly all the brightness, and a thin crescent on
 * the far side, the refracted rim light that makes a circle read as glass
 * rather than as a dot. The core sits where the real highlight sits, off centre,
 * read off the source rather than assumed.
 *
 * Wetness is four independent cycles per bead. The core wanders a source unit
 * or two around its rest, on one duration; it flickers on a second; the
 * crescent breathes on a third; the halo on a fourth. Nothing shares a period
 * with anything else, so two dozen beads never settle into a rhythm the eye can
 * count, which is the difference between water and animation. Every duration
 * and phase comes off the bead's index, so each load looks the same. Four of the
 * larger beads also creep slowly downward and settle back while dimmed, the way
 * a real bead loses its grip.
 *
 * A drip starts every two seconds or so, which keeps one to three drops in
 * flight at any moment. The bead necks first, `scaleY` up and `scaleX` in, then
 * snaps back past its rest as surface tension lets go; that snap is the moment
 * the drop separates. The drop is a teardrop that accelerates, stretches, drags
 * a wet streak behind it and flattens as it lands. It is one repeating timeline
 * walking a fixed rotation, re-targeting a pool of four drops and four streaks
 * rendered once in the markup rather than building svg nodes on a loop.
 *
 * Nothing pauses on hover: a bead frozen mid-fall while the frame magnifies is
 * a bug the eye catches at once. These never collide with the hover tween's
 * `overwrite: "auto"` either, which targets `[data-photo]` while these target
 * their own children.
 *
 * Under `prefers-reduced-motion: reduce` no timeline is created at all. The
 * beads render at their resting values, which is brighter than a glow-only
 * layer would be, because a still bead should still look wet. No drop and no
 * streak is ever visible. See design-system.md 5.2.
 */

/** The photograph's own pixel space. Matches the `<Image>` intrinsic size. */
const VIEW_W = 1060;
const VIEW_H = 606;

/**
 * Read off the source: luminance maxima, clustered, then filtered by eye
 * against the photograph. The eye's catchlight, the paint fleck and the sheen
 * on the beak, and the white speckles on the lower mandible are pigment, not
 * water, and are not here. Neither are the scale-shaped feathers along the top
 * left, which are the same shape as a bead and none of them is one.
 *
 * `x` and `y` are the bead's centre, `r` its halo radius, and `ox`/`oy` the
 * direction of its specular hit as a fraction of `r`. The highlight in the
 * photograph is not centred on its bead, so the drawn core is not either. Most
 * of these point up and to the left, which is where the light is, but they are
 * measured rather than assumed and several do not.
 *
 * The card crops centre-anchored `slice`, and at its narrowest the visible band
 * is roughly `x ∈ [110, 950]`; every bead sits inside it. Fixed, never
 * generated, never random.
 */
const BEADS = [
  { x: 745, y: 30, r: 20, ox: -0.1, oy: -0.4 },
  { x: 806, y: 24, r: 20, ox: -0.85, oy: -0.5 },
  { x: 731, y: 112, r: 25, ox: -0.6, oy: -0.8 },
  { x: 847, y: 126, r: 21, ox: -0.67, oy: -0.52 },
  { x: 890, y: 113, r: 18, ox: -0.89, oy: 0.11 },
  { x: 897, y: 228, r: 26, ox: -0.46, oy: -0.88 },
  { x: 770, y: 228, r: 18, ox: -0.61, oy: -0.22 },
  { x: 727, y: 192, r: 13, ox: -0.46, oy: -0.31 },
  { x: 762, y: 296, r: 26, ox: 0.77, oy: 0.62 },
  { x: 845, y: 272, r: 12, ox: -0.17, oy: 0.92 },
  { x: 697, y: 256, r: 12, ox: 0.92, oy: -0.25 },
  { x: 712, y: 283, r: 10, ox: -0.7, oy: 0 },
  { x: 740, y: 320, r: 12, ox: 0.17, oy: 0.92 },
  { x: 836, y: 380, r: 14, ox: -0.93, oy: 0.14 },
  { x: 784, y: 408, r: 13, ox: -0.77, oy: 0.62 },
  { x: 712, y: 428, r: 10, ox: 0.8, oy: -0.1 },
  { x: 695, y: 457, r: 6, ox: -0.33, oy: 0.83 },
  { x: 667, y: 507, r: 11, ox: 0.09, oy: -0.91 },
  { x: 745, y: 580, r: 13, ox: -0.31, oy: -0.08 },
  { x: 850, y: 528, r: 10, ox: -0.2, oy: 0.9 },
  { x: 897, y: 550, r: 9, ox: -0.89, oy: -0.11 },
  { x: 930, y: 367, r: 7, ox: -0.57, oy: -0.71 },
  { x: 573, y: 495, r: 6, ox: -0.83, oy: 0.5 },
];

/** How the three marks are sized and where they rest. */
const CORE_RATIO = 0.22;
const CORE_MIN = 1.6;
/** How far along its specular direction the core sits, as a fraction of `r`. */
const CORE_OFFSET = 0.45;
const CORE_REST = 0.92;
const CORE_DIM = 0.7;
const CORE_LIT = 1;
const HALO_REST = 0.18;
const HALO_DIM = 0.13;
const HALO_LIT = 0.24;
const CRESCENT_RATIO = 0.7;
const CRESCENT_REST = 0.3;
const CRESCENT_DIM = 0.18;
const CRESCENT_LIT = 0.38;
const CRESCENT_WIDTH = 1.2;
/** The arc the crescent covers, centred opposite the core. */
const CRESCENT_SPAN = 1.9;

/** The wander that sells glass: a slow lap around the core's resting point. */
const WANDER_MIN = 4;
const WANDER_MAX = 9;
const FLICKER_MIN = 2.6;
const FLICKER_MAX = 5;
const HALO_CYCLE = 5.6;
const CRESCENT_CYCLE = 3.7;

/** Beads that lose their grip: how far each slides, and over how long. */
const CREEPS = [
  { bead: 2, slide: 4.5, duration: 22 },
  { bead: 5, slide: 3.2, duration: 18 },
  { bead: 8, slide: 5, duration: 25 },
  { bead: 14, slide: 2.4, duration: 16 },
];

/**
 * Which beads run, in what order, how far each drop falls and how long until
 * the next one starts. Fixed, not generated: every fall stops well short of the
 * frame edge, and none of these beads is anywhere near the caption in the
 * bottom-left corner, which drops can only travel away from.
 */
const DRIPS = [
  { bead: 2, fall: 150, gap: 1.9 },
  { bead: 5, fall: 140, gap: 2.3 },
  { bead: 0, fall: 160, gap: 1.7 },
  { bead: 9, fall: 120, gap: 2 },
  { bead: 13, fall: 105, gap: 1.6 },
  { bead: 6, fall: 135, gap: 2.2 },
  { bead: 1, fall: 155, gap: 2.1 },
  { bead: 11, fall: 115, gap: 1.8 },
  { bead: 3, fall: 145, gap: 2 },
  { bead: 15, fall: 90, gap: 2 },
  { bead: 8, fall: 130, gap: 1.7 },
  { bead: 4, fall: 150, gap: 2 },
  { bead: 12, fall: 110, gap: 1.6 },
  { bead: 7, fall: 140, gap: 2.2 },
  { bead: 21, fall: 100, gap: 2.1 },
  { bead: 10, fall: 125, gap: 1.9 },
];

/** The neck, the snap, and the fall. */
const NECK_DURATION = 0.35;
const NECK_Y = 1.35;
const NECK_X = 0.85;
const SNAP_DURATION = 0.45;
const FALL_MIN = 1.3;
const FALL_SPAN = 0.8;
const FLATTEN_DURATION = 0.22;
const DROP_OPACITY = 0.85;
const STREAK_OPACITY = 0.22;
const STREAK_LENGTH = 46;
/** Four in the pool, so three drops can be in flight and one still landing. */
const DROP_POOL = [0, 1, 2, 3];

/** A teardrop pointing down, belly on the origin, drawn once and reused. */
const DROP_PATH =
  "M 0 -9 C 2.4 -4.5 5 -2.6 5 0.6 C 5 3.9 2.6 6 0 6 C -2.6 6 -5 3.9 -5 0.6 C -5 -2.6 -2.4 -4.5 0 -9 Z";

const coreRadius = (r: number) => Math.max(CORE_MIN, r * CORE_RATIO);

/** The crescent: an arc on the far side of the bead from its specular hit. */
function crescentPath({
  x,
  y,
  r,
  ox,
  oy,
}: {
  x: number;
  y: number;
  r: number;
  ox: number;
  oy: number;
}) {
  const away = Math.atan2(oy, ox) + Math.PI;
  const rc = r * CRESCENT_RATIO;
  const a = away - CRESCENT_SPAN / 2;
  const b = away + CRESCENT_SPAN / 2;
  const round = (n: number) => Number(n.toFixed(2));
  return `M ${round(x + rc * Math.cos(a))} ${round(y + rc * Math.sin(a))} A ${round(rc)} ${round(rc)} 0 0 1 ${round(x + rc * Math.cos(b))} ${round(y + rc * Math.sin(b))}`;
}

export function DropletBloom() {
  const scope = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const root = scope.current;
        if (!root) return;

        const beads = gsap.utils.toArray<SVGGElement>("[data-bead]", root);
        const shells = gsap.utils.toArray<SVGGElement>("[data-shell]", root);
        const cores = gsap.utils.toArray<SVGCircleElement>("[data-core]", root);
        const halos = gsap.utils.toArray<SVGCircleElement>("[data-halo]", root);
        const crescents = gsap.utils.toArray<SVGPathElement>(
          "[data-crescent]",
          root,
        );
        const drops = gsap.utils.toArray<SVGPathElement>("[data-drop]", root);
        const streaks = gsap.utils.toArray<SVGLineElement>(
          "[data-streak]",
          root,
        );
        if (!cores.length || !drops.length) return;

        // Every duration and phase off the index, so the tile is identical on
        // every load. Irrational-ish multipliers keep neighbours out of step.
        const seed = (step: number, i: number) =>
          gsap.utils.wrap(0, 1, i * step);

        cores.forEach((core, i) => {
          const amp = 1 + (i % 3) * 0.5;
          const lap = gsap.utils.mapRange(
            0,
            1,
            WANDER_MIN,
            WANDER_MAX,
            seed(0.37, i),
          );
          const phase = seed(0.611, i);

          // x and y on one period, a quarter turn apart, is an ellipse: the
          // glint travels the way a highlight travels across a moving bead.
          const wanderX = gsap.fromTo(
            core,
            { x: -amp },
            {
              x: amp,
              duration: lap,
              ease: "sine.inOut",
              yoyo: true,
              repeat: -1,
            },
          );
          wanderX.progress(phase);

          const wanderY = gsap.fromTo(
            core,
            { y: -amp },
            {
              y: amp,
              duration: lap,
              ease: "sine.inOut",
              yoyo: true,
              repeat: -1,
            },
          );
          wanderY.progress(gsap.utils.wrap(0, 1, phase + 0.25));

          // The flicker runs on its own period, so no bead reaches its brightest
          // at the same point in its lap twice running.
          const flicker = gsap.fromTo(
            core,
            { opacity: CORE_DIM },
            {
              opacity: CORE_LIT,
              duration: gsap.utils.mapRange(
                0,
                1,
                FLICKER_MIN,
                FLICKER_MAX,
                seed(0.786, i),
              ),
              ease: "sine.inOut",
              yoyo: true,
              repeat: -1,
            },
          );
          flicker.progress(seed(0.23, i));
        });

        // The halo and the crescent are the same animation on every bead, so
        // they run as staggered sets rather than as one tween each.
        gsap.fromTo(
          halos,
          { opacity: HALO_DIM },
          {
            opacity: HALO_LIT,
            duration: HALO_CYCLE,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            stagger: { each: 0.31, from: 0 },
          },
        );

        gsap.fromTo(
          crescents,
          { opacity: CRESCENT_DIM },
          {
            opacity: CRESCENT_LIT,
            duration: CRESCENT_CYCLE,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            stagger: { each: 0.19, from: "end" },
          },
        );

        // Water does not travel back up, so the creep never yoyos: it slides,
        // gives up its light, and is returned while it is too dim to watch.
        CREEPS.forEach(({ bead, slide, duration }) => {
          const group = beads[bead];
          if (!group) return;

          gsap
            .timeline({ repeat: -1 })
            .to(group, { y: slide, duration, ease: "sine.in" })
            .to(group, { opacity: 0, duration: 0.7, ease: "sine.in" })
            .set(group, { y: 0 })
            .to(group, { opacity: 1, duration: 0.9, ease: "sine.out" });
        });

        // The pool is positioned once. The drop scales about its belly and the
        // streak grows upward out of wherever the drop is.
        gsap.set(drops, { transformOrigin: "50% 63%" });
        gsap.set(streaks, { transformOrigin: "50% 100%" });

        const tl = gsap.timeline({ repeat: -1 });
        let at = 0;

        DRIPS.forEach(({ bead, fall, gap }, i) => {
          const { x, y } = BEADS[bead];
          const shell = shells[bead];
          const drop = drops[DROP_POOL[i % DROP_POOL.length]];
          const streak = streaks[DROP_POOL[i % DROP_POOL.length]];
          const origin = `${x} ${y}`;
          const falling = FALL_MIN + (fall / 160) * FALL_SPAN;
          const release = at + NECK_DURATION;

          tl.set([drop, streak], { x, y, opacity: 0 }, at)
            .set(drop, { scaleX: 0.75, scaleY: 0.75 }, at)
            .set(streak, { scaleY: 0 }, at)
            // The bead necks, then snaps back past its rest. The snap is the
            // moment the drop separates, and it has to be visible.
            .to(
              shell,
              {
                scaleX: NECK_X,
                scaleY: NECK_Y,
                svgOrigin: origin,
                duration: NECK_DURATION,
                ease: "sine.in",
              },
              at,
            )
            .to(
              shell,
              {
                scaleX: 1,
                scaleY: 1,
                svgOrigin: origin,
                duration: SNAP_DURATION,
                ease: "back.out(2.6)",
              },
              release,
            )
            .to(
              drop,
              {
                opacity: DROP_OPACITY,
                scaleX: 0.9,
                scaleY: 1.1,
                duration: 0.18,
              },
              release,
            )
            // A falling thing accelerates, and draws out as it goes.
            .to(
              [drop, streak],
              { y: y + fall, duration: falling, ease: "power2.in" },
              release,
            )
            .to(
              drop,
              {
                scaleY: 1.5,
                scaleX: 0.8,
                duration: falling * 0.7,
                ease: "power1.in",
              },
              release,
            )
            .to(
              streak,
              { scaleY: 1, duration: falling * 0.55, ease: "power2.in" },
              release,
            )
            .to(streak, { opacity: STREAK_OPACITY, duration: 0.3 }, release)
            .to(
              streak,
              { opacity: 0, duration: falling * 0.5, ease: "power1.in" },
              release + falling * 0.5,
            )
            .to(
              drop,
              {
                opacity: 0,
                duration: falling * 0.28 + FLATTEN_DURATION,
                ease: "power1.in",
              },
              release + falling * 0.72,
            )
            // It lands rather than stopping: a brief flatten closes the gesture.
            .to(
              drop,
              {
                scaleY: 0.6,
                scaleX: 1.2,
                duration: FLATTEN_DURATION,
                ease: "power2.out",
              },
              release + falling,
            );

          at += gap;
        });

        // A fixed tail so the last drop lands before the rotation restarts.
        tl.to({}, { duration: 3 }, at);
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
      // origin, which is what keeps every mark on its bead as the card's
      // aspect ratio changes.
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ mixBlendMode: "screen" }}
    >
      <defs>
        {/* Two gradients for the whole layer, not two per bead. White only: a
            water glint is light, not brand colour. */}
        <radialGradient id="bead-halo">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="35%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {/* Opaque to nearly half its radius: this is the mark that survives
            `screen` over a bright leaf. */}
        <radialGradient id="bead-core">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {BEADS.map((bead) => (
        <g key={`${bead.x}-${bead.y}`} data-bead>
          <g data-shell>
            <circle
              data-halo
              cx={bead.x}
              cy={bead.y}
              r={bead.r}
              fill="url(#bead-halo)"
              opacity={HALO_REST}
            />
            <path
              data-crescent
              d={crescentPath(bead)}
              fill="none"
              stroke="#ffffff"
              strokeWidth={CRESCENT_WIDTH}
              strokeLinecap="round"
              opacity={CRESCENT_REST}
            />
            <circle
              data-core
              cx={bead.x + bead.ox * bead.r * CORE_OFFSET}
              cy={bead.y + bead.oy * bead.r * CORE_OFFSET}
              r={coreRadius(bead.r)}
              fill="url(#bead-core)"
              opacity={CORE_REST}
            />
          </g>
        </g>
      ))}

      {DROP_POOL.map((i) => (
        <g key={i}>
          <line
            data-streak
            x1={0}
            y1={0}
            x2={0}
            y2={-STREAK_LENGTH}
            stroke="#ffffff"
            strokeWidth={1.1}
            strokeLinecap="round"
            opacity={0}
          />
          <path data-drop d={DROP_PATH} fill="url(#bead-core)" opacity={0} />
        </g>
      ))}
    </svg>
  );
}
