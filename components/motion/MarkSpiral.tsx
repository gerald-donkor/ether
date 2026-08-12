"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Runs the hero's four brand marks as four rigid bodies that travel the tile
 * and bounce off one another.
 *
 * This is a simulation, not a set of orbits. Each shape has a permissive circle
 * for body contact and a separate, rotation-safe visual circle for containment,
 * plus a position, velocity, spin and mass. Those values are integrated on
 * `gsap.ticker` against the frame's own delta and written back as
 * `x`/`y`/`rotation` on `[data-mark-shape]`. Nothing is keyframed, so where a
 * shape goes is decided by what it hits.
 *
 * The drawing has no slack: the four paths interlock and fill the viewBox, so
 * at rest their bodies overlap and there is nowhere to travel. `[data-mark-group]`
 * is therefore scaled down about the composition centre once motion starts,
 * which buys the room. Each visual circle comes from the farthest corner of the
 * shape's untransformed bounding box, with the impact shift included. Its safe
 * room maps the viewBox back through the group scale and conservatively covers
 * the full 1.2 degree group swing. Containment runs after pair separation and
 * immediately before the transform writes, so no collision can push visible
 * geometry back outside for a rendered frame. Because the bodies start
 * interlocked, separation is capped per frame: the mark loads exactly as it is
 * drawn and unwinds into motion over the first half second rather than
 * exploding apart on frame one.
 *
 * Collisions resolve along the line between centres: separate to touching,
 * then exchange velocity with a restitution just above 1 so the set stays
 * lively instead of damping to a stop, with a speed band clamped after every
 * resolve so that cannot run away and nothing can stall in a corner. Mass comes
 * from each body's area, which is where the composition lives now: the dot is
 * thrown hard, the bolt barely yields.
 *
 * The two wrappers `Mark` nests still do separate jobs. The outer carries the
 * physics; the inner `[data-mark-bump]` is purely the flourish, a fast compress
 * along the impact normal springing back on `elastic.out`, so a hit reads as a
 * hit. Spin is nudged by the tangential part of each impact, which keeps even a
 * head-on bounce legible.
 *
 * SVG has no `z-index`, so which shape passes over which is DOM order. Each
 * collision re-appends whichever of the two sits lower in the tile, which is
 * the only DOM mutation here and touches no layout.
 *
 * Everything animated is a transform. `gsap.matchMedia` creates no tween and no
 * ticker at all under `prefers-reduced-motion: reduce`, including the group
 * scale, so the mark renders exactly as it draws, at full size.
 * See design-system.md 5.2.
 */

/** The mark's own viewBox, and the centre it is composed about. */
const VIEW = { x: 921, y: 536, w: 426, h: 221 };
const CENTRE_X = VIEW.x + VIEW.w / 2;
const CENTRE_Y = VIEW.y + VIEW.h / 2;
const CENTRE = `${CENTRE_X} ${CENTRE_Y}`;

/** How far the group shrinks to buy the bodies room to travel. */
const GROUP_SCALE = 0.72;
const GROUP_SWING = 1.2; // degrees either side of rest
const GROUP_DURATION = 13;

/** Collision radius as a fraction of the shape's smaller bounding side. */
const RADIUS = 0.44;
const MIN_RADIUS = 12;

const RESTITUTION = 1.06; // above 1, so contacts feed the set rather than drain it
const MIN_SPEED = 34; // user units per second
const MAX_SPEED = 78;
const MAX_SPIN = 40; // degrees per second
const SPIN_GAIN = 0.16; // of an impact's tangential speed, into spin
const MAX_SEPARATION = 300; // units per second of overlap unwinding
const MAX_FRAME = 1000 / 30; // ms; a returning background tab must not teleport

const BUMP_PUSH = 5; // how far the flourish compresses, in the mark's units
const SQUASH = 0.94; // impact compression; never above 1, so a hit adds no bounds

/**
 * Keyed by `data-mark-shape`, never by index, so the collision restacking
 * cannot re-order the motion. Fixed seeds, no `Math.random`, so the simulation
 * is deterministic and identical on every load.
 */
