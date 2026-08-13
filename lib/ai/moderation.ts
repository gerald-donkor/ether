export const PROMPT_MODERATION_MODEL_ID = "@cf/meta/llama-guard-3-8b";
export const IMAGE_MODERATION_MODEL_ID = "@cf/moondream/moondream3.1-9B-A2B";

import type { ReportCategory } from "@/lib/validation/report";

export type ModerationCategory = ReportCategory;
export type ModerationDecision =
  | { status: "safe" }
  | { status: "unsafe"; category: ModerationCategory }
  | { status: "unavailable" };

const LLAMA_GUARD_CATEGORY: Readonly<Record<string, ModerationCategory>> = {
  S1: "violence",
  S2: "violence",
  S3: "violence",
  S4: "sexual",
  S5: "violence",
  S6: "illegal",
  S7: "illegal",
  S8: "hate",
  S9: "illegal",
  S10: "illegal",
  S11: "self_harm",
  S12: "sexual",
  S13: "illegal",
  S14: "personal_data",
};

export function parsePromptModeration(value: unknown): ModerationDecision {
  if (typeof value !== "string") return { status: "unavailable" };
  const normalized = value.trim();
  if (normalized === "safe") return { status: "safe" };

  const match = /^unsafe\n(S(?:[1-9]|1[0-4]))(?:,S(?:[1-9]|1[0-4]))*$/.exec(
    normalized,
  );
  if (!match) return { status: "unavailable" };
  const category = LLAMA_GUARD_CATEGORY[match[1]];
  return category
    ? { status: "unsafe", category }
    : { status: "unavailable" };
}

export function parseImageModeration(value: unknown): ModerationDecision {
  if (typeof value !== "string") return { status: "unavailable" };
  const normalized = value.trim();
  if (normalized === "SAFE") return { status: "safe" };
  const category = {
    SEXUAL: "sexual",
    VIOLENCE: "violence",
    HATE: "hate",
    SELF_HARM: "self_harm",
    ILLEGAL: "illegal",
    PERSONAL_DATA: "personal_data",
  }[normalized] as ModerationCategory | undefined;
  return category ? { status: "unsafe", category } : { status: "unavailable" };
}

export const PROMPT_MODERATION_PROVIDER_UNITS = 2_500;
export const IMAGE_MODERATION_PROVIDER_UNITS = 2_500;

export const IMAGE_MODERATION_POLICY =
  "Classify the image for sexual content, graphic or threatened violence, hateful content, self-harm, instructions for illegal activity, or exposed personal data. Return one code only: SAFE, SEXUAL, VIOLENCE, HATE, SELF_HARM, ILLEGAL, PERSONAL_DATA.";
