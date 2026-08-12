import { z } from "zod";

/**
 * The shape of one generate request. This module is deliberately not
 * server-only: the client leaf and the Server Action import the same schema,
 * so the rules exist once and run twice. See AGENTS.md 6.3 and 10.
 *
 * `publish` is the publication choice. A native checkbox sends its `value`
 * when checked and nothing at all when it is not, so the only accepted value
 * is the literal below and an absent field means private. Truthiness is never
 * consulted: an unexpected value is rejected rather than read as consent.
 */
export const generationRequestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, "Enter a prompt before generating.")
    .max(500, "Keep the prompt to 500 characters or fewer."),
  publish: z
    .literal("public", "Choose whether to publish before generating.")
    .nullish()
    .transform((value) => value === "public"),
});

/** The checkbox's `name` and `value`, so the form and the schema cannot drift. */
export const PUBLISH_FIELD = "publish";
export const PUBLISH_VALUE = "public";
