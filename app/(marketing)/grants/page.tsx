import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageAtmosphere } from "@/components/motion/PageAtmosphere";
import { ScrollScrub } from "@/components/motion/ScrollScrub";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Grants | Ether",
  description: "Current information about grants from Ether.",
};

export default function GrantsPage() {
  return (
    <>
      <PageAtmosphere variant="edge" />
      <ScrollScrub>
        <Container>
          <section className="grid min-h-[100dvh] gap-16 pt-32 pb-24 md:grid-cols-[minmax(0,1.35fr)_minmax(240px,0.65fr)] md:items-center md:gap-20 md:pt-40 md:pb-32">
            <div>
              <p
                className="hero-in text-violet text-[12px] leading-none font-medium tracking-[0.12em] uppercase"
                style={{ "--i": 0 } as CSSProperties}
              >
                Grants
              </p>
              <h1
                style={{ "--i": 1 } as CSSProperties}
                className="hero-in text-text mt-8 max-w-[760px] text-[clamp(40px,6vw,60px)] leading-[1.5] tracking-[-0.01em]"
              >
                Ether does not list an open grant program today.
              </h1>
            </div>

            <aside
              className="hero-in border-line border-l pl-6 md:pl-8"
              style={{ "--i": 2 } as CSSProperties}
            >
              <h2 className="text-text text-[22px] leading-[30px]">
                Current boundary
              </h2>
              <p className="text-text-2 mt-4 max-w-[42ch] text-[15px] leading-[26px]">
                Ether currently provides a self-serve image generator. No grant
                application or funding program is available here.
              </p>
              <Link
                href="/product"
                className="text-lime mt-6 inline-flex text-[15px] leading-[26px] font-medium"
              >
                View the product
              </Link>
            </aside>
          </section>
        </Container>
      </ScrollScrub>
    </>
  );
}