const SEEDS: Record<string, { vx: number; vy: number; spin: number }> = {
  bolt: { vx: 26, vy: -14, spin: -9 },
  triangle: { vx: -31, vy: 19, spin: 12 },
  asterisk: { vx: -24, vy: -22, spin: -7 },
  dot: { vx: 47, vy: 33, spin: 24 },
};

type Body = {
  el: SVGGElement;
  bump: SVGGElement;
  /** Resting centre, read once off the untransformed bbox. */
  cx: number;
  cy: number;
  /** Live centre, in the same user units. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  /** Permissive radius used only for body-to-body contact. */
  r: number;
  /** Rotation-safe visual radius used only for frame containment. */
  visualR: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  m: number;
};

/**
 * Builds a conservative local safe room for one visual circle. The coupled
 * equations reserve enough horizontal room for the maximum vertical swing and
 * enough vertical room for the maximum horizontal swing. After the group scale
 * and any rotation from -GROUP_SWING to +GROUP_SWING are composed, the visual
 * circle still sits inside all four viewBox edges.
 */
function getSafeRoom(visualR: number) {
  const swing = (GROUP_SWING * Math.PI) / 180;
  const sin = Math.sin(swing);
  const determinant = 1 - sin * sin;
  const roomX = VIEW.w / 2 / GROUP_SCALE - visualR;
  const roomY = VIEW.h / 2 / GROUP_SCALE - visualR;
  const safeX = (roomX - sin * roomY) / determinant;
  const safeY = (roomY - sin * roomX) / determinant;

  return {
    minX: CENTRE_X - safeX,
    maxX: CENTRE_X + safeX,
    minY: CENTRE_Y - safeY,
    maxY: CENTRE_Y + safeY,
  };
}

/** Final frame containment. Reflect only a velocity still travelling outward. */
function contain(body: Body) {
  if (body.x < body.minX) {
    body.x = body.minX;
    if (body.vx < 0) body.vx = -body.vx;
  } else if (body.x > body.maxX) {
    body.x = body.maxX;
    if (body.vx > 0) body.vx = -body.vx;
  }

  if (body.y < body.minY) {
    body.y = body.minY;
    if (body.vy < 0) body.vy = -body.vy;
  } else if (body.y > body.maxY) {
    body.y = body.maxY;
    if (body.vy > 0) body.vy = -body.vy;
  }
}

/** Compresses a shape toward the thing it just hit, then springs it back. */
function flourish(body: Body, nx: number, ny: number) {
  gsap
    .timeline()
    .to(body.bump, {
      x: nx * BUMP_PUSH,
      y: ny * BUMP_PUSH,
      scale: SQUASH,
      duration: 0.12,
      ease: "power3.out",
      overwrite: "auto",
    })
    .to(body.bump, {
      x: 0,
      y: 0,
      scale: 1,
      duration: 1.05,
      ease: "elastic.out(1, 0.35)",
    });
}

