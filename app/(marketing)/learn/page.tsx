import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Learn to write image prompts | Ether",
  description:
    "A practical field guide to choosing the subject, setting, light and finish for an image prompt.",
};

const FIRST_NOTES = [
  {
    term: "Subject",
    copy: "Name the main thing clearly. Add only the details that change its form, material or posture.",
  },
  {
    term: "Setting",
    copy: "Place the subject in a specific environment. Describe the space, distance and surrounding objects that matter.",
  },
] as const;

const LAST_NOTES = [
  {
    term: "Light",
    copy: "Describe the light by its direction, softness and source. This gives the scene a deliberate sense of depth.",
  },
  {
    term: "Finish",
    copy: "Close with the visual treatment you want, such as a photograph, a print or a clean digital illustration.",
  },
] as const;

function PromptBand({
  term,
  copy,
  align,
}: {
  term: string;
  copy: string;
  align: "start" | "end";
}) {
  return (
    <article
      className={`border-line grid gap-4 border-t py-8 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] md:gap-12 md:py-10 ${
        align === "end" ? "md:ml-24" : "md:mr-24"
      }`}
    >
      <h2 className="text-violet text-[22px] leading-[30px]">{term}</h2>
      <p className="text-text-2 max-w-[65ch] text-[15px] leading-[26px]">
        {copy}
      </p>
    </article>
  );
}

export default function LearnPage() {
  return (
    <Container>
      <div className="pt-32 pb-24 md:pt-40 md:pb-32">
        <header className="max-w-[720px] pb-16 md:pb-24">
          <h1 className="text-text text-[clamp(40px,6vw,60px)] leading-[1.5] tracking-[-0.01em]">
            Make each part of the prompt deliberate.
          </h1>
          <p className="text-text-2 mt-6 max-w-[60ch] text-[15px] leading-[26px]">
            A useful prompt gives the image a subject, a place, a source of
            light and a clear finish. Treat these as choices, not a formula.
          </p>
        </header>

        <section aria-label="Prompt field guide">
          {FIRST_NOTES.map((note, index) => (
            <PromptBand
              key={note.term}
              {...note}
              align={index % 2 === 0 ? "start" : "end"}
            />
          ))}

          <figure className="my-16 overflow-hidden rounded-card md:my-24">
            <Image
              src="/assets/ui/img/gallery-coast.jpg"
              alt="A tidal pool below a cliff at sunset, with warm light across the water."
              width={1200}
              height={628}
              sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1279px) calc(100vw - 64px), 1080px"
              className="h-auto w-full object-cover"
            />
          </figure>

          {LAST_NOTES.map((note, index) => (
            <PromptBand
              key={note.term}
              {...note}
              align={index % 2 === 0 ? "start" : "end"}
            />
          ))}
        </section>

        <div className="pt-16 md:pt-24">
          <Button href="/generate" className="px-6 py-3 text-[15px]">
            Open generator
          </Button>
        </div>
      </div>
    </Container>
  );
}
