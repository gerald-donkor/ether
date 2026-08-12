"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Puts the hero's four brand marks on a spiral orbit and bounces them off one
 * another.
 *
 * Two forces on two wrappers, which is why `Mark` nests them. The orbit rides
 * `[data-mark-shape]`: each shape hops between waypoints on its own ring, so
 * the travel reads as a bounce and settle rather than a glide. The recoil
 * rides `[data-mark-bump]` inside it: a ticker watches the six pairs, and when
 * two shapes close on each other they shove apart along the line between them,
 * squash, and spring back on `elastic.out`. Separate wrappers so a shape can
 * be knocked sideways without its orbit and the knock fighting over `x`.
 *
 * The contact test is centre distance against a fraction of the pair's resting
 * distance, not overlap. These four shapes interlock where they are drawn, so
 * there is no rest state where their bounds are apart and nothing to detect
 * overlap against. A pair fires once on closing and re-arms only after it has
 * opened again, so the shapes bump rather than buzz.
 *
 * The spiral comes from three things stacked, not from a spiral path: the ring
 * itself, a radius that breathes twice a lap, and the whole group swinging
 * about the composition centre against the fastest orbit.
 *
 * SVG has no `z-index`, so which shape passes over which is DOM order. Each
 * timeline re-appends its shape at its crossing waypoints, which is the only
 * DOM mutation here and touches no layout.
 *
 * Everything animated is a transform. Orbit, rotation, group swing and recoil
 * are budgeted together against the margin `Mark` leaves in its viewBox, so no
 * shape reaches the tile's edge even when all four peak at once.
 * `gsap.matchMedia` never creates a tween at all under
 * `prefers-reduced-motion: reduce`, so the mark renders exactly as it draws.
 * See design-system.md 5.2.
 */

type Orbit = {
  /** Furthest the orbit carries the shape from rest, in the mark's own units. */
  ax: number;
  ay: number;
  /** Furthest a recoil carries it, on top of the orbit. */
  push: number;
  /** Where on its ring the shape rests, in turns. */
  start: number;
  /** Where in the loop the shape begins, in turns. */
  phase: number;
  direction: 1 | -1;
  duration: number;
  rotation: number;
  scale: number;
};

/**
 * Keyed by `data-mark-shape`, never by index, so re-ordering the paths for
 * stacking cannot re-order the motion. The x amplitudes carry the composition:
 * the asterisk is widest and fastest and does most of the closing, the dot is
 * tightest and takes the hardest knocks because it is small enough to, the
 * bolt is slowest and anchors.
 */
const ORBITS: Record<string, Orbit> = {
  bolt: {
    ax: 7, ay: 3, push: 4, start: 0.12, phase: 0, direction: 1,
    duration: 19, rotation: 1.5, scale: 1,
  },
  triangle: {
    ax: 10, ay: 1.5, push: 4, start: 0.4, phase: 0.35, direction: -1,
    duration: 16, rotation: 1.5, scale: 1.02,
  },
  asterisk: {
    ax: 12, ay: 2, push: 3.5, start: 0.68, phase: 0.62, direction: 1,
    duration: 11, rotation: 1, scale: 1.02,
  },
  dot: {
    ax: 7, ay: 2.5, push: 5, start: 0.9, phase: 0.18, direction: -1,
    duration: 13, rotation: 0, scale: 1.08,
  },
};

const STATIONS = 8; // waypoints per lap; the hop count
const BREATHS = 2; // radius contractions per lap; what bends the ring
const TIGHT = 0.55; // narrowest radius as a fraction of the widest
const GROUP_SWING = 1.2; // degrees either side of rest
const GROUP_DURATION = 13;
const CENTRE = "1134 646.5"; // composition centre, in the mark's user units

const CONTACT = 0.94; // of a pair's resting distance: closer than this is a hit
const RELEASE = 1.04; // and it re-arms once they are back outside this
const SQUASH = 0.94; // impact compression; never above 1, so a hit adds no bounds

const TURN = Math.PI * 2;

type Shape = {
  el: SVGGElement;
  bump: SVGGElement;
  orbit: Orbit;
  /** Resting centre, read once off the untransformed bbox. */
  cx: number;
  cy: number;
};

type Pair = { a: Shape; b: Shape; contact: number; touching: boolean };

/**
 * The waypoints for one ring, as the `x` and `y` arrays a keyframe block wants.
 *
 * Waypoint 0 is the shape's resting position and the last waypoint returns to
 * it, so the loop is seamless and a paused mark renders as the static one. The
 * whole ring is then rescaled to the configured amplitude, which is what keeps
 * the shape inside the tile no matter how the angles fall.
 */
function ring({ ax, ay, start, direction }: Orbit) {
  const points = Array.from({ length: STATIONS + 1 }, (_, i) => {
    const t = i / STATIONS;
    const angle = (start + direction * t) * TURN;
    const breathe = gsap.utils.mapRange(
      -1,
      1,
      TIGHT,
      1,
      Math.cos(t * BREATHS * TURN),
    );

    return {
      x: Math.cos(angle) * breathe,
      y: Math.sin(angle) * breathe,
    };
  });

  const rest = points[0];
  const offsets = points.map((p) => ({ x: p.x - rest.x, y: p.y - rest.y }));
  const spanX = Math.max(...offsets.map((p) => Math.abs(p.x))) || 1;
  const spanY = Math.max(...offsets.map((p) => Math.abs(p.y))) || 1;

  return {
    x: offsets.map((p) => (p.x / spanX) * ax),
    y: offsets.map((p) => (p.y / spanY) * ay),
  };
}

