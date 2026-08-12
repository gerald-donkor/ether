"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Drives the gallery's stacked columns on their second axis.
 *
 * The strip's horizontal drift stays pure CSS. Only the vertical loop lives
 * here, because it needs a per-column direction and duration and a single kill
 * switch for hover and reduced motion. `useGSAP` reverts on unmount;
 * `gsap.matchMedia` never creates a tween at all under
 * `prefers-reduced-motion: reduce`, so the columns render as a static stack.
 *
 * Everything it animates is `yPercent`, so the loop stays on the compositor
 * alongside the CSS drift. See design-system.md 5.2.
 */
export function ColumnDrift({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const root = scope.current;
        if (!root) return;

        // Each stack is twice its column's height and holds its tiles twice,
        // so a 50% travel is exactly one pass and the repeat is seamless.
        // Direction and duration are read off the markup, never off the index.
        const tweens = gsap.utils
          .toArray<HTMLElement>("[data-column-drift]")
          .map((stack) => {
            const up = stack.dataset.columnDrift === "up";
            const duration = Number(stack.dataset.driftDuration);

            return gsap.fromTo(
              stack,
              { yPercent: up ? 0 : -50 },
              {
                yPercent: up ? -50 : 0,
                duration,
                ease: "none",
                repeat: -1,
              },
            );
          });

        // Matches the horizontal drift's hover pause, so the whole strip
        // stops and starts as one thing.
        const pause = () => tweens.forEach((tween) => tween.pause());
        const resume = () => tweens.forEach((tween) => tween.resume());

        root.addEventListener("pointerenter", pause);
        root.addEventListener("pointerleave", resume);

        return () => {
          root.removeEventListener("pointerenter", pause);
          root.removeEventListener("pointerleave", resume);
        };
      });

      return () => mm.revert();
    },
    { scope },
  );

  return <div ref={scope}>{children}</div>;
}
