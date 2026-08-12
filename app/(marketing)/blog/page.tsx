import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Blog | Ether",
  description: "The Ether publication index.",
};

export default function BlogPage() {
  return (
    <Container>
      <section className="min-h-[100dvh] pt-32 pb-24 md:pt-40 md:pb-32">
        <header className="max-w-[760px]">
          <h1 className="text-text text-[clamp(40px,6vw,60px)] leading-[1.5] tracking-[-0.01em]">
            Blog
          </h1>
          <p className="text-text-2 mt-6 max-w-[52ch] text-[15px] leading-[26px]">
            This index will contain writing published by Ether. No articles are
            published today.
          </p>
        </header>

        <div className="border-line mt-16 border-t md:mt-24">
          <div className="grid min-h-[360px] content-between gap-16 py-10 md:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.6fr)] md:items-end md:py-14">
            <h2 className="text-text max-w-[700px] text-[clamp(30px,5vw,52px)] leading-[1.45] tracking-[-0.01em]">
              The publication is empty.
            </h2>
            <p className="text-text-3 max-w-[36ch] text-[13px] leading-[22px] md:text-right">
              There are no posts, authors, categories or archive entries to
              browse.
            </p>
          </div>
          <div className="border-line border-t" />
        </div>
      </section>
    </Container>
  );
}
