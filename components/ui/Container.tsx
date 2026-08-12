import type { ReactNode } from "react";

/**
 * The page's two measures. `wide` carries the masthead and footer; `inner`
 * carries everything between them. The step inward after the hero is a
 * deliberate structural move, see design-system.md 1.4.
 */
export function Container({
  width = "inner",
  className = "",
  children,
}: {
  width?: "wide" | "inner";
  className?: string;
  children: ReactNode;
}) {
  const measure =
    width === "wide" ? "max-w-(--container-wide)" : "max-w-(--container-inner)";

  return (
    <div className={`mx-auto w-full px-5 md:px-8 xl:px-0 ${measure} ${className}`}>
      {children}
    </div>
  );
}
