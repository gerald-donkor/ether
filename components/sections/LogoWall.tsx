import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/motion/Reveal";

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

          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-9 gap-y-7 md:gap-x-12">
            {PARTNERS.map((p) => (
              <li key={p.src}>
                <Image
                  src={p.src}
                  alt={p.name}
                  width={p.w}
                  height={p.h}
                  className="h-5 w-auto opacity-85 md:h-[22px]"
                />
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}
