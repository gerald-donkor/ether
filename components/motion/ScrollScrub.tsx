"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * The scrubbed motion for the public marketing routes, and the `relative`
 * wrapper that puts the page's content above `PageAtmosphere`'s fixed wash.
 *
 * Children are passed through as a prop, so everything inside stays a Server
 * Component: this file is the only thing that reaches the browser.
 *
 * Two behaviours, no more:
 *
 * - **Hairline draw.** Every `.rule` scales in from its leading edge as its
 *   section crosses the viewport. The rules are the structure on these pages,
 *   so drawing them is the page assembling itself rather than decoration laid
 *   over it. `--rule` defaults to 1 in `globals.css`, so the hairline is
 *   already full width in the HTML and nothing depends on this running.
 * - **Image drift.** A `[data-drift]` picture pans inside its own
 *   `overflow-hidden` frame. The frame does not move, so nothing neighbouring
 *   is displaced and no layout shifts. The 1.07 rest scale is the slack the
 *   pan uses, and it lives inside the tween so reduced motion leaves the
 *   photograph at its natural size rather than statically cropped.
 *
 * Triggers are created in page order, top to bottom, so `ScrollTrigger.refresh`
 * recalculates them in the order they appear. No `markers`.
 *
 * `gsap.matchMedia` with the condition named means the reduced-motion path
 * creates no tween and no ScrollTrigger, so it costs no listener at all.
 */
export function ScrollScrub({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const root = scope.current;
        if (!root) return;

        // One document-order pass, so triggers are created top to bottom.
        const targets = gsap.utils.toArray<HTMLElement>(
          root.querySelectorAll(".rule, [data-drift]"),
        );

        for (const target of targets) {
          if (target.hasAttribute("data-drift")) {
            const frame = target.parentElement;
            if (!frame) continue;

            gsap.fromTo(
              target,
              { yPercent: -3, scale: 1.07 },
              {
                yPercent: 3,
                scale: 1.07,
                ease: "none",
                scrollTrigger: {
                  trigger: frame,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: true,
                },
              },
            );
            continue;
          }

          gsap.fromTo(
            target,
            { "--rule": 0 },
            {
              "--rule": 1,
              ease: "none",
              scrollTrigger: {
                trigger: target,
                start: "top bottom-=40",
                end: "top center",
                scrub: true,
              },
            },
          );
        }
      });

      return () => mm.revert();
    },
    { scope },
  );

  return (
    <div ref={scope} className={`relative ${className}`}>
      {children}
    </div>
  );
}
