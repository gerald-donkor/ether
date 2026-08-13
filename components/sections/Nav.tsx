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

const NAV_ITEMS = [
  {
    key: "learn",
    label: "Learn",
    align: "left",
    destinations: [
      {
        label: "Prompt field guide",
        href: "/learn",
        description:
          "Choose a subject, setting, light and finish with more intention.",
      },
      {
        label: "Blog",
        href: "/blog",
        description: "Find Ether writing when the publication opens.",
      },
      {
        label: "Newsletter",
        href: "/newsletter",
        description: "Check the current publication and subscription status.",
      },
    ],
  },
  {
    key: "build",
    label: "Build",
    align: "right",
    destinations: [
      {
        label: "Prompt assembly",
        href: "/build",
        description:
          "Combine concrete image choices into one concise prompt.",
      },
      {
        label: "Generator guide",
        href: "/generator",
        description:
          "See the current path from instruction to a private image.",
      },
      {
        label: "Open generator",
        href: "/generate",
        description: "Create and keep images in your signed-in workspace.",
      },
    ],
  },
  {
    key: "product",
    label: "Product",
    align: "right",
    destinations: [
      {
        label: "Product overview",
        href: "/product",
        description: "Review the capabilities available in Ether today.",
      },
      {
        label: "Generation library",
        href: "/library",
        description:
          "Search, open and manage the images attached to your account.",
      },
      {
        label: "Account",
        href: "/account",
        description:
          "Review the identity and access attached to your workspace.",
      },
      {
        label: "Services",
        href: "/services",
        description: "Understand what the self-serve product provides today.",
      },
    ],
  },
  {
    key: "community",
    label: "Community",
    align: "right",
    destinations: [
      {
        label: "Community showcase",
        href: "/community",
        description: "Browse images their owners chose to publish.",
      },
      {
        label: "Grants",
        href: "/grants",
        description: "Check the current status of Ether grant programs.",
      },
      {
        label: "Careers",
        href: "/careers",
        description: "See roles Ether has made available.",
      },
    ],
  },
] as const;

type NavItem = (typeof NAV_ITEMS)[number];
type NavKey = NavItem["key"];

function panelId(kind: "desktop" | "mobile", key: NavKey) {
  return `${kind}-nav-${key}`;
}

