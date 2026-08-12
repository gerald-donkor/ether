import { z } from "zod";

export const generationPromptSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, "Enter a prompt before generating.")
    .max(500, "Keep the prompt to 500 characters or fewer."),
});
