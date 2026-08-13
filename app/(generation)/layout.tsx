import type { ReactNode } from "react";
import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { Wordmark } from "@/components/brand/Wordmark";
import { Container } from "@/components/ui/Container";
import { z } from "@/lib/z";

export default function GenerationLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#generation-main"
        className="bg-lime text-ink rounded-pill sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:px-5 focus:py-2.5 focus:text-[14px] focus:font-medium"
        style={{ zIndex: z.menu }}
      >
        Skip to content
      </a>
      <header className="border-line border-b">
        <Container className="flex h-16 items-center justify-between gap-5">
          <Link href="/" className="rounded-sm">
            <Wordmark />
            <span className="sr-only">Ether home</span>
          </Link>
          <nav aria-label="Generation" className="flex items-center gap-5">
            <Link
              href="/community"
              className="text-text-2 hover:text-text text-[14px] transition-colors"
            >
              Community
            </Link>
            <Link
              href="/generate"
              className="text-text-2 hover:text-text text-[14px] transition-colors"
            >
              Generate
            </Link>
            <Show when="signed-in">
              <UserButton />
            </Show>
            <Show when="signed-out">
              <Link
                href="/sign-in"
                className="text-text-2 hover:text-text text-[14px] transition-colors"
              >
                Sign in
              </Link>
            </Show>
          </nav>
        </Container>
      </header>
      <main id="generation-main" className="flex-1">
        {children}
      </main>
    </>
  );
}
