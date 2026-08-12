import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Build an image prompt | Ether",
  description:
    "Assemble a concise image prompt from concrete choices about subject, setting, light and finish.",
};

const CLAUSES = [
  {
    term: "Subject",
    phrase: "A lone swimmer",
    note: "Start with the image's anchor.",
  },
  {
    term: "Setting",
    phrase: "in a coastal pool",
    note: "Give the subject a clear place.",
  },
  {
    term: "Light",
    phrase: "at late sunset",
    note: "Set direction and atmosphere.",
  },
  {
    term: "Finish",
    phrase: "as a wide photograph",
    note: "Name the intended treatment.",
  },
] as const;

export default function BuildPage() {
  return (
    <Container>
      <div className="pt-32 pb-24 md:pt-40 md:pb-32">
        <header className="max-w-[760px]">
          <h1 className="text-text text-[clamp(40px,6vw,60px)] leading-[1.5] tracking-[-0.01em]">
            Assemble the prompt from concrete choices.
          </h1>
          <p className="text-text-2 mt-6 max-w-[60ch] text-[15px] leading-[26px]">
            Begin with what must be present. Add only the setting, light and
            finish that shape the result.
          </p>
        </header>

        <section
          aria-label="Prompt assembly"
          className="mt-16 grid gap-10 md:mt-24 md:grid-cols-2 md:gap-x-12 md:gap-y-16 lg:grid-cols-4 lg:gap-8"
        >
          {CLAUSES.map((clause) => (
            <article key={clause.term} className="min-w-0">
              <h2 className="text-violet text-[12px] leading-none font-medium tracking-[0.12em] uppercase">
                {clause.term}
              </h2>
              <p className="text-text mt-5 text-[22px] leading-[30px]">
                {clause.phrase}
              </p>
              <p className="text-text-3 mt-4 max-w-[24ch] text-[13px] leading-[22px]">
                {clause.note}
              </p>
            </article>
          ))}
        </section>

        <figure className="mt-16 md:mt-24">
          <div className="overflow-hidden rounded-panel">
            <Image
              src="/assets/ui/img/gallery-coast.jpg"
              alt="A tidal pool below a cliff at sunset, with warm light across the water."
              width={1200}
              height={628}
              sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1279px) calc(100vw - 64px), 1080px"
              className="aspect-[12/7] w-full object-cover"
            />
          </div>
          <figcaption className="text-text-3 mt-3 text-[13px] leading-[22px]">
            Reference photograph from the Ether artboard.
          </figcaption>
        </figure>

        <div className="pt-16 md:pt-24">
          <Button href="/generate" className="px-6 py-3 text-[15px]">
            Build in Ether
          </Button>
        </div>
      </div>
    </Container>
  );
}
