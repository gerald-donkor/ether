import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Image generator | Ether",
  description:
    "See how Ether turns a text prompt into a private square image.",
};

const WORKFLOW = [
  {
    title: "Write what the image needs",
    copy: "Describe the subject, setting, light and finish in a single prompt.",
  },
  {
    title: "Request a square result",
    copy: "Ether sends the prompt to an image model and requests one square image.",
  },
  {
    title: "Return to recent work",
    copy: "The completed image joins your private recent generations while you are signed in.",
  },
] as const;

export default function GeneratorPage() {
  return (
    <Container>
      <div className="pt-32 pb-24 md:pt-40 md:pb-32">
        <header className="max-w-[760px]">
          <h1 className="text-text text-[clamp(40px,6vw,60px)] leading-[1.5] tracking-[-0.01em]">
            A working path from instruction to image.
          </h1>
          <p className="text-text-2 mt-6 max-w-[60ch] text-[15px] leading-[26px]">
            Ether keeps the current generation loop direct and keeps recent
            work private to its owner.
          </p>
        </header>

        <section aria-label="Generator workflow" className="mt-16 md:mt-24">
          {WORKFLOW.map((item, index) => (
            <article
              key={item.title}
              className={`border-line grid gap-4 border-t py-10 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-16 md:py-12 ${
                index === 1 ? "md:ml-24" : index === 2 ? "md:ml-48" : ""
              }`}
            >
              <h2 className="text-text text-[22px] leading-[30px]">
                {item.title}
              </h2>
              <p className="text-text-2 max-w-[58ch] text-[15px] leading-[26px]">
                {item.copy}
              </p>
            </article>
          ))}
        </section>

        <figure className="mt-8 md:mt-12 md:ml-48">
          <div className="overflow-hidden rounded-panel">
            <Image
              src="/assets/ui/img/gallery-coast.jpg"
              alt="A tidal pool below a cliff at sunset, used as an artboard reference."
              width={1200}
              height={628}
              sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1279px) calc(100vw - 256px), 888px"
              className="aspect-[12/7] w-full object-cover"
            />
          </div>
          <figcaption className="text-text-3 mt-3 text-[13px] leading-[22px]">
            Reference photograph from the Ether artboard.
          </figcaption>
        </figure>

        <div className="pt-16 md:pt-24 md:pl-48">
          <Button href="/generate" className="px-6 py-3 text-[15px]">
            Open generator
          </Button>
        </div>
      </div>
    </Container>
  );
}
