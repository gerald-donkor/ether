"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath, updateTag } from "next/cache";
import {
  generateImageForPrompt,
  ImageGenerationError,
} from "@/lib/ai/generate";
import {
  countRecentGenerationsForUser,
  createGeneration,
  PUBLIC_GALLERY_TAG,
} from "@/lib/db/queries";
import {
  deleteGenerationImage,
  storeGenerationImage,
} from "@/lib/storage/generations";
import {
  COUNT_FIELD,
  generationRequestSchema,
  MODEL_FIELD,
  PROMPT_FIELD,
  PUBLISH_FIELD,
  SIZE_FIELD,
} from "@/lib/validation/generation";

/** The first-line hourly spending cap, counted per account. */
const HOURLY_LIMIT = 20;

export type GenerationResult = {
  id: string;
  prompt: string;
  imageUrl: string;
  width: number;
  height: number;
  isPublic: boolean;
  createdAt: string;
};

/**
 * A request for several images can succeed in part, so the result carries the
 * images that were written and a count of the ones that were not. Only a total
 * failure is `ok: false`.
 */
export type GenerationActionState =
  | { ok: null; error: null; generations: GenerationResult[]; failed: number }
  | { ok: false; error: string; generations: GenerationResult[]; failed: number }
  | { ok: true; error: null; generations: GenerationResult[]; failed: number };

function safeErrorMessage(error: unknown, prompt: string) {
  if (!(error instanceof Error)) return "Unknown provider error";
  return `${error.name}: ${error.message.replaceAll(prompt, "[prompt removed]")}`;
}

function failure(error: string): GenerationActionState {
  return { ok: false, error, generations: [], failed: 0 };
}

export async function generateGeneration(
  _previousState: GenerationActionState,
  formData: FormData,
): Promise<GenerationActionState> {
  const { userId } = await auth();
  if (!userId) {
    return failure("Sign in before generating an image.");
  }

  const parsed = generationRequestSchema.safeParse({
    prompt: formData.get(PROMPT_FIELD),
    model: formData.get(MODEL_FIELD),
    size: formData.get(SIZE_FIELD),
    count: formData.get(COUNT_FIELD),
    publish: formData.get(PUBLISH_FIELD),
  });
  if (!parsed.success) {
    return failure(
      parsed.error.issues[0]?.message ?? "Check the request and try again.",
    );
  }

  const { prompt, model: modelId, size: sizeKey, count } = parsed.data;
  const isPublic = parsed.data.publish;

  try {
    // This indexed count is a first-line spending cap, not a distributed rate
    // limiter. Step 9 replaces it with Upstash when quotas become a product.
    //
    // It also does not model the account-wide daily neuron allocation, which
    // is a second ceiling every user shares. Exhausting that is a provider
    // refusal, not something this check can see coming.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await countRecentGenerationsForUser(userId, oneHourAgo);
    const remaining = Math.max(0, HOURLY_LIMIT - recentCount);

    // Checked against the number requested, before the first call, so a batch
    // cannot walk past the cap one image at a time.
    if (count > remaining) {
      return failure(
        remaining === 0
          ? `The hourly limit of ${HOURLY_LIMIT} images has been reached. Try again later.`
          : `Only ${remaining} more ${remaining === 1 ? "image" : "images"} can be generated this hour. Ask for fewer.`,
      );
    }
  } catch (error) {
    console.error("Generation quota check failed.", safeErrorMessage(error, prompt));
    return failure("Usage could not be checked. Try again in a moment.");
  }

  const generations: GenerationResult[] = [];
  let failed = 0;
  let lastError: string | null = null;
  let publishedAny = false;

  // Sequential, not parallel: per-account concurrency on Workers AI is
  // unverified, and a serial loop keeps a partial failure legible.
  for (let index = 0; index < count; index += 1) {
    let generated: Awaited<ReturnType<typeof generateImageForPrompt>>;
    try {
      generated = await generateImageForPrompt({ prompt, modelId, sizeKey });
    } catch (error) {
      console.error("Image generation failed.", safeErrorMessage(error, prompt));

      // Telling someone to revise a prompt that was never the problem sends
      // them somewhere useless, so an unreachable or exhausted provider says
      // so.
      const providerUnavailable =
        error instanceof ImageGenerationError &&
        error.kind === "provider_unavailable";

      failed += 1;
      lastError = providerUnavailable
        ? "The generator is unavailable right now. Try again later."
        : "The image could not be generated. Revise the prompt or try again.";
      continue;
    }

    let blob: Awaited<ReturnType<typeof storeGenerationImage>>;
    try {
      blob = await storeGenerationImage({
        userId,
        bytes: generated.bytes,
        mediaType: generated.mediaType,
      });
    } catch (error) {
      console.error("Generation storage failed.", safeErrorMessage(error, prompt));
      failed += 1;
      lastError = "The image was created but could not be saved. Try again.";
      continue;
    }

    try {
      const row = await createGeneration({
        userId,
        prompt,
        imageUrl: blob.url,
        model: modelId,
        width: generated.width,
        height: generated.height,
        isPublic,
      });

      if (row.isPublic) publishedAny = true;

      generations.push({
        id: row.id,
        prompt: row.prompt,
        imageUrl: row.imageUrl,
        width: row.width,
        height: row.height,
        isPublic: row.isPublic,
        createdAt: row.createdAt.toISOString(),
      });
    } catch (error) {
      console.error("Generation record failed.", safeErrorMessage(error, prompt));
      try {
        await deleteGenerationImage(blob.url);
      } catch (cleanupError) {
        console.error(
          "Generation cleanup failed.",
          safeErrorMessage(cleanupError, prompt),
        );
      }

      failed += 1;
      lastError =
        "The image was created but its record could not be saved. Try again.";
    }
  }

  if (generations.length === 0) {
    return {
      ok: false,
      error: lastError ?? "No image could be generated. Try again.",
      generations: [],
      failed,
    };
  }

  // Nothing was written on a total failure, so the revalidation only runs when
  // at least one row exists to show. Once, not once per image.
  revalidatePath("/generate");

  // A private generation changes nothing anyone else can see, so the marketing
  // route is left alone. Only a published one expires the gallery's cached
  // read and the landing page that renders it.
  if (publishedAny) {
    updateTag(PUBLIC_GALLERY_TAG);
    revalidatePath("/");
  }

  return { ok: true, error: null, generations, failed };
}
