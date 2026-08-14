"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import {
  listAllImageUrlsForOwner,
  ownerHasPublicGeneration,
  purgeOwnerData,
  savePreferencesForOwner,
} from "@/lib/db/account";
import { PUBLIC_GENERATIONS_TAG } from "@/lib/db/queries";
import { deleteGenerationImages } from "@/lib/storage/generations";
import { deleteStripeCustomerForOwner } from "@/lib/billing/customer";
import {
  DELETE_ACCOUNT_CONFIRM_FIELD,
  deleteAccountSchema,
  generationDefaultsSchema,
} from "@/lib/validation/account";
import {
  COUNT_FIELD,
  MODEL_FIELD,
  PUBLISH_FIELD,
  SIZE_FIELD,
} from "@/lib/validation/generation";

export type PreferencesActionState =
  | { ok: null; error: null }
  | { ok: false; error: string }
  | { ok: true; error: null };

export type DeleteAccountState =
  | { ok: null; error: null }
  | { ok: false; error: string };

/**
 * A database message can quote the row it failed on, and a Clerk message can
 * quote an email address. Both are user data, so only the error's name is ever
 * logged (AGENTS.md 8.3 rule 2).
 */
function errorName(error: unknown) {
  return error instanceof Error ? error.name : "Unknown error";
}

/**
 * The generation defaults. This is a convenience and never an authorisation or
 * a consent: `/generate` still parses its own submission with
 * `generationRequestSchema` and still derives publication from the submitted
 * checkbox. A stored `public` default sets that checkbox's initial state and
 * nothing more.
 */
export async function savePreferences(
  _previousState: PreferencesActionState,
  formData: FormData,
): Promise<PreferencesActionState> {
  // a. The session, read on the server. No owner id crosses from the browser.
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: "Sign in to save your defaults." };
  }

  // b. The shared schema, which is the same one the client leaf ran.
  const parsed = generationDefaultsSchema.safeParse({
    model: formData.get(MODEL_FIELD),
    size: formData.get(SIZE_FIELD),
    count: formData.get(COUNT_FIELD),
    publish: formData.get(PUBLISH_FIELD),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Those defaults could not be saved. Check the controls and try again.",
    };
  }

  // c. No quota check. Saving a preference spends no provider money.
  // d. Authorisation is the owner key: the row is written under the session id.
  try {
    await savePreferencesForOwner(userId, {
      model: parsed.data.model,
      size: parsed.data.size,
      count: parsed.data.count,
      visibility: parsed.data.publish,
    });
  } catch (error) {
    console.error("Generation defaults save failed.", errorName(error));
    return { ok: false, error: "Your defaults could not be saved. Try again." };
  }

  // h. The two routes that read the row.
  revalidatePath("/account");
  revalidatePath("/generate");

  return { ok: true, error: null };
}

/**
 * Account deletion: the Blob objects, then the rows, then the Clerk user.
 *
 * The ordering is the same argument `deleteGeneration` makes. Blobs first,
 * because a deleted row whose image is still live at a public url is a broken
 * promise behind a success message. Clerk last, because the sign-in is the one
 * thing that can be removed after the data without leaving anything readable.
 */
export async function deleteAccount(
  _previousState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  // a. The session.
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: "Sign in to delete your account." };
  }

  // b. The one field that crosses, parsed with the shared schema.
  const parsed = deleteAccountSchema.safeParse({
    confirm: formData.get(DELETE_ACCOUNT_CONFIRM_FIELD),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Confirm before deleting.",
    };
  }

  // c. No quota check. Deleting spends no provider money.
  // d. Authorisation is the owner filter: every statement below is scoped to
  // the session id, so there is no id to compare against a client-supplied one.

  // Read before anything is destroyed, because afterwards there is nothing left
  // to ask whether the public surfaces have to be expired.
  let imageUrls: string[];
  let hadPublicWork: boolean;
  try {
    [imageUrls, hadPublicWork] = await Promise.all([
      listAllImageUrlsForOwner(userId),
      ownerHasPublicGeneration(userId),
    ]);
  } catch (error) {
    console.error("Account deletion lookup failed.", errorName(error));
    return {
      ok: false,
      error: "Your account could not be deleted. Try again.",
    };
  }

  // e. The Blob objects. A chunk failure aborts before any row is deleted, so
  // nothing is half-removed behind a success message.
  try {
    await deleteGenerationImages(imageUrls);
  } catch (error) {
    console.error("Account image deletion failed.", errorName(error));
    return {
      ok: false,
      error:
        "Your images could not be removed, so nothing was deleted. Try again.",
    };
  }

  try {
    await deleteStripeCustomerForOwner(userId);
  } catch (error) {
    console.error("Stripe customer deletion failed.", errorName(error));
    return { ok: false, error: "Your billing account could not be removed, so your records were kept. Try again." };
  }

  // f. The rows, in one batched transaction.
  try {
    await purgeOwnerData(userId);
  } catch (error) {
    console.error("Account data purge failed.", errorName(error));
    return {
      ok: false,
      error:
        "Your images were removed but your records could not be deleted. Try again.",
    };
  }

  // g. The Clerk user. If this fails the data really is gone, so the message
  // says the true thing rather than a generic failure.
  try {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(userId);
  } catch (error) {
    console.error("Clerk user deletion failed.", errorName(error));
    return {
      ok: false,
      error:
        "Your images and records are deleted, but your sign-in could not be removed. Contact support to finish.",
    };
  }

  // h. The surfaces that showed the deleted work. A private history's removal
  // changes nothing anyone else can see, so only public work expires the
  // landing gallery and Community.
  revalidatePath("/account");
  revalidatePath("/generate");
  revalidatePath("/library");
  if (hadPublicWork) {
    updateTag(PUBLIC_GENERATIONS_TAG);
    revalidatePath("/");
    revalidatePath("/community");
  }

  // The account whose page this is no longer exists, so there is no slot to
  // render a result into. This is the same stated deviation from AGENTS.md 10
  // rule 5 that `deleteGeneration` already carries, recorded in
  // docs/backend.md. `redirect` signals by throwing, so it sits outside every
  // try above rather than inside one that would swallow it as a failure.
  redirect("/");
}