function DestinationLinks({
  item,
  mobile = false,
  onSelect,
}: {
  item: NavItem;
  mobile?: boolean;
  onSelect: () => void;
}) {
  return (
    <ul
      className={
        mobile
          ? "border-line mt-4 space-y-1 border-l pl-5"
          : "bg-surface border-line w-[360px] space-y-1 rounded-panel border p-3"
      }
    >
      {item.destinations.map((destination) => (
        <li key={destination.href}>
          <Link
            href={destination.href}
            onClick={onSelect}
            className={`hover:bg-surface-2 focus-visible:bg-surface-2 block rounded-panel px-3 py-3 transition-colors ${
              mobile ? "rounded-l-none" : ""
            }`}
          >
            <span className="text-text block text-[14px] leading-[20px]">
              {destination.label}
            </span>
            <span className="text-text-3 mt-1 block text-[13px] leading-[22px]">
              {destination.description}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DesktopDisclosure({
  item,
  open,
  itemRef,
  triggerRef,
  onOpen,
  onToggle,
  onClose,
}: {
  item: NavItem;
  open: boolean;
  itemRef: (node: HTMLLIElement | null) => void;
  triggerRef: (node: HTMLButtonElement | null) => void;
  onOpen: () => void;
  onToggle: () => void;
  onClose: () => void;
}) {
  const id = panelId("desktop", item.key);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerActivatingRef = useRef(false);

  const clearHoverTimer = () => {
    if (hoverTimerRef.current === null) return;
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
  };

  useEffect(() => clearHoverTimer, []);

  return (
    <li
      ref={itemRef}
      className="relative"
      onPointerEnter={() => {
        if (open) return;
        clearHoverTimer();
        hoverTimerRef.current = setTimeout(onOpen, 80);
      }}
      onPointerLeave={(event) => {
        clearHoverTimer();
        if (!event.currentTarget.contains(document.activeElement)) onClose();
      }}
      onFocus={() => {
        if (!pointerActivatingRef.current) onOpen();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onClose();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onPointerDown={() => {
          clearHoverTimer();
          pointerActivatingRef.current = true;
        }}
        onClick={() => {
          onToggle();
          pointerActivatingRef.current = false;
        }}
        className="text-text hover:text-text-2 flex items-center gap-1.5 text-[15px] transition-colors"
      >
        {item.label}
        <CaretDown size={12} weight="bold" aria-hidden="true" />
      </button>

      <div
        id={id}
        hidden={!open}
        className={`absolute top-full pt-1 ${
          item.align === "right" ? "right-0" : "left-0"
        }`}
      >
        <DestinationLinks item={item} onSelect={onClose} />
      </div>
    </li>
  );
}

function MobileDisclosure({
  item,
  open,
  onToggle,
  onSelect,
}: {
  item: NavItem;
  open: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const id = panelId("mobile", item.key);

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="text-text flex w-full items-center justify-between gap-4 text-left text-3xl"
      >
        {item.label}
        <CaretDown size={16} weight="bold" aria-hidden="true" />
      </button>
      <div id={id} hidden={!open}>
        <DestinationLinks item={item} mobile onSelect={onSelect} />
      </div>
    </li>
  );
}

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopSection, setDesktopSection] = useState<NavKey | null>(null);
  const [mobileSection, setMobileSection] = useState<NavKey | null>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closerRef = useRef<HTMLButtonElement>(null);
  const desktopItemRefs = useRef<Record<NavKey, HTMLLIElement | null>>({
    learn: null,
    build: null,
    product: null,
    community: null,
  });
  const desktopTriggerRefs = useRef<Record<NavKey, HTMLButtonElement | null>>({
    learn: null,
    build: null,
    product: null,
    community: null,
  });

  useEffect(() => {
    if (!desktopSection) return;

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      const trigger = desktopTriggerRefs.current[desktopSection];
      setDesktopSection(null);
      trigger?.focus();
    };
    const onDocumentPointerDown = (event: PointerEvent) => {
      const item = desktopItemRefs.current[desktopSection];
      if (event.target instanceof Node && !item?.contains(event.target)) {
        setDesktopSection(null);
      }
    };

    document.addEventListener("keydown", onDocumentKeyDown);
    document.addEventListener("pointerdown", onDocumentPointerDown);
    return () => {
      document.removeEventListener("keydown", onDocumentKeyDown);
      document.removeEventListener("pointerdown", onDocumentPointerDown);
    };
  }, [desktopSection]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileSection(null);
        setMobileOpen(false);
      }
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
  }, [mobileOpen]);

  const closeMobile = () => {
    setMobileSection(null);
    setMobileOpen(false);
  };

  return (
    <header className="absolute inset-x-0 top-0" style={{ zIndex: z.nav }}>
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
            {NAV_ITEMS.map((item) => (
              <DesktopDisclosure
                key={item.key}
                item={item}
                open={desktopSection === item.key}
                itemRef={(node) => {
                  desktopItemRefs.current[item.key] = node;
                }}
                triggerRef={(node) => {
                  desktopTriggerRefs.current[item.key] = node;
                }}
                onOpen={() => setDesktopSection(item.key)}
                onToggle={() =>
                  setDesktopSection((current) =>
                    current === item.key ? null : item.key,
                  )
                }
                onClose={() => setDesktopSection(null)}
              />
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
            onClick={() => setMobileOpen(true)}
            className="text-text lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            <List size={26} aria-hidden="true" />
            <span className="sr-only">Open menu</span>
          </button>
        </nav>
      </Container>

      {mobileOpen ? (
        <div
          id="mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Main menu"
          className="bg-ink fixed inset-0 overscroll-contain lg:hidden"
          style={{ zIndex: z.menu }}
        >
          <Container width="wide" className="flex h-full flex-col">
            <div className="flex h-[72px] shrink-0 items-center justify-between">
              <Wordmark />
              <button
                ref={closerRef}
                type="button"
                onClick={closeMobile}
                className="text-text"
              >
                <X size={26} aria-hidden="true" />
                <span className="sr-only">Close menu</span>
              </button>
            </div>
            <ul className="flex flex-1 flex-col gap-6 overflow-y-auto pt-8 pb-10">
              {NAV_ITEMS.map((item) => (
                <MobileDisclosure
                  key={item.key}
                  item={item}
                  open={mobileSection === item.key}
                  onToggle={() =>
                    setMobileSection((current) =>
                      current === item.key ? null : item.key,
                    )
                  }
                  onSelect={closeMobile}
                />
              ))}
              <Show when="signed-out">
                <li>
                  <Link
                    href="/sign-in"
                    onClick={closeMobile}
                    className="text-text block text-3xl"
                  >
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link
                    href="/sign-up"
                    onClick={closeMobile}
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
                    onClick={closeMobile}
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
