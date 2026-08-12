import type { CSSProperties } from "react";
import Image from "next/image";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { Mark } from "@/components/brand/Mark";
import { MarkSpiral } from "@/components/motion/MarkSpiral";
import { Container } from "@/components/ui/Container";
import { z } from "@/lib/z";

/* Hoisted: static across every render. */
const AVATARS = [
  { src: "/assets/ui/img/avatar-1.jpg", alt: "" },
  { src: "/assets/ui/img/avatar-2.jpg", alt: "" },
  { src: "/assets/ui/img/avatar-3.jpg", alt: "" },
  { src: "/assets/ui/img/avatar-4.jpg", alt: "" },
];

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: "var(--grad-hero)", zIndex: z.atmosphere }}
      />

      <Container width="wide" className="relative">
        <div className="pt-[112px] pb-16 md:pb-24">
          {/* Headline left, framing paragraph right. */}
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="hero-in lg:col-span-8" style={{ "--i": 0 } as CSSProperties}>
              <h1
                id="hero-title"
                className="text-text text-[clamp(34px,6vw,60px)] leading-[1.45] font-normal tracking-[-0.01em]"
              >
                Harnessing Artificial Intelligence Tools for Naturally Image
                Generator
              </h1>
            </div>

            <div
              className="hero-in lg:col-span-4 lg:pt-3"
              style={{ "--i": 1 } as CSSProperties}
            >
              <p aria-hidden="true" className="text-2xl">
                <span role="img">🔥</span> <span role="img">😍</span>{" "}
                <span role="img">👍</span>
              </p>
              <p className="text-text-2 mt-4 max-w-[42ch] text-[15px] leading-[26px]">
                In the realm of creativity, technology has become a powerful ally
                for artists, writers, designers, and creators of all kinds.
                Artificially intelligent (AI) tools have emerged as valuable
                companions, assisting naturally creative humans in their creative
                processes.
              </p>
            </div>
          </div>

          {/* Five tiles, five things to say. See design-system.md 2.3. */}
          <div className="hero-in" style={{ "--i": 2 } as CSSProperties}>
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:grid-rows-2">
              {/* Generated image */}
              <div className="rounded-card relative overflow-hidden sm:col-span-2 lg:col-span-5 lg:row-span-2">
                <Image
                  src="/assets/ui/img/macaw.jpg"
                  alt="A macaw rendered by Ether, its feathers beaded with water."
                  width={1060}
                  height={606}
                  priority
                  className="h-full min-h-[220px] w-full object-cover"
                />
                <span
                  className="text-text absolute bottom-4 left-5 text-[15px] font-medium"
                  style={{ zIndex: z.overlay }}
                >
                  AI Generator
                </span>
              </div>

              {/* Projects */}
              <div className="rounded-card bg-lime text-ink flex min-h-[110px] items-center px-7 py-6 lg:col-span-3">
                <p className="text-[30px] leading-[36px] font-semibold tracking-[-0.01em]">
                  300+
                  <br />
                  Projects
                </p>
              </div>

              {/* Brand block */}
              <div
                className="rounded-card flex min-h-[170px] items-center justify-center overflow-hidden p-6 lg:col-span-4"
                style={{ background: "var(--grad-block)" }}
              >
                <MarkSpiral>
                  <Mark className="h-auto w-[79%] max-w-[240px]" />
                </MarkSpiral>
              </div>

              {/* Community */}
              <div
                className="rounded-card flex flex-col justify-between gap-5 px-7 py-6 lg:col-span-3"
                style={{ backgroundColor: "var(--color-violet)" }}
              >
                <p className="text-text text-[19px] leading-[26px] font-medium">
                  We have the best AI image generator
                </p>
                <div className="flex items-center gap-3">
                  <ul className="flex -space-x-3">
                    {AVATARS.map((a) => (
                      <li key={a.src}>
                        <Image
                          src={a.src}
                          alt={a.alt}
                          width={400}
                          height={400}
                          className="ring-violet size-8 rounded-pill object-cover ring-2"
                        />
                      </li>
                    ))}
                  </ul>
                  <p className="text-text/85 text-[11px] leading-[15px]">
                    Join our Community.
                    <br />
                    We are waiting for you
                  </p>
                </div>
              </div>

              {/* Primary action */}
              <a
                href="#generate"
                className="rounded-card bg-lime text-ink hover:bg-lime/90 flex min-h-[86px] items-center justify-center gap-2 text-[26px] font-medium transition-transform duration-200 ease-(--ease-out) active:scale-[0.98] sm:col-span-2 lg:col-span-4"
              >
                Try Free
                <ArrowUpRight size={24} weight="bold" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
