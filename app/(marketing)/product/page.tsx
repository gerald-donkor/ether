import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Product capabilities | Ether",
  description:
    "See the image generation capabilities available in Ether today.",
};

const CAPABILITIES = [
  {
    title: "Prompt input",
    copy: "Describe the image you want in a single text prompt.",
  },
  {
    title: "Square result",
    copy: "Ether requests one square image for each submitted prompt.",
  },
  {
    title: "Private recent history",
    copy: "Your recent generations remain available to you on the generator page.",
  },
  {
    title: "Account identity",
    copy: "Sign-in keeps generation history scoped to its owner.",
  },
] as const;

export default function ProductPage() {
  return (
    <Container>
      <div className="pt-32 pb-24 md:pt-40 md:pb-32">
        <figure>
          <div className="overflow-hidden rounded-card">
            <Image
              src="/assets/ui/img/macaw.jpg"
              alt="A blue and yellow macaw seen through green leaves."
              width={1060}
              height={606}
              sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1279px) calc(100vw - 64px), 1080px"
              className="h-auto w-full object-cover"
            />
          </div>
          <figcaption className="text-text-3 mt-3 text-[13px] leading-[22px]">
            Reference photograph from the Ether artboard.
          </figcaption>
        </figure>

        <header className="max-w-[760px] pt-16 md:pt-24">
          <h1 className="text-text text-[clamp(40px,6vw,60px)] leading-[1.5] tracking-[-0.01em]">
            A direct path from prompt to image.
          </h1>
          <p className="text-text-2 mt-6 max-w-[60ch] text-[15px] leading-[26px]">
            Ether keeps the current workflow focused. Write the prompt, make
            one image and return to recent work while signed in.
          </p>
        </header>

        <section
          aria-label="Current product capabilities"
          className="mt-16 border-t border-line md:mt-24"
        >
          {CAPABILITIES.map((capability, index) => (
            <article
              key={capability.title}
              className={`grid gap-3 py-8 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] md:gap-12 md:py-10 ${
                index === 0 ? "" : "border-line border-t"
              }`}
            >
              <h2 className="text-text text-[22px] leading-[30px]">
                {capability.title}
              </h2>
              <p className="text-text-2 max-w-[65ch] text-[15px] leading-[26px]">
                {capability.copy}
              </p>
            </article>
          ))}
        </section>

        <div className="pt-16 md:pt-24">
          <Button href="/generate" className="px-6 py-3 text-[15px]">
            Use the generator
          </Button>
        </div>
      </div>
    </Container>
  );
}
