"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath, updateTag } from "next/cache";
import {
  generateImageForPrompt,
  ImageGenerationError,
} from "@/lib/ai/generate";
import { IMAGE_MODEL } from "@/lib/ai/model";
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
  generationRequestSchema,
  PUBLISH_FIELD,
} from "@/lib/validation/generation";

export type GenerationResult = {
  id: string;
  prompt: string;
  imageUrl: string;
  width: number;
  height: number;
  isPublic: boolean;
  createdAt: string;
};

export type GenerationActionState =
  | { ok: null; error: null; generation: null }
  | { ok: false; error: string; generation: null }
  | { ok: true; error: null; generation: GenerationResult };

function safeErrorMessage(error: unknown, prompt: string) {
  if (!(error instanceof Error)) return "Unknown provider error";
  return `${error.name}: ${error.message.replaceAll(prompt, "[prompt removed]")}`;
}

export async function generateGeneration(
  _previousState: GenerationActionState,
  formData: FormData,
): Promise<GenerationActionState> {
  const { userId } = await auth();
  if (!userId) {
    return {
      ok: false,
      error: "Sign in before generating an image.",
      generation: null,
    };
  }

  const parsed = generationRequestSchema.safeParse({
    prompt: formData.get("prompt"),
    publish: formData.get(PUBLISH_FIELD),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the prompt and try again.",
      generation: null,
    };
  }

  const prompt = parsed.data.prompt;
  const isPublic = parsed.data.publish;

  try {
    // This indexed count is a first-line spending cap, not a distributed rate
    // limiter. Step 9 replaces it with Upstash when quotas become a product.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await countRecentGenerationsForUser(userId, oneHourAgo);
    if (recentCount >= 20) {
      return {
        ok: false,
        error: "The hourly generation limit has been reached. Try again later.",
        generation: null,
      };
    }
  } catch (error) {
    console.error("Generation quota check failed.", safeErrorMessage(error, prompt));
    return {
      ok: false,
      error: "Usage could not be checked. Try again in a moment.",
      generation: null,
    };
  }

  let generated: Awaited<ReturnType<typeof generateImageForPrompt>>;
  try {
    generated = await generateImageForPrompt(prompt);
  } catch (error) {
    console.error("Image generation failed.", safeErrorMessage(error, prompt));

    // Telling someone to revise a prompt that was never the problem sends them
    // somewhere useless, so an unreachable or exhausted provider says so.
    const providerUnavailable =
      error instanceof ImageGenerationError &&
      error.kind === "provider_unavailable";

    return {
      ok: false,
      error: providerUnavailable
        ? "The generator is unavailable right now. Try again later."
        : "The image could not be generated. Revise the prompt or try again.",
      generation: null,
    };
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
    return {
      ok: false,
      error: "The image was created but could not be saved. Try again.",
      generation: null,
    };
  }

  try {
    const row = await createGeneration({
      userId,
      prompt,
      imageUrl: blob.url,
      model: IMAGE_MODEL,
      width: generated.width,
      height: generated.height,
      isPublic,
    });

    revalidatePath("/generate");

    // A private generation changes nothing anyone else can see, so the
    // marketing route is left alone. Only a published one expires the
    // gallery's cached read and the landing page that renders it.
    if (row.isPublic) {
      updateTag(PUBLIC_GALLERY_TAG);
      revalidatePath("/");
    }

    return {
      ok: true,
      error: null,
      generation: {
        id: row.id,
        prompt: row.prompt,
        imageUrl: row.imageUrl,
        width: row.width,
        height: row.height,
        isPublic: row.isPublic,
        createdAt: row.createdAt.toISOString(),
      },
    };
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

    return {
      ok: false,
      error: "The image was created but its record could not be saved. Try again.",
      generation: null,
    };
  }
}
