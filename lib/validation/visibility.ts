import { z } from "zod";

import { GENERATION_VISIBILITIES } from "@/lib/generations/visibility";
import { generationIdSchema } from "@/lib/validation/generation";

export const VISIBILITY_FIELD = "visibility";

export const generationVisibilitySchema = z.object({
  generationId: generationIdSchema,
  visibility: z.enum(
    GENERATION_VISIBILITIES,
    "Choose a visibility setting from the list.",
  ),
});
