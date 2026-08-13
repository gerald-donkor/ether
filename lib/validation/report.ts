import { z } from "zod";

export const REPORT_CATEGORIES = [
  "sexual",
  "violence",
  "hate",
  "self_harm",
  "illegal",
  "personal_data",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_REASON_LABELS = {
  sexual: "Sexual content",
  violence: "Violence",
  hate: "Hateful content",
  self_harm: "Self-harm",
  illegal: "Illegal activity",
  personal_data: "Personal data",
} as const;

export const reportSchema = z
  .object({
    generationId: z.uuid("That image could not be found."),
    reason: z.enum(REPORT_CATEGORIES, "Choose a reason from the list."),
  })
  .strict();

export const REPORT_GENERATION_FIELD = "generationId";
export const REPORT_REASON_FIELD = "reason";
