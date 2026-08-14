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

/**
 * What makes a pill feel pressable. Only an interactive pill gets this.
 * Exported so a `<button>` elsewhere wears the same response without copying
 * the durations and the easing token.
 */
export const pillPressable =
  "transition-transform duration-200 ease-(--ease-out) active:scale-[0.98]";

/** The primary pill's surface: lime on ink, with its hover. */
export const pillPrimarySurface = "bg-lime text-ink hover:bg-lime/90";

const base = `${pillShape} ${pillPressable}`;

const variants: Record<Variant, string> = {
  primary: pillPrimarySurface,
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
