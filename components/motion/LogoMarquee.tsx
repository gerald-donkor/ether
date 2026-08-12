"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Drives the logo wall as one continuous right-to-left marquee.
 *
 * The track holds the partner list four times and travels `xPercent: -25`,
 * which is exactly one pass, so the repeat is seamless. Four passes rather
 * than the gallery's two because one pass of seven marks measures roughly
 * 900px: a two-pass track would run dry on a 1920px screen before the loop
 * came round.
 *
 * No hover pause. The gallery pauses because its tiles are content a reader
 * may want to stop on; seven partner marks are not, and a strip that halts
 * when the pointer crosses it on the way somewhere else reads as broken.
 *
 * `gsap.matchMedia` never creates a tween at all under
 * `prefers-reduced-motion: reduce`, so the row renders as a static strip.
 * See design-system.md 5.2.
 */
export function LogoMarquee({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const track = gsap.utils.toArray<HTMLElement>("[data-logo-marquee]");

        // 15s for one ~900px pass is the ~60px/s read off the reference
        // screencast. `ease: "none"` because a marquee that eases stutters.
        gsap.to(track, {
          xPercent: -25,
          duration: 15,
          ease: "none",
          repeat: -1,
        });
      });

      return () => mm.revert();
    },
    { scope },
  );

  return (
    <div ref={scope} className="overflow-hidden">
      {children}
    </div>
  );
}
