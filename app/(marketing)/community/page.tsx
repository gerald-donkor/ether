import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Community | Ether",
  description:
    "Ether generations are private by default. An owner can publish one image to the gallery on the home page.",
};

export default function CommunityPage() {
  return (
    <Container>
      <section className="flex min-h-[100dvh] flex-col pt-32 pb-24 md:pt-40 md:pb-32">
        <h1 className="text-text max-w-[900px] text-[clamp(40px,6vw,60px)] leading-[1.45] tracking-[-0.01em]">
          Your work stays yours until you decide to show it.
        </h1>

        <figure className="mt-12 overflow-hidden rounded-card md:mt-16">
          <Image
            src="/assets/ui/img/gallery-crowd.jpg"
            alt="A performer lit in violet before a crowded club stage."
            width={1200}
            height={1800}
            sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1279px) calc(100vw - 64px), 1080px"
            className="h-[320px] w-full object-cover object-center md:h-[440px]"
          />
        </figure>

        <div className="bg-surface mt-4 grid gap-8 rounded-panel p-7 md:grid-cols-[minmax(0,1.4fr)_auto] md:items-end md:p-10">
          <div>
            <h2 className="text-text text-[22px] leading-[30px]">
              Private by default
            </h2>
            <p className="text-text-2 mt-4 max-w-[60ch] text-[15px] leading-[26px]">
              A generation is visible only to its owner. When you create one,
              you can opt that single image into the public gallery. The strip
              on the home page shows the work that has been published.
            </p>
          </div>
          <Button href="/#gallery-title" className="px-6 py-3 text-[15px]">
            See the gallery
          </Button>
        </div>
      </section>
    </Container>
  );
}
