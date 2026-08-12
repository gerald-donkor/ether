"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
/* Deep imports: the package root is a barrel over ~9000 icons. */
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { List } from "@phosphor-icons/react/dist/ssr/List";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import { Wordmark } from "@/components/brand/Wordmark";
import { Container } from "@/components/ui/Container";
import { z } from "@/lib/z";

const LINKS = [
  { label: "Learn", href: "/learn" },
  { label: "Build", href: "/build" },
  { label: "Product", href: "/product" },
  { label: "Community", href: "/community" },
] as const;

export function Nav() {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    /* Move focus into the panel, and hand it back to the trigger on close. */
    const opener = openerRef.current;
    closerRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener?.focus();
    };
  }, [open]);

  return (
    <header
      className="absolute inset-x-0 top-0"
      style={{ zIndex: z.nav }}
    >
      <Container width="wide">
        <nav
          aria-label="Main"
          className="flex h-[72px] items-center justify-between"
        >
          <Link href="/" className="rounded-sm">
            <Wordmark />
            <span className="sr-only">Ether home</span>
          </Link>

          <ul className="hidden items-center gap-8 lg:flex">
            {LINKS.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-text hover:text-text-2 flex items-center gap-1.5 text-[15px] transition-colors"
                >
                  {label}
                  <CaretDown size={12} weight="bold" aria-hidden="true" />
                </Link>
              </li>
            ))}
            <Show when="signed-out">
              <li>
                <Link
                  href="/sign-in"
                  className="text-text hover:text-text-2 text-[15px] transition-colors"
                >
                  Sign in
                </Link>
              </li>
              <li>
                <Link
                  href="/sign-up"
                  className="bg-lime text-ink rounded-pill inline-flex px-5 py-2.5 text-[14px] font-medium whitespace-nowrap transition-transform duration-200 ease-(--ease-out) active:scale-[0.98]"
                >
                  Try Free ↗
                </Link>
              </li>
            </Show>
            <Show when="signed-in">
              <li>
                <Link
                  href="/generate"
                  className="text-text hover:text-text-2 text-[15px] transition-colors"
                >
                  Generate
                </Link>
              </li>
              <li className="flex items-center">
                <UserButton />
              </li>
            </Show>
          </ul>

          <button
            ref={openerRef}
            type="button"
            onClick={() => setOpen(true)}
            className="text-text lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            <List size={26} aria-hidden="true" />
            <span className="sr-only">Open menu</span>
          </button>
        </nav>
      </Container>

      {open ? (
        <div
          id="mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Main menu"
          className="bg-ink fixed inset-0 overscroll-contain lg:hidden"
          style={{ zIndex: z.menu }}
        >
          <Container width="wide">
            <div className="flex h-[72px] items-center justify-between">
              <Wordmark />
              <button
                ref={closerRef}
                type="button"
                onClick={() => setOpen(false)}
                className="text-text"
              >
                <X size={26} aria-hidden="true" />
                <span className="sr-only">Close menu</span>
              </button>
            </div>
            <ul className="mt-8 flex flex-col gap-6">
              {LINKS.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className="text-text block text-3xl"
                  >
                    {label}
                  </Link>
                </li>
              ))}
              <Show when="signed-out">
                <li>
                  <Link
                    href="/sign-in"
                    onClick={() => setOpen(false)}
                    className="text-text block text-3xl"
                  >
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link
                    href="/sign-up"
                    onClick={() => setOpen(false)}
                    className="bg-lime text-ink rounded-pill inline-flex px-6 py-3 text-[17px] font-medium"
                  >
                    Try Free ↗
                  </Link>
                </li>
              </Show>
              <Show when="signed-in">
                <li>
                  <Link
                    href="/generate"
                    onClick={() => setOpen(false)}
                    className="text-text block text-3xl"
                  >
                    Generate
                  </Link>
                </li>
                <li className="flex items-center gap-3">
                  <UserButton showName />
                </li>
              </Show>
            </ul>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
