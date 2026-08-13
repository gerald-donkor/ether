import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * Two variants only.
 *
 * `primary` is lime on ink. Lime never carries white text: white on #D2FF3A is
 * 1.3:1, while ink on lime is 15.9:1. See design-system.md 1.1.
 * `ghost` is a hairline pill for secondary media links.
 */
type Variant = "primary" | "ghost";

/**
 * The pill's static half: shape, layout and type, with no transition, no hover
 * and no press response. Exported so a non-interactive lockup can wear the same
 * pill without copying the class string or inheriting affordances it cannot
 * honour. See design-system.md 2.4.
 */
export const pillShape =
  "inline-flex items-center justify-center gap-2 rounded-pill font-medium whitespace-nowrap";

/** The ghost pill's static half: hairline border, body text. */
export const pillGhostSurface = "border border-line text-text";

/** What makes a pill feel pressable. Only an interactive pill gets this. */
const pressable =
  "transition-transform duration-200 ease-(--ease-out) active:scale-[0.98]";

const base = `${pillShape} ${pressable}`;

const variants: Record<Variant, string> = {
  primary: "bg-lime text-ink hover:bg-lime/90",
  ghost: `${pillGhostSurface} hover:border-text-3`,
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: {
  variant?: Variant;
  children: ReactNode;
} & ComponentPropsWithoutRef<"a">) {
  return (
    <a className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </a>
  );
}
