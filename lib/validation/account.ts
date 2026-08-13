import { z } from "zod";

import { GENERATION_COUNTS, IMAGE_MODEL_IDS } from "@/lib/ai/catalog";
import { refineModelSizePair } from "@/lib/validation/generation";
import type { GenerationVisibility } from "@/lib/generations/visibility";

/**
 * The two things that cross from `/account`. Like the rest of `lib/validation/`
 * this module is deliberately not `server-only`: the client leaves and the
 * Server Actions import the same schemas, so the rules exist once and run twice
 * (AGENTS.md 6.3 and 10). It reads no secret and imports nothing from
 * `lib/db/`.
 */

/**
 * The generation defaults. The field names are the generate form's own, because
 * the account form renders the same controls, and the model/size pairing is the
 * shared rule from `lib/validation/generation.ts` rather than a second copy.
 *
 * `publish` is the same closed literal pair the generate form uses: a native
 * checkbox sends its `value` when checked and nothing at all when it is not, so
 * an absent field means private and an unexpected value is rejected rather than
 * read as consent. Only `private` and `public` are storable, because the
 * control is binary and `unlisted` is not something a checkbox can express.
 */
export const generationDefaultsSchema = z
  .object({
    model: z.enum(IMAGE_MODEL_IDS, "Choose a model from the list."),
    size: z.string("Choose an image size.").min(1, "Choose an image size."),
    count: z
      .enum(GENERATION_COUNTS, "Choose how many images to generate.")
      .transform(Number),
    publish: z
      .literal("public", "Choose whether new images are published by default.")
      .nullish()
      .transform<Extract<GenerationVisibility, "private" | "public">>((value) =>
        value === "public" ? "public" : "private",
      ),
  })
  .superRefine(refineModelSizePair);

export type GenerationDefaultsInput = z.infer<typeof generationDefaultsSchema>;

/**
 * The word that confirms an account deletion. It is a typed confirmation rather
 * than a browser `confirm()` dialog, matching the markup-level two-step confirm
 * design-system.md 2.11 already established for a permanent image delete.
 *
 * It is compared case-insensitively after trimming, so a capitalised or
 * space-padded answer still counts. The word is stated in the UI copy, and the
 * constant is what stops the copy and the check from drifting apart.
 */
export const DELETE_ACCOUNT_WORD = "delete";

export const deleteAccountSchema = z.object({
  confirm: z
    .string(`Type ${DELETE_ACCOUNT_WORD} to confirm.`)
    .transform((value) => value.trim().toLowerCase())
    .refine(
      (value) => value === DELETE_ACCOUNT_WORD,
      `Type ${DELETE_ACCOUNT_WORD} to confirm.`,
    ),
});

/** The confirmation field's name, so the form and the schema cannot drift. */
export const DELETE_ACCOUNT_CONFIRM_FIELD = "confirm";