/** Knocks one shape away from a contact and springs it back. */
function recoil(shape: Shape, nx: number, ny: number) {
  const { push } = shape.orbit;

  gsap
    .timeline()
    .to(shape.bump, {
      x: nx * push,
      y: ny * push,
      scale: SQUASH,
      duration: 0.14,
      ease: "power3.out",
      overwrite: "auto",
    })
    .to(shape.bump, {
      x: 0,
      y: 0,
      scale: 1,
      duration: 1.15,
      ease: "elastic.out(1, 0.35)",
    });
}

export function MarkSpiral({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const shapes: Shape[] = [];

        gsap.utils.toArray<SVGGElement>("[data-mark-shape]").forEach((el) => {
          const key = el.dataset.markShape;
          const orbit = key ? ORBITS[key] : undefined;
          const bump = el.querySelector<SVGGElement>("[data-mark-bump]");
          if (!orbit || !bump) return;

          // Self rotation, the scale pulse and the impact squash all pivot on
          // the shape, not on the composition centre the group swings about.
          gsap.set([el, bump], { transformOrigin: "50% 50%" });

          // `getBBox` ignores the element's own transform, so this is the
          // resting centre however far the orbit has carried it since.
          const box = el.getBBox();
          shapes.push({
            el,
            bump,
            orbit,
            cx: box.x + box.width / 2,
            cy: box.y + box.height / 2,
          });

          const tl = gsap.timeline({ repeat: -1 });

          tl.to(
            el,
            {
              keyframes: {
                ...ring(orbit),
                // Overshoot and settle into every station. `ease: "none"`
                // beside it keeps the stations evenly spaced in time.
                easeEach: "back.inOut(1.5)",
                ease: "none",
              },
              duration: orbit.duration,
            },
            0,
          );

          if (orbit.rotation) {
            tl.to(
              el,
              {
                rotation: orbit.rotation * orbit.direction,
                duration: orbit.duration / 2,
                ease: "sine.inOut",
                yoyo: true,
                repeat: 1,
              },
              0,
            );
          }

          if (orbit.scale > 1) {
            // Scale rides with the radius, so the near pass reads as nearer.
            tl.to(
              el,
              {
                scale: orbit.scale,
                duration: orbit.duration / 2,
                ease: "sine.inOut",
                yoyo: true,
                repeat: 1,
              },
              0,
            );
          }

          // Restack on the odd stations, which are the ones between the ring's
          // extremes and so the ones where shapes meet. Order changes across
          // the cycle and nothing is permanently on top.
          for (let i = 1; i < STATIONS; i += 2) {
            tl.call(
              () => {
                el.parentNode?.appendChild(el);
              },
              undefined,
              (i / STATIONS) * orbit.duration,
            );
          }

          // Phase, so the four are never in step and the contacts land at
          // different moments.
          tl.progress(orbit.phase);
        });

        // The group swings against the asterisk, the fastest orbit, which is
        // what stops the set reading as a carousel.
        gsap.fromTo(
          "[data-mark-group]",
          { rotation: GROUP_SWING },
          {
            rotation: -GROUP_SWING,
            svgOrigin: CENTRE,
            duration: GROUP_DURATION,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          },
        );

        // Every pair, with its own contact distance taken from how far apart
        // the two rest. Six pairs is a fixed, tiny amount of work per frame.
        const pairs: Pair[] = [];
        shapes.forEach((a, i) => {
          shapes.slice(i + 1).forEach((b) => {
            pairs.push({
              a,
              b,
              contact: Math.hypot(b.cx - a.cx, b.cy - a.cy) * CONTACT,
              touching: false,
            });
          });
        });

        const collide = () => {
          pairs.forEach((pair) => {
            const { a, b } = pair;
            const dx =
              b.cx + Number(gsap.getProperty(b.el, "x")) -
              (a.cx + Number(gsap.getProperty(a.el, "x")));
            const dy =
              b.cy + Number(gsap.getProperty(b.el, "y")) -
              (a.cy + Number(gsap.getProperty(a.el, "y")));
            const distance = Math.hypot(dx, dy) || 1;

            if (distance < pair.contact) {
              if (pair.touching) return;
              pair.touching = true;
              recoil(a, -dx / distance, -dy / distance);
              recoil(b, dx / distance, dy / distance);
            } else if (distance > pair.contact * RELEASE) {
              pair.touching = false;
            }
          });
        };

        gsap.ticker.add(collide);

        return () => gsap.ticker.remove(collide);
      });

      return () => mm.revert();
    },
    { scope },
  );

  // `display: contents` so the svg stays the tile's flex item and the hero's
  // centring is untouched.
  return (
    <div ref={scope} className="contents">
      {children}
    </div>
  );
}
