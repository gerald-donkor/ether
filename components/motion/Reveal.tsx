import type { ReactNode } from "react";

/**
 * Scroll reveal.
 *
 * This is a server component on purpose. The animation is CSS scroll-driven
 * (see `.reveal` in globals.css), so the content is present and visible in the
 * server-rendered HTML and there is no client bundle, no observer, and nothing
 * that stays invisible if a script fails. Browsers without
 * `animation-timeline` render the content plainly.
 */
export function Reveal({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`reveal ${className}`}>{children}</div>;
}
