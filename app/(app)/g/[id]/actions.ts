"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteGenerationForOwner,
  getGenerationForOwnerIncludingRemoved,
  PUBLIC_GALLERY_TAG,
} from "@/lib/db/queries";
import { deleteGenerationImage } from "@/lib/storage/generations";
import {
  GENERATION_ID_FIELD,
  generationIdSchema,
  RETURN_TO_FIELD,
} from "@/lib/validation/generation";

/**
 * Deletion is permanent here: the Blob object and the row both go. A row
 * marked deleted while its image stays fetchable at a public url would be a
 * broken promise rather than an audit trail. See docs/backend.md for the
 * divergence from AGENTS.md 9.1 this represents.
 */
export type DeleteGenerationState =
  | { ok: null; error: null }
  | { ok: false; error: string };

/**
 * One message for "no such image" and for "not yours". A distinct refusal
 * would confirm that a given id exists, which is enough to enumerate other
 * people's work.
 */
const NOT_FOUND = "That image could not be found.";

/**
 * Where the redirect lands, as a closed list of exactly two paths. The field
 * arrives from the browser, and an open redirect through a user-supplied path
 * is the failure this guard exists to prevent: anything not on the list falls
 * back to the default rather than being followed.
 */
const RETURN_TO_PATHS = ["/generate", "/library"] as const;
const DEFAULT_RETURN_TO = "/generate";

function returnPath(value: FormDataEntryValue | null) {
  return RETURN_TO_PATHS.find((path) => path === value) ?? DEFAULT_RETURN_TO;
}

/**
 * A provider or database message can quote the row it failed on, and a blob
 * url carries the owner's Clerk id in its pathname, so both are removed before
 * anything is logged.
 */
function safeErrorMessage(error: unknown, redact: string[]) {
  if (!(error instanceof Error)) return "Unknown error";

  let message = error.message;
  for (const value of redact) {
    if (value) message = message.replaceAll(value, "[removed]");
  }

  return `${error.name}: ${message}`;
}

export async function deleteGeneration(
  _previousState: DeleteGenerationState,
  formData: FormData,
): Promise<DeleteGenerationState> {
  // a. The session, read on the server. There is no client-supplied owner id
  // to ignore, because the form carries no such field.
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: "Sign in before deleting an image." };
  }

  // b. The one field that crosses, parsed with the shared schema.
  const parsed = generationIdSchema.safeParse(
    formData.get(GENERATION_ID_FIELD),
  );
  if (!parsed.success) {
    return { ok: false, error: NOT_FOUND };
  }

  // c. No quota check. Deleting spends no provider money and frees storage,
  // so there is nothing here for a rate limit to protect.

  const destination = returnPath(formData.get(RETURN_TO_FIELD));

  // d. Authorise by reading the row the caller owns. A wrong owner and a
  // missing row are the same answer. The read includes removed rows, so a row
  // in the library's Removed view can still be destroyed for good.
  let row;
  try {
    row = await getGenerationForOwnerIncludingRemoved(parsed.data, userId);
  } catch (error) {
    console.error("Generation delete lookup failed.", safeErrorMessage(error, []));
    return { ok: false, error: "The image could not be deleted. Try again." };
  }

  if (!row) {
    return { ok: false, error: NOT_FOUND };
  }

  const redact = [row.prompt, row.imageUrl];

  // e. The blob goes first, and the ordering is the privacy argument. If this
  // fails, nothing is removed and the row still renders. Row-first would
  // invert that into a live public url behind a success message.
  try {
    await deleteGenerationImage(row.imageUrl);
  } catch (error) {
    console.error(
      "Generation image delete failed.",
      safeErrorMessage(error, redact),
    );
    return { ok: false, error: "The image could not be deleted. Try again." };
  }

  // f. The row, filtered on the owner again rather than trusting stage d.
  try {
    await deleteGenerationForOwner(row.id, userId);
  } catch (error) {
    console.error(
      "Generation record delete failed.",
      safeErrorMessage(error, redact),
    );
    return {
      ok: false,
      error:
        "The image was removed but its record could not be deleted. Try again.",
    };
  }

  // g. The surfaces that showed it. A private row's removal changes nothing
  // anyone else can see, so only a public one expires the landing gallery.
  revalidatePath("/generate");
  revalidatePath("/library");
  if (row.isPublic) {
    updateTag(PUBLIC_GALLERY_TAG);
    revalidatePath("/");
  }

  // The page's whole subject no longer exists, so there is no slot to render a
  // result into and staying is not an option. This is a stated deviation from
  // AGENTS.md 10 rule 5, recorded in docs/backend.md.
  //
  // `redirect` signals by throwing, so it sits outside every try above rather
  // than inside one that would swallow it as a failure.
  redirect(destination);
}
