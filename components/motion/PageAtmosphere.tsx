"use client";

import { useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { z } from "@/lib/z";

gsap.registerPlugin(useGSAP);

/**
 * Wash placements, hoisted to module scope so one gradient definition serves
 * every route and no component holds a per-render object
 * (`vercel-react-best-practices`, `rendering-hoist-jsx`).
 *
 * `at` and `size` feed `--grad-page`'s two custom properties; nothing here is
 * a colour, so no hex literal enters a component file. `opacity` is the layer
 * cap, and it is the value the wash rests at: the drift only ever takes it
 * down, so the measured contrast in design-system.md 1.2 is the worst case.
 */
const WASH = {
  /** Left-led mastheads: the wash sits where the headline starts. */
  masthead: { at: "16% -4%", size: "112% 82%", opacity: 1 },
  /** Centred document columns. */
  column: { at: "50% -2%", size: "108% 78%", opacity: 1 },
  /** Routes whose weight is a right-hand aside or panel. */
  edge: { at: "82% 4%", size: "104% 76%", opacity: 1 },
  /** The signed-in and auth surfaces. Same geometry, deliberately fainter. */
  quiet: { at: "50% -6%", size: "118% 72%", opacity: 0.55 },
} as const;

export type WashVariant = keyof typeof WASH;

/**
 * The ambient wash behind every route except `/`.
 *
 * It is fixed to the viewport, `pointer-events-none` and `aria-hidden`, so it
 * intercepts no click and no tab stop, and it sits at `z.atmosphere` beneath
 * the page's own `relative` content wrapper. No new z-index level is added.
 *
 * Motion is transform and opacity only. Two tweens run on deliberately
 * different periods, 34s and 21s, so the drift and the breath never sync and
 * the layer never reads as a loop. The 1.18 scale is the slack the drift pans
 * within, exactly as the hero photograph rests scaled and pans its own slack;
 * it is set inside the tween, so under `prefers-reduced-motion: reduce`
 * `gsap.matchMedia` creates nothing at all and the wash renders unscaled,
 * unmoved and uncropped at its resting opacity. See design-system.md 3.
 */
export function PageAtmosphere({ variant }: { variant: WashVariant }) {
  const scope = useRef<HTMLDivElement>(null);
  const wash = WASH[variant];

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const layer = scope.current?.firstElementChild;
        if (!layer) return;

        gsap.set(layer, { scale: 1.18 });

        gsap.to(layer, {
          xPercent: 5,
          yPercent: -3.5,
          duration: 34,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });

        gsap.to(layer, {
          opacity: wash.opacity * 0.76,
          duration: 21,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      });

      return () => mm.revert();
    },
    { scope, dependencies: [wash.opacity] },
  );

  return (
    <div
      ref={scope}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: z.atmosphere }}
    >
      <div
        className="absolute inset-0"
        style={
          {
            background: "var(--grad-page)",
            opacity: wash.opacity,
            "--page-wash-at": wash.at,
            "--page-wash-size": wash.size,
          } as CSSProperties
        }
      />
    </div>
  );
}
