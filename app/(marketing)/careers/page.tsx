import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Careers | Ether",
  description: "Current information about open roles at Ether.",
};

export default function CareersPage() {
  return (
    <Container>
      <section className="flex min-h-[100dvh] flex-col pt-32 pb-24 md:pt-40 md:pb-32">
        <header className="grid gap-8 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] md:items-end md:gap-16">
          <h1 className="text-text text-[clamp(40px,6vw,60px)] leading-[1.5] tracking-[-0.01em]">
            Careers
          </h1>
          <p className="text-text-2 max-w-[50ch] text-[15px] leading-[26px] md:pb-4">
            This page records roles that Ether has made available.
          </p>
        </header>

        <div className="border-line mt-16 flex flex-1 flex-col justify-between border-t pt-10 md:mt-24 md:flex-row md:items-end md:gap-16 md:pt-12">
          <h2 className="text-text max-w-[720px] text-[clamp(30px,4vw,40px)] leading-[1.45] tracking-[-0.01em]">
            Ether does not list open roles today.
          </h2>
          <p className="text-text-3 mt-12 max-w-[38ch] text-[13px] leading-[22px] md:mt-0 md:text-right">
            There are no role descriptions or application paths on this page.
          </p>
        </div>
      </section>
    </Container>
  );
}
