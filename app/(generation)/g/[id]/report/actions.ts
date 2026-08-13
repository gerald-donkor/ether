"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath, updateTag } from "next/cache";
import {
  IMAGE_MODERATION_MODEL_ID,
  IMAGE_MODERATION_PROVIDER_UNITS,
} from "@/lib/ai/moderation";
import { screenImage } from "@/lib/ai/generate";
import {
  claimReport,
  completeReportNoAction,
  completeReportWithTakedown,
} from "@/lib/db/moderation";
import { PUBLIC_GENERATIONS_TAG } from "@/lib/db/queries";
import { reserveGenerationQuota } from "@/lib/db/quotas";
import { readGenerationImageForModeration } from "@/lib/storage/generations";
import {
  REPORT_GENERATION_FIELD,
  REPORT_REASON_FIELD,
  reportSchema,
} from "@/lib/validation/report";

export type ReportActionState =
  | { ok: null; status: "idle"; message: "" }
  | { ok: false; status: "rejected"; message: string }
  | { ok: true; status: "accepted" | "duplicate"; message: string };

const RECEIVED_UNAVAILABLE =
  "Report received. It could not be checked right now.";

export async function reportGeneration(
  _previous: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, status: "rejected", message: "Sign in to report an image." };
  }
  const parsed = reportSchema.safeParse({
    generationId: formData.get(REPORT_GENERATION_FIELD),
    reason: formData.get(REPORT_REASON_FIELD),
  });
  if (!parsed.success) {
    return {
      ok: false,
      status: "rejected",
      message: parsed.error.issues[0]?.message ?? "Check the report and try again.",
    };
  }

  const claim = await claimReport({
    generationId: parsed.data.generationId,
    reporterUserId: userId,
    category: parsed.data.reason,
  });
  if (claim.status === "duplicate") {
    return {
      ok: true,
      status: "duplicate",
      message: "This image was already reported from this account.",
    };
  }
  if (claim.status === "not_found") {
    return { ok: false, status: "rejected", message: "That image could not be found." };
  }
  if (claim.status === "unavailable") {
    return { ok: false, status: "rejected", message: "The report could not be submitted. Try again." };
  }

  const quota = await reserveGenerationQuota({
    userId,
    model: IMAGE_MODERATION_MODEL_ID,
    imageCount: 0,
    providerUnits: IMAGE_MODERATION_PROVIDER_UNITS,
  });
  if (quota.status !== "accepted") {
    return { ok: true, status: "accepted", message: RECEIVED_UNAVAILABLE };
  }

  try {
    const image = await readGenerationImageForModeration(claim.imageUrl);
    const decision = await screenImage({
      ...image,
      reportedCategory: parsed.data.reason,
    });
    if (decision.status === "unavailable") {
      return { ok: true, status: "accepted", message: RECEIVED_UNAVAILABLE };
    }
    if (decision.status === "safe") {
      await completeReportNoAction(claim.reportId);
      return { ok: true, status: "accepted", message: "Report received." };
    }

    const generationId = await completeReportWithTakedown(
      claim.reportId,
      decision.category,
    );
    if (generationId) {
      updateTag(PUBLIC_GENERATIONS_TAG);
      revalidatePath("/");
      revalidatePath("/community");
      revalidatePath(`/g/${generationId}`);
      revalidatePath("/generate");
      revalidatePath("/library");
    }
    return {
      ok: true,
      status: "accepted",
      message: generationId
        ? "Report received. The image is no longer available."
        : "Report received.",
    };
  } catch (error) {
    console.error(
      "Report moderation failed.",
      error instanceof Error ? error.name : "Unknown error",
    );
    return { ok: true, status: "accepted", message: RECEIVED_UNAVAILABLE };
  }
}
