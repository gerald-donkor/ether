export const GENERATION_VISIBILITIES = [
  "private",
  "unlisted",
  "public",
] as const;

export type GenerationVisibility =
  (typeof GENERATION_VISIBILITIES)[number];
