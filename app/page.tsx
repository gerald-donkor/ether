import { Nav } from "@/components/sections/Nav";
import { Hero } from "@/components/sections/Hero";
import { LogoWall } from "@/components/sections/LogoWall";
import { Features } from "@/components/sections/Features";
import { Stats } from "@/components/sections/Stats";
import { Gallery } from "@/components/sections/Gallery";
import { Footer } from "@/components/sections/Footer";

export default function Page() {
  return (
    <>
      <a
        href="#main"
        className="bg-lime text-ink rounded-pill sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-5 focus:py-2.5 focus:text-[14px] focus:font-medium"
      >
        Skip to content
      </a>
      <Nav />
      <main id="main" className="flex-1">
        <Hero />
        <LogoWall />
        <Features />
        <Stats />
        <Gallery />
      </main>
      <Footer />
    </>
  );
}
