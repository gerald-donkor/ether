import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { DeleteGenerationButton } from "@/components/app/DeleteGenerationButton";
import { PageAtmosphere } from "@/components/motion/PageAtmosphere";
import { GenerationVisibilityControls } from "@/components/app/GenerationVisibilityControls";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { getModel } from "@/lib/ai/catalog";
import {
  getGenerationForOwner,
  getShareableGeneration,
} from "@/lib/db/queries";
import { generationDownloadUrl } from "@/lib/storage/generations";
import { generationIdSchema } from "@/lib/validation/generation";

/**
 * A static title. The prompt is the user's data and a title lands in the
 * browser tab, the history, and any screenshot the page appears in, so it
 * never goes there (AGENTS.md 8.3).
 */
export const metadata: Metadata = {
  title: "Image | Ether",
  description: "One generated image and its record.",
};

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export default async function GenerationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Parsed before the query, because a malformed value sent to a `uuid` column
  // raises a Postgres error rather than returning no rows.
  const parsedId = generationIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const { userId } = await auth();
  const ownerGeneration = userId
    ? await getGenerationForOwner(parsedId.data, userId)
    : undefined;
  const generation =
    ownerGeneration ?? (await getShareableGeneration(parsedId.data));

  // Not found and not yours are the same answer. Anything else would confirm
  // that an id exists.
  if (!generation) notFound();
  const isOwner = Boolean(ownerGeneration);

  // A row written before lib/ai/catalog.ts existed can hold an id the registry
  // does not list, so the raw id is the fallback rather than "undefined".
  const modelLabel = getModel(generation.model)?.label ?? generation.model;

  return (
    <>
      <PageAtmosphere variant="quiet" />
      <Container className="relative py-16 md:py-24">
        <div className="max-w-[880px]">
          {isOwner ? (
            <Link
              href="/generate"
              className="text-text-2 hover:text-text rounded-sm text-[13px] transition-colors"
            >
              Back to your images
            </Link>
          ) : null}

          <h1
            className="hero-in text-text mt-6 text-[clamp(28px,5vw,40px)] leading-[1.45] font-normal tracking-[-0.01em]"
            style={{ "--i": 0 } as CSSProperties}
          >
            Generated image
          </h1>

          {/* The box takes the row's own stored ratio, so it is the right shape
              before the image loads. No priority: the macaw is the only one on
              the site (design-system.md 5.3). */}
          <div
            className="bg-surface rounded-panel relative mt-8 overflow-hidden"
            style={{ aspectRatio: `${generation.width} / ${generation.height}` }}
          >
            <Image
              src={generation.imageUrl}
              alt={
                isOwner && ownerGeneration
                  ? ownerGeneration.prompt
                  : "An image generated with Ether and published by its owner."
              }
              fill
              sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1023px) calc(100vw - 64px), 880px"
              className="object-cover"
            />
          </div>

          <dl className="border-line mt-10 grid gap-x-8 gap-y-5 border-t pt-8 sm:grid-cols-[120px_minmax(0,1fr)]">
            {isOwner && ownerGeneration ? (
              <>
                <dt className="text-text-3 text-[13px]">Prompt</dt>
                <dd className="text-text text-[15px] leading-[26px]">
                  {ownerGeneration.prompt}
                </dd>
              </>
            ) : null}

            <dt className="text-text-3 text-[13px]">Model</dt>
            <dd className="text-text text-[15px] leading-[26px]">{modelLabel}</dd>

            <dt className="text-text-3 text-[13px]">Size</dt>
            <dd className="text-text text-[15px] leading-[26px]">
              {generation.width} x {generation.height}
            </dd>

            <dt className="text-text-3 text-[13px]">Created</dt>
            <dd className="text-text text-[15px] leading-[26px]">
              {dateFormat.format(generation.createdAt)}
            </dd>

            <dt className="text-text-3 text-[13px]">Visibility</dt>
            <dd className="text-text text-[15px] leading-[26px]">
              {generation.visibility[0].toUpperCase() + generation.visibility.slice(1)}
            </dd>
          </dl>

          {isOwner ? (
            <GenerationVisibilityControls
              id={generation.id}
              visibility={generation.visibility}
            />
          ) : null}

          <div className="border-line mt-8 flex flex-wrap items-start gap-3 border-t pt-8">
            {/* Blob is a different origin, where the `download` attribute is
                ignored, so the url itself carries the attachment header. */}
            <Button
              variant="ghost"
              href={generationDownloadUrl(generation.imageUrl)}
              className="px-5 py-2.5 text-[14px]"
            >
              Download
            </Button>
            {!isOwner ? (
              <Button
                variant="ghost"
                href={`/g/${generation.id}/report`}
                className="px-5 py-2.5 text-[14px]"
              >
                Report
              </Button>
            ) : null}
            {isOwner ? <DeleteGenerationButton id={generation.id} /> : null}
          </div>
        </div>
      </Container>
    </>
  );
}
