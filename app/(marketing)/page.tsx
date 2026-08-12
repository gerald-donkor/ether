import { Features } from "@/components/sections/Features";
import { Gallery } from "@/components/sections/Gallery";
import { Hero } from "@/components/sections/Hero";
import { LogoWall } from "@/components/sections/LogoWall";
import { Stats } from "@/components/sections/Stats";

export default function Page() {
  return (
    <>
      <Hero />
      <LogoWall />
      <Features />
      <Stats />
      <Gallery />
    </>
  );
}
