import type { ReactNode } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Wordmark } from "@/components/brand/Wordmark";
import { Container } from "@/components/ui/Container";
import { requireUserId } from "@/lib/auth";
import { z } from "@/lib/z";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireUserId();

  return (
    <>
      <a
        href="#app-main"
        className="bg-lime text-ink rounded-pill sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:px-5 focus:py-2.5 focus:text-[14px] focus:font-medium"
        style={{ zIndex: z.menu }}
      >
        Skip to content
      </a>
      <header className="border-line border-b">
        <Container className="flex h-16 items-center justify-between">
          <Link href="/" className="rounded-sm">
            <Wordmark />
            <span className="sr-only">Ether home</span>
          </Link>
          <nav aria-label="Application" className="flex items-center gap-5">
            <Link
              href="/generate"
              className="text-text-2 hover:text-text text-[14px] transition-colors"
            >
              Generate
            </Link>
            <Link
              href="/account"
              className="text-text-2 hover:text-text text-[14px] transition-colors"
            >
              Account
            </Link>
            <UserButton />
          </nav>
        </Container>
      </header>
      <main id="app-main" className="flex-1">
        {children}
      </main>
    </>
  );
}
