import { z } from "zod";

import {
  GENERATION_COUNTS,
  IMAGE_MODEL_IDS,
  getModel,
  getModelSize,
} from "@/lib/ai/catalog";

/**
 * The shape of one generate request. This module is deliberately not
 * server-only: the client leaf and the Server Action import the same schema,
 * so the rules exist once and run twice. See AGENTS.md 6.3 and 10.
 *
 * The model, size and count lists are built from `lib/ai/catalog.ts` rather
 * than written out again, so the closed list has exactly one definition. The
 * catalog is pure data and reads no secret, which is what lets this module
 * import it.
 *
 * `publish` is the publication choice. A native checkbox sends its `value`
 * when checked and nothing at all when it is not, so the only accepted value
 * is the literal below and an absent field means private. Truthiness is never
 * consulted: an unexpected value is rejected rather than read as consent.
 */
export const generationRequestSchema = z
  .object({
    prompt: z
      .string()
      .trim()
      .min(1, "Enter a prompt before generating.")
      .max(500, "Keep the prompt to 500 characters or fewer."),
    model: z.enum(IMAGE_MODEL_IDS, "Choose a model from the list."),
    size: z.string("Choose an image size.").min(1, "Choose an image size."),
    count: z
      .enum(GENERATION_COUNTS, "Choose how many images to generate.")
      .transform(Number),
    publish: z
      .literal("public", "Choose whether to publish before generating.")
      .nullish()
      .transform((value) => value === "public"),
  })
  // The model and the size are only ever valid as a pair: each model declares
  // its own sizes, and the default model takes no dimensions at all. The
  // message names the control rather than the internals.
  .superRefine((value, ctx) => {
    const model = getModel(value.model);
    if (!model) return;

    if (!getModelSize(model, value.size)) {
      ctx.addIssue("That image size is not available for the chosen model.");
    }
  });

/** The field names, so the form and the schema cannot drift. */
export const PROMPT_FIELD = "prompt";
export const MODEL_FIELD = "model";
export const SIZE_FIELD = "size";
export const COUNT_FIELD = "count";

/** The checkbox's `name` and `value`, so the form and the schema cannot drift. */
export const PUBLISH_FIELD = "publish";
export const PUBLISH_VALUE = "public";
