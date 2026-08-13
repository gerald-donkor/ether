"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  deleteAccount,
  type DeleteAccountState,
} from "@/app/(app)/account/actions";
import {
  DELETE_ACCOUNT_CONFIRM_FIELD,
  DELETE_ACCOUNT_WORD,
} from "@/lib/validation/account";

const INITIAL_STATE: DeleteAccountState = { ok: null, error: null };

/**
 * The ghost treatment from components/ui/Button.tsx, written out here because
 * `Button` renders an `<a>` and a destructive control has to be a real
 * `<button>`. The precedent is `DeleteGenerationButton`.
 *
 * Delete does not become a new red. Two accents are locked, so the words carry
 * the weight instead (design-system.md 6.2).
 */
const control =
  "inline-flex items-center justify-center rounded-pill border border-line text-text hover:border-text-3 px-5 py-2.5 text-[14px] font-medium whitespace-nowrap transition-transform duration-200 ease-(--ease-out) active:scale-[0.98]";

function ConfirmButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${control} disabled:cursor-wait disabled:opacity-70`}
    >
      {pending ? "Deleting..." : "Delete my account"}
    </button>
  );
}

/**
 * A two-step confirm in markup, not a browser `confirm()` dialog. The first
 * press reveals the consequence in a plain sentence and a field that has to be
 * typed, focus moves to that field, and cancelling returns focus to the opener.
 */
export function DeleteAccountForm() {
  const id = useId();
  const [state, formAction] = useActionState(deleteAccount, INITIAL_STATE);
  const [confirming, setConfirming] = useState(false);
  const openRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const hasOpened = useRef(false);

  useEffect(() => {
    if (confirming) {
      hasOpened.current = true;
      inputRef.current?.focus();
    } else if (hasOpened.current) {
      openRef.current?.focus();
    }
  }, [confirming]);

  useEffect(() => {
    if (state.ok !== null) statusRef.current?.focus();
  }, [state]);

  return (
    <div className="mt-6 flex flex-col gap-4">
      {confirming ? (
        <>
          <p className="text-text-2 max-w-[62ch] text-[13px] leading-[22px]">
            This deletes every image you have generated, including the ones you
            removed, along with your usage records and your sign-in. It happens
            immediately and it cannot be undone.
          </p>
          <form
            action={formAction}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-[220px]">
              <label
                htmlFor={`${id}-confirm`}
                className="text-text-3 block text-[13px]"
              >
                Type {DELETE_ACCOUNT_WORD} to confirm
              </label>
              <input
                ref={inputRef}
                id={`${id}-confirm`}
                name={DELETE_ACCOUNT_CONFIRM_FIELD}
                type="text"
                required
                autoComplete="off"
                aria-describedby={`${id}-status`}
                className="bg-surface-2 text-text rounded-pill mt-2 w-full px-5 py-2.5 text-[14px] outline-none"
              />
            </div>
            <ConfirmButton />
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={control}
            >
              Cancel
            </button>
          </form>
        </>
      ) : (
        <div>
          <button
            ref={openRef}
            type="button"
            onClick={() => setConfirming(true)}
            className={control}
          >
            Delete account
          </button>
        </div>
      )}

      {/* Mounted from first paint so the live region has something to update.
          A plain sentence at full contrast, legible without colour. */}
      <p
        ref={statusRef}
        id={`${id}-status`}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        className={
          state.error
            ? "text-text max-w-[62ch] text-[13px] leading-[22px]"
            : "sr-only"
        }
      >
        {state.error ?? ""}
      </p>
    </div>
  );
}
