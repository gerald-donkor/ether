"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Keeps the hero's macaw frame alive, and lets the cursor push into it.
 *
 * The photograph rests slightly overscaled, which is the whole trick: at scale
 * `s` there is `(s - 1) / 2` of the element hidden past each edge, so a pan
 * inside that budget can never expose the card beneath. The resting overscale
 * buys 4% a side and the drift spends 2.5% of it, which leaves margin at every
 * aspect ratio the responsive grid produces. A long diagonal yoyo and a slower
 * breathing scale run on different durations, so the pair never settles into a
 * loop the eye can time.
 *
 * Hover is the second half. The photo tweens up to a magnify and the pointer's
 * position in the card maps to a counter-offset, so moving the cursor moves the
 * frame into the picture rather than away from it. That offset is driven by
 * `gsap.quickTo`, one reused tween per axis rather than a new tween per
 * `pointermove`, and never by React state. The drift pauses while a pointer is
 * over the tile and the leave tween returns the photo to the drift's own paused
 * values, so the loop picks up without a jump.
 *
 * The magnify is a hover affordance and arms only where `(hover: hover)` holds,
 * so a touch device gets the ambient drift and nothing that can stick. Under
 * `prefers-reduced-motion: reduce` no tween, no listener and no `quickTo` is
 * created at all and the photo renders at scale 1, as the artboard draws it.
 *
 * Everything animated is `scale`, `xPercent` and `yPercent`, so the tile stays
 * on the compositor and the card's own geometry never moves.
 * See design-system.md 5.2.
 */

/** Resting overscale, and the slack it buys per side (4%). */
const REST_SCALE = 1.08;
const BREATHE_SCALE = 1.11;
/** Drift amplitude per axis, inside the 4% budget with margin. */
const DRIFT = 2.5;
const PAN_DURATION = 22;
const BREATHE_DURATION = 17;

/** Magnified scale buys 9% a side; the tracked offset spends 4% of it. */
const HOVER_SCALE = 1.18;
const HOVER_SHIFT = 4;
const HOVER_DURATION = 0.6;
const TRACK_DURATION = 0.5;

export function LivePhoto({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // One query, two conditions: motion decides whether anything runs at all,
      // pointer decides whether the magnify is armed on top of the drift.
      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          pointer: "(hover: hover)",
        },
        (context) => {
          const { motion, pointer } = context.conditions ?? {};
          if (!motion) return;

          const root = scope.current;
          const photo = root?.querySelector<HTMLElement>("[data-photo]");
          // The wrapper is `display: contents`, so the card is its parent.
          const card = root?.parentElement;
          if (!photo || !card) return;

          const pan = gsap.fromTo(
            photo,
            { xPercent: -DRIFT, yPercent: -DRIFT },
            {
              xPercent: DRIFT,
              yPercent: DRIFT,
              duration: PAN_DURATION,
              ease: "sine.inOut",
              yoyo: true,
              repeat: -1,
            },
          );

          const breathe = gsap.fromTo(
            photo,
            { scale: REST_SCALE },
            {
              scale: BREATHE_SCALE,
              duration: BREATHE_DURATION,
              ease: "sine.inOut",
              yoyo: true,
              repeat: -1,
            },
          );

          const loops = [pan, breathe];
          if (!pointer) return;

          const xTo = gsap.quickTo(photo, "xPercent", {
            duration: TRACK_DURATION,
            ease: "power3",
          });
          const yTo = gsap.quickTo(photo, "yPercent", {
            duration: TRACK_DURATION,
            ease: "power3",
          });

          /** Where the drift was when the pointer arrived, to return to. */
          let resting = { xPercent: 0, yPercent: 0, scale: REST_SCALE };
          let hovering = false;

          const track = (event: PointerEvent) => {
            const rect = card.getBoundingClientRect();
            // Cursor position in the card, as -0.5 to 0.5 on each axis, then
            // inverted: the frame travels toward whatever the cursor is over.
            const dx = (event.clientX - rect.left) / rect.width - 0.5;
            const dy = (event.clientY - rect.top) / rect.height - 0.5;

            xTo(gsap.utils.clamp(-HOVER_SHIFT, HOVER_SHIFT, -dx * 2 * HOVER_SHIFT));
            yTo(gsap.utils.clamp(-HOVER_SHIFT, HOVER_SHIFT, -dy * 2 * HOVER_SHIFT));
          };

          const enter = (event: PointerEvent) => {
            // A hybrid device can still fire this from a tap. Nothing arms.
            if (event.pointerType === "touch") return;

            // Only read a resting pose off a running loop. Re-entering during
            // the leave tween must not record the halfway values.
            if (!pan.paused()) {
              resting = {
                xPercent: gsap.getProperty(photo, "xPercent") as number,
                yPercent: gsap.getProperty(photo, "yPercent") as number,
                scale: gsap.getProperty(photo, "scale") as number,
              };
            }

            hovering = true;
            loops.forEach((loop) => loop.pause());

            gsap.to(photo, {
              scale: HOVER_SCALE,
              duration: HOVER_DURATION,
              ease: "power3.out",
              overwrite: "auto",
            });
            track(event);
          };

          const leave = () => {
            if (!hovering) return;
            hovering = false;

            xTo(resting.xPercent);
            yTo(resting.yPercent);
            gsap.to(photo, {
              scale: resting.scale,
              duration: HOVER_DURATION,
              ease: "power3.out",
              overwrite: "auto",
              // The tracked offsets land first, so the loops take over from
              // exactly the values they were paused on.
              onComplete: () => loops.forEach((loop) => loop.resume()),
            });
          };

          card.addEventListener("pointerenter", enter);
          card.addEventListener("pointermove", track);
          card.addEventListener("pointerleave", leave);

          return () => {
            card.removeEventListener("pointerenter", enter);
            card.removeEventListener("pointermove", track);
            card.removeEventListener("pointerleave", leave);
            // The hover tweens are made at event time, long after the context
            // recorded what to revert, so they are cleared by hand.
            gsap.killTweensOf(photo);
          };
        },
      );

      return () => mm.revert();
    },
    { scope },
  );

  // `display: contents` so the image stays a direct child of the card and the
  // tile's layout, its `min-h` and the caption above it are all untouched.
  return (
    <div ref={scope} className="contents">
      {children}
    </div>
  );
}
