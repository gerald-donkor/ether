"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath, updateTag } from "next/cache";
import {
  PUBLIC_GALLERY_TAG,
  restoreGenerationForOwner,
  softDeleteGenerationForOwner,
} from "@/lib/db/queries";
import {
  GENERATION_ID_FIELD,
  generationIdSchema,
} from "@/lib/validation/generation";

/**
 * Removing is the undo layer over the library, not the delete mechanism. It
 * stamps `deleted_at`, which takes the row out of every listing, the
 * permalink, the public gallery and the account count while its Blob object
 * stays where it is. Permanent deletion is the separate operation in
 * `app/(app)/g/[id]/actions.ts`, and it removes both. See docs/backend.md.
 */
export type LibraryActionState =
  | { ok: null; error: null }
  | { ok: true; error: null }
  | { ok: false; error: string };

/**
 * One message for "no such image" and for "not yours", so neither answer
 * confirms that a given id exists.
 */
const NOT_FOUND = "That image could not be found.";

/**
 * A database message can quote the row it failed on, so nothing but a fixed
 * string is ever logged from here. Neither of these paths reads a prompt or a
 * blob url, so there is nothing to redact and nothing to accidentally carry.
 */
function logFailure(what: string, error: unknown) {
  console.error(
    what,
    error instanceof Error ? error.name : "Unknown error",
  );
}

async function mutate(
  formData: FormData,
  run: (
    id: string,
    userId: string,
  ) => Promise<{ id: string; isPublic: boolean } | undefined>,
  failure: string,
): Promise<LibraryActionState> {
  // a. The session, read on the server every time. The form carries only the
  // id, so there is no client-supplied owner to ignore.
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: "Sign in to manage your images." };
  }

  // b. The one field that crosses, parsed with the shared schema before it
  // reaches a `uuid` column.
  const parsed = generationIdSchema.safeParse(
    formData.get(GENERATION_ID_FIELD),
  );
  if (!parsed.success) {
    return { ok: false, error: NOT_FOUND };
  }

  // c. No quota check. Neither operation spends provider money, so there is
  // nothing here for a rate limit to protect.

  // d and g. The owner filter lives inside the statement, so the update is
  // both the authorisation and the write.
  let row;
  try {
    row = await run(parsed.data, userId);
  } catch (error) {
    logFailure(failure, error);
    return { ok: false, error: "That did not work. Try again." };
  }

  if (!row) {
    return { ok: false, error: NOT_FOUND };
  }

  // h. The surfaces that listed it. A private row changes nothing anyone else
  // can see, so only a public one expires the landing gallery, matching the
  // rule `deleteGeneration` already follows.
  revalidatePath("/library");
  revalidatePath("/generate");
  if (row.isPublic) {
    updateTag(PUBLIC_GALLERY_TAG);
    revalidatePath("/");
  }

  // No redirect. The row's surface still exists and the user stays where they
  // are, with the result rendered into a slot that was already reserved
  // (AGENTS.md 10 rule 5).
  return { ok: true, error: null };
}

export async function removeGeneration(
  _previousState: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  return mutate(
    formData,
    softDeleteGenerationForOwner,
    "Generation remove failed.",
  );
}

export async function restoreGeneration(
  _previousState: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  return mutate(
    formData,
    restoreGenerationForOwner,
    "Generation restore failed.",
  );
}
