"use client";

import { useEffect, useRef, useState } from "react";
/* Deep imports: the package root is a barrel over ~9000 icons. */
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { List } from "@phosphor-icons/react/dist/ssr/List";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import { Wordmark } from "@/components/brand/Wordmark";
import { Container } from "@/components/ui/Container";
import { z } from "@/lib/z";

const LINKS = ["Learn", "Build", "Product", "Community"] as const;

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
          <a href="#top" className="rounded-sm">
            <Wordmark />
            <span className="sr-only">Ether home</span>
          </a>

          <ul className="hidden items-center gap-8 lg:flex">
            {LINKS.map((label) => (
              <li key={label}>
                <a
                  href="#"
                  className="text-text hover:text-text-2 flex items-center gap-1.5 text-[15px] transition-colors"
                >
                  {label}
                  <CaretDown size={12} weight="bold" aria-hidden="true" />
                </a>
              </li>
            ))}
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
              {LINKS.map((label) => (
                <li key={label}>
                  <a href="#" className="text-text block text-3xl">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
