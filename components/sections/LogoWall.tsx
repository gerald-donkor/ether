import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/motion/Reveal";
import { LogoMarquee } from "@/components/motion/LogoMarquee";

/**
 * The seven marks from the reference artboard, extracted with their alpha
 * masks. Logos only: no category label sits under any of them.
 *
 * Simple Icons carries only four of these seven, and mixing two sources in one
 * row reads as inconsistent, so all seven come from the reference.
 */
const PARTNERS = [
  { src: "/assets/ui/logos/brave.png", name: "Brave", w: 189, h: 62 },
  { src: "/assets/ui/logos/circle.png", name: "Circle", w: 141, h: 37 },
  { src: "/assets/ui/logos/discord.png", name: "Discord", w: 124, h: 24 },
  { src: "/assets/ui/logos/google.png", name: "Google", w: 96, h: 44 },
  { src: "/assets/ui/logos/jump.png", name: "Jump", w: 99, h: 31 },
  {
    src: "/assets/ui/logos/lollapalooza.png",
    name: "Lollapalooza",
    w: 574,
    h: 120,
  },
  { src: "/assets/ui/logos/magic-eden.png", name: "Magic Eden", w: 157, h: 27 },
];

/**
 * Four passes of the list, so the track measures four times one pass and a
 * 25% travel lands exactly on the seam. Passes two through four are decorative
 * repeats: a screen reader hears seven partners, not twenty-eight.
 */
const PASSES = [0, 1, 2, 3];

export function LogoWall() {
  return (
    <section aria-labelledby="partners-title" className="py-20 md:py-28">
      <Container>
        <Reveal>
          <h2
            id="partners-title"
            className="text-violet text-center text-[11px] leading-[1.6] font-medium tracking-[0.12em] uppercase md:text-[12px]"
          >
            Powering tools and integrations from companies all around the world
          </h2>
        </Reveal>
      </Container>

      {/* Outside Container so the strip runs full bleed and clips at the
          screen edges, the way the reference screencast does. */}
      <Reveal className="mt-10">
        <LogoMarquee>
          <ul
            data-logo-marquee
            className="flex w-max items-center will-change-transform"
          >
            {PASSES.map((pass) =>
              PARTNERS.map((p) => (
                <li
                  key={`${pass}-${p.src}`}
                  aria-hidden={pass > 0 || undefined}
                  className="mr-9 shrink-0 md:mr-12"
                >
                  <Image
                    src={p.src}
                    alt={p.name}
                    width={p.w}
                    height={p.h}
                    className="h-5 w-auto opacity-85 md:h-[22px]"
                  />
                </li>
              )),
            )}
          </ul>
        </LogoMarquee>
      </Reveal>
    </section>
  );
}
