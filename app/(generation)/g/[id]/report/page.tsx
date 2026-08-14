import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ReportGenerationForm } from "@/components/app/ReportGenerationForm";
import { PageAtmosphere } from "@/components/motion/PageAtmosphere";
import { Container } from "@/components/ui/Container";
import { getShareableGeneration } from "@/lib/db/queries";
import { generationIdSchema } from "@/lib/validation/generation";

export const metadata: Metadata = {
  title: "Report image | Ether",
  description: "Report a shared image.",
};

export default async function ReportGenerationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const parsed = generationIdSchema.safeParse((await params).id);
  if (!parsed.success || !(await getShareableGeneration(parsed.data))) notFound();
  const { userId } = await auth();

  return (
    <>
      <PageAtmosphere variant="quiet" />
      <Container className="relative py-16 md:py-24">
        <section className="max-w-[880px]" aria-labelledby="report-title">
          <h1
            id="report-title"
            className="hero-in text-text text-[clamp(28px,5vw,40px)] leading-[1.45] font-normal tracking-[-0.01em]"
            style={{ "--i": 0 } as CSSProperties}
          >
            Report this shared image
          </h1>
          <p
            className="hero-in text-text-2 mt-4 max-w-[62ch] text-[15px] leading-[26px]"
            style={{ "--i": 1 } as CSSProperties}
          >
            Choose the reason that best describes the problem. The image and its prompt are not shown here.
          </p>
          {userId ? (
            <ReportGenerationForm generationId={parsed.data} />
          ) : (
            <div className="border-line mt-10 border-t pt-8">
              <p className="text-text-2 text-[15px] leading-[26px]">Sign in before submitting a report.</p>
              <Link href={`/sign-in?redirect_url=/g/${parsed.data}/report`} className="text-text hover:text-text-2 mt-5 inline-block rounded-sm text-[14px] transition-colors">
                Sign in
              </Link>
            </div>
          )}
        </section>
      </Container>
    </>
  );
}
