"use client";

import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useEffect, useRef } from "react";

const FORMAT = { useGrouping: false } as const;

/**
 * Counts a stat up once, when it scrolls into view.
 *
 * The motion value starts at the final figure, so the server-rendered HTML
 * carries the real number and a visitor without JavaScript reads "10.2M+"
 * rather than "0". The reset to zero happens on the client only, and only
 * while the stat is still off screen, so the count is never seen rewinding.
 *
 * The running value lives in a motion value rather than state: counting in
 * state would re-render the tree on every frame.
 */
export function StatCounter({
  value,
  decimals = 0,
  suffix = "",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();

  const count = useMotionValue(value);
  const text = useTransform(
    count,
    (latest) =>
      latest.toLocaleString("en-US", {
        ...FORMAT,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }) + suffix,
  );

  /* Arm the counter, but only while it is still out of sight. */
  useEffect(() => {
    if (reduce || inView) return;
    count.jump(0);
  }, [reduce, inView, count]);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(count, value, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [inView, reduce, count, value]);

  return (
    <span ref={ref}>
      <motion.span>{text}</motion.span>
    </span>
  );
}
