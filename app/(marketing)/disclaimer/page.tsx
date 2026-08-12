import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Product disclaimer | Ether",
  description: "Practical limits for using Ether and reviewing generated images.",
};

const SECTIONS = [
  {
    title: "Generated results",
    copy: "Ether sends a prompt to an image model. A request can fail or be refused, and results can vary between requests.",
  },
  {
    title: "Review before use",
    copy: "Review every generated result before using it. The person using the output remains responsible for deciding whether it is suitable.",
  },
  {
    title: "Service availability",
    copy: "Generation depends on external services and is not guaranteed to be available. A handled failure does not create an image record.",
  },
  {
    title: "Material you submit",
    copy: "Submit only prompts and material that you are permitted to use. Do not treat the generator as a source of permission.",
  },
] as const;

export default function DisclaimerPage() {
  return (
    <Container>
      <article className="mx-auto max-w-[720px] pt-32 pb-24 md:pt-40 md:pb-32">
        <header className="pb-16 md:pb-24">
          <h1 className="text-text text-[clamp(40px,6vw,60px)] leading-[1.5] tracking-[-0.01em]">
            Product disclaimer
          </h1>
          <p className="text-text-2 mt-6 max-w-[60ch] text-[15px] leading-[26px]">
            These practical limits describe the current image generator. They
            are not a terms or privacy document.
          </p>
        </header>

        <div className="space-y-14 md:space-y-16">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-violet text-[22px] leading-[30px]">
                {section.title}
              </h2>
              <p className="text-text-2 mt-4 max-w-[65ch] text-[15px] leading-[26px]">
                {section.copy}
              </p>
            </section>
          ))}
        </div>
      </article>
    </Container>
  );
}
