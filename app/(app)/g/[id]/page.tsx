import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteGenerationButton } from "@/components/app/DeleteGenerationButton";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { getModel } from "@/lib/ai/catalog";
import { requireUserId } from "@/lib/auth";
import { getGenerationForOwner } from "@/lib/db/queries";
import { generationDownloadUrl } from "@/lib/storage/generations";
import { generationIdSchema } from "@/lib/validation/generation";

/**
 * A static title. The prompt is the user's data and a title lands in the
 * browser tab, the history, and any screenshot the page appears in, so it
 * never goes there (AGENTS.md 8.3).
 */
export const metadata: Metadata = {
  title: "Image | Ether",
  description: "One generated image, its prompt, and its record.",
};

export default async function GenerationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // The proxy is optimistic and is not the boundary, so the session is read
  // again here (AGENTS.md 11 rule 1).
  const userId = await requireUserId();

  // Parsed before the query, because a malformed value sent to a `uuid` column
  // raises a Postgres error rather than returning no rows.
  const parsedId = generationIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const generation = await getGenerationForOwner(parsedId.data, userId);

  // Not found and not yours are the same answer. Anything else would confirm
  // that an id exists.
  if (!generation) notFound();

  // A row written before lib/ai/catalog.ts existed can hold an id the registry
  // does not list, so the raw id is the fallback rather than "undefined".
  const modelLabel = getModel(generation.model)?.label ?? generation.model;

  return (
    <Container className="py-16 md:py-24">
      <div className="max-w-[880px]">
        <Link
          href="/generate"
          className="text-text-2 hover:text-text rounded-sm text-[13px] transition-colors"
        >
          Back to your images
        </Link>

        <h1 className="text-text mt-6 text-[clamp(28px,5vw,40px)] leading-[1.45] font-normal tracking-[-0.01em]">
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
            alt={generation.prompt}
            fill
            sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1023px) calc(100vw - 64px), 880px"
            className="object-cover"
          />
        </div>

        <dl className="border-line mt-10 grid gap-x-8 gap-y-5 border-t pt-8 sm:grid-cols-[120px_minmax(0,1fr)]">
          <dt className="text-text-3 text-[13px]">Prompt</dt>
          <dd className="text-text text-[15px] leading-[26px]">
            {generation.prompt}
          </dd>

          <dt className="text-text-3 text-[13px]">Model</dt>
          <dd className="text-text text-[15px] leading-[26px]">{modelLabel}</dd>

          <dt className="text-text-3 text-[13px]">Size</dt>
          <dd className="text-text text-[15px] leading-[26px]">
            {generation.width} x {generation.height}
          </dd>

          <dt className="text-text-3 text-[13px]">Created</dt>
          <dd className="text-text text-[15px] leading-[26px]">
            {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
              generation.createdAt,
            )}
          </dd>

          <dt className="text-text-3 text-[13px]">Visibility</dt>
          <dd className="text-text text-[15px] leading-[26px]">
            {generation.isPublic ? "In the public gallery" : "Private"}
          </dd>
        </dl>

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
          <DeleteGenerationButton id={generation.id} />
        </div>
      </div>
    </Container>
  );
}