export function MarkSpiral({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const bodies: Body[] = [];

        gsap.utils.toArray<SVGGElement>("[data-mark-shape]").forEach((el) => {
          const key = el.dataset.markShape;
          const seed = key ? SEEDS[key] : undefined;
          const bump = el.querySelector<SVGGElement>("[data-mark-bump]");
          if (!seed || !bump) return;

          // Rotation and the impact squash pivot on the shape, not on the
          // composition centre the group swings about.
          gsap.set([el, bump], { transformOrigin: "50% 50%" });

          // `getBBox` ignores the element's own transform, so this is the
          // resting centre however far the simulation has carried it since.
          const box = el.getBBox();
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          const r = Math.max(
            MIN_RADIUS,
            RADIUS * Math.min(box.width, box.height),
          );
          const visualR = Math.hypot(box.width / 2, box.height / 2) + BUMP_PUSH;
          const room = getSafeRoom(visualR);

          bodies.push({
            el,
            bump,
            cx,
            cy,
            x: cx,
            y: cy,
            vx: seed.vx,
            vy: seed.vy,
            rotation: 0,
            spin: seed.spin,
            r,
            visualR,
            ...room,
            // Mass from area, so the asterisk shoves and the dot is shoved.
            m: r * r,
          });
        });

        // The room only exists once the group is scaled, so this and the walls
        // have to agree. Set, not tweened: a body may not be outside the tile
        // on any frame, including the first.
        gsap.set("[data-mark-group]", {
          scale: GROUP_SCALE,
          svgOrigin: CENTRE,
        });

        // The group swings under the whole simulation, which is what stops the
        // set reading as four shapes in a box.
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

        // Six pairs, every tick. A fixed, tiny amount of work per frame.
        const pairs: Array<[Body, Body]> = [];
        bodies.forEach((a, i) => {
          bodies.slice(i + 1).forEach((b) => pairs.push([a, b]));
        });

        const step = (_time: number, deltaTime: number) => {
          const dt = Math.min(deltaTime, MAX_FRAME) / 1000;

          for (const body of bodies) {
            body.x += body.vx * dt;
            body.y += body.vy * dt;
            body.rotation += body.spin * dt;
          }

          for (const [a, b] of pairs) {
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distance = Math.hypot(dx, dy) || 1e-4;
            const overlap = a.r + b.r - distance;
            if (overlap <= 0) continue;

            const nx = dx / distance;
            const ny = dy / distance;
            const total = a.m + b.m;

            // Separate to touching, but never faster than the cap. In steady
            // state overlaps are a fraction of a unit and clear in one tick;
            // the cap only shows itself while the drawn, interlocked start
            // state unwinds.
            const push = Math.min(overlap, MAX_SEPARATION * dt);
            a.x -= nx * push * (b.m / total);
            a.y -= ny * push * (b.m / total);
            b.x += nx * push * (a.m / total);
            b.y += ny * push * (a.m / total);

            const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rvn >= 0) continue; // already parting; no second impulse

            const rvt = (b.vx - a.vx) * -ny + (b.vy - a.vy) * nx;
            const j = (-(1 + RESTITUTION) * rvn) / (1 / a.m + 1 / b.m);

            a.vx -= (j / a.m) * nx;
            a.vy -= (j / a.m) * ny;
            b.vx += (j / b.m) * nx;
            b.vy += (j / b.m) * ny;

            a.spin = gsap.utils.clamp(
              -MAX_SPIN,
              MAX_SPIN,
              a.spin - rvt * SPIN_GAIN * (b.m / total),
            );
            b.spin = gsap.utils.clamp(
              -MAX_SPIN,
              MAX_SPIN,
              b.spin + rvt * SPIN_GAIN * (a.m / total),
            );

            flourish(a, nx, ny);
            flourish(b, -nx, -ny);

            // Whichever sits lower passes in front, so the stacking follows the
            // composition and nothing is permanently on top.
            const front = a.y > b.y ? a : b;
            front.el.parentNode?.appendChild(front.el);
          }

          for (const body of bodies) {
            // Pair separation can move a body through a wall, so visual
            // containment is deliberately the last positional authority.
            contain(body);

            const speed = Math.hypot(body.vx, body.vy);
            if (speed < 1e-4) {
              body.vx = MIN_SPEED;
            } else {
              const clamped = gsap.utils.clamp(MIN_SPEED, MAX_SPEED, speed);
              body.vx = (body.vx / speed) * clamped;
              body.vy = (body.vy / speed) * clamped;
            }

            gsap.set(body.el, {
              x: body.x - body.cx,
              y: body.y - body.cy,
              rotation: body.rotation,
            });
          }
        };

        gsap.ticker.add(step);

        return () => {
          gsap.ticker.remove(step);
          // The flourishes are created inside the ticker, long after the
          // context recorded what to revert, so they are cleared by hand.
          const bumps = bodies.map((body) => body.bump);
          gsap.killTweensOf(bumps);
          gsap.set(bumps, { x: 0, y: 0, scale: 1 });
        };
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
