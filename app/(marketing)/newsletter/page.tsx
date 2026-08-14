import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { PageAtmosphere } from "@/components/motion/PageAtmosphere";
import { ScrollScrub } from "@/components/motion/ScrollScrub";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Newsletter | Ether",
  description: "Current publication and subscription status for Ether.",
};

export default function NewsletterPage() {
  return (
    <>
      <PageAtmosphere variant="column" />
      <ScrollScrub>
        <Container>
          <section className="grid min-h-[100dvh] content-center gap-16 pt-32 pb-24 md:grid-cols-[minmax(220px,0.55fr)_minmax(0,1.45fr)] md:gap-20 md:pt-40 md:pb-32">
            <header className="md:self-start">
              {/* No eyebrow: the h1 is already the page name. */}
              <h1
                className="hero-in text-text text-[clamp(40px,6vw,60px)] leading-[1.5] tracking-[-0.01em]"
                style={{ "--i": 0 } as CSSProperties}
              >
                Newsletter
              </h1>
            </header>

            <div
              className="hero-in bg-surface rounded-panel p-8 md:p-12 lg:p-16"
              style={{ "--i": 1 } as CSSProperties}
            >
              <p className="text-violet text-[22px] leading-[30px]">
                No dispatch is active.
              </p>
              <h2 className="text-text mt-8 max-w-[680px] text-[clamp(30px,4vw,40px)] leading-[1.45] tracking-[-0.01em]">
                Ether does not currently publish a newsletter or accept
                subscriptions.
              </h2>
              <p className="text-text-2 mt-8 max-w-[58ch] text-[15px] leading-[26px]">
                There is no email form or mailing list connected to this page.
              </p>
            </div>
          </section>
        </Container>
      </ScrollScrub>
    </>
  );
}
