import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageAtmosphere } from "@/components/motion/PageAtmosphere";
import { ScrollScrub } from "@/components/motion/ScrollScrub";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { getCommunityGenerations } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "Community | Ether",
  description:
    "Images their owners made public with Ether. Prompts remain private.",
};

const COMMUNITY_LIMIT = 12;
const PUBLIC_ALT = "An image generated with Ether and published by its owner.";
const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

/** One deliberate proof-sheet pass. Mobile removes every offset and span. */
const PROOF_SHEET_PLACEMENTS = [
  "md:col-span-7",
  "md:col-start-9 md:col-span-4 md:mt-24",
  "md:col-start-2 md:col-span-4",
  "md:col-start-7 md:col-span-6 md:mt-16",
  "md:col-span-5",
  "md:col-start-8 md:col-span-5 md:mt-24",
  "md:col-start-3 md:col-span-7",
  "md:col-start-10 md:col-span-3 md:mt-16",
  "md:col-span-6",
  "md:col-start-8 md:col-span-5 md:mt-24",
  "md:col-start-2 md:col-span-4",
  "md:col-start-7 md:col-span-6 md:mt-16",
] as const;

export default async function CommunityPage() {
  const generations = await getCommunityGenerations(COMMUNITY_LIMIT);

  return (
    <>
      <PageAtmosphere variant="masthead" />
      <ScrollScrub>
        <Container className="py-24 md:py-32">
          <section aria-labelledby="community-title">
            <p
              className="hero-in text-violet text-[12px] leading-none font-medium tracking-[0.12em] uppercase"
              style={{ "--i": 0 } as CSSProperties}
            >
              Public work
            </p>
            <h1
              id="community-title"
              className="hero-in text-text mt-8 max-w-[900px] text-[clamp(40px,6vw,60px)] leading-[1.45] tracking-[-0.01em]"
              style={{ "--i": 1 } as CSSProperties}
            >
              Work made public by its owners.
            </h1>
            <p
              className="hero-in text-text-2 mt-5 max-w-[62ch] text-[15px] leading-[26px]"
              style={{ "--i": 2 } as CSSProperties}
            >
              Only images their owners chose to publish appear here. Prompts stay
              private.
            </p>

            {generations.length > 0 ? (
              <ul className="mt-16 grid grid-cols-1 gap-y-16 md:grid-cols-12 md:gap-x-4 md:gap-y-24">
                {generations.map((generation, index) => (
                  <li
                    key={generation.id}
                    className={PROOF_SHEET_PLACEMENTS[index]}
                  >
                    <figure>
                      <Link href={`/g/${generation.id}`} className="rounded-card group block">
                        <Image
                          src={generation.imageUrl}
                          alt={PUBLIC_ALT}
                          width={generation.width}
                          height={generation.height}
                          sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1279px) 58vw, 630px"
                          className="rounded-card h-auto w-full"
                        />
                      </Link>
                      <figcaption className="text-text-3 mt-3 text-[13px] leading-[22px]">
                        {dateFormat.format(generation.createdAt)}
                      </figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rule mt-16 pt-8">
                <p className="text-text-2 max-w-[52ch] text-[15px] leading-[26px]">
                  There is no public work to show yet.
                </p>
                <Button href="/generate" className="mt-6 px-6 py-3 text-[15px]">
                  Generate
                </Button>
              </div>
            )}
          </section>
        </Container>
      </ScrollScrub>
    </>
  );
}
