import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Services | Ether",
  description: "The current boundary of the self-serve Ether product.",
};

export default function ServicesPage() {
  return (
    <Container>
      <div className="pt-32 pb-24 md:pt-40 md:pb-32">
        <header className="max-w-[760px]">
          <h1 className="text-text text-[clamp(40px,6vw,60px)] leading-[1.5] tracking-[-0.01em]">
            The service is the generator.
          </h1>
          <p className="text-text-2 mt-6 max-w-[58ch] text-[15px] leading-[26px]">
            Ether currently provides a signed-in, self-serve path from a text
            prompt to a private image.
          </p>
        </header>

        <section aria-label="Service boundary" className="mt-16 md:mt-24">
          <div className="border-violet grid gap-6 border-l-4 py-5 pl-7 md:grid-cols-[minmax(0,0.55fr)_minmax(0,1.45fr)] md:gap-16 md:py-8 md:pl-10">
            <h2 className="text-text text-[22px] leading-[30px]">Available</h2>
            <p className="text-text-2 max-w-[58ch] text-[15px] leading-[26px]">
              Write a prompt, request one square image and return to recent
              work attached to your account.
            </p>
          </div>

          <div className="border-line mt-16 grid gap-6 border-l py-5 pl-7 md:mt-24 md:grid-cols-[minmax(0,0.55fr)_minmax(0,1.45fr)] md:gap-16 md:py-8 md:pl-10">
            <h2 className="text-text-3 text-[22px] leading-[30px]">
              Not provided
            </h2>
            <p className="text-text-3 max-w-[58ch] text-[15px] leading-[26px]">
              Ether does not provide managed creative work, consulting or
              custom implementation through this site.
            </p>
          </div>
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
