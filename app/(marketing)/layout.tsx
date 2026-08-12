import type { ReactNode } from "react";
import { Footer } from "@/components/sections/Footer";
import { Nav } from "@/components/sections/Nav";
import { z } from "@/lib/z";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="bg-lime text-ink rounded-pill sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:px-5 focus:py-2.5 focus:text-[14px] focus:font-medium"
        style={{ zIndex: z.menu }}
      >
        Skip to content
      </a>
      <Nav />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
