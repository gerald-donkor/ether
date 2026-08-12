import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * Two variants only.
 *
 * `primary` is lime on ink. Lime never carries white text: white on #D2FF3A is
 * 1.3:1, while ink on lime is 15.9:1. See design-system.md 1.1.
 * `ghost` is a hairline pill for secondary media links.
 */
type Variant = "primary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-medium whitespace-nowrap transition-transform duration-200 ease-(--ease-out) active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary: "bg-lime text-ink hover:bg-lime/90",
  ghost: "border border-line text-text hover:border-text-3",
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
