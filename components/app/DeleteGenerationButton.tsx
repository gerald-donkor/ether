"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteGeneration,
  type DeleteGenerationState,
} from "@/app/(generation)/g/[id]/actions";
import { GENERATION_ID_FIELD } from "@/lib/validation/generation";

const INITIAL_STATE: DeleteGenerationState = { ok: null, error: null };

/**
 * The ghost treatment from components/ui/Button.tsx, written out here because
 * `Button` renders an `<a>` and a destructive control has to be a real
 * `<button>`. The precedent is `GenerateButton` in PromptField.
 *
 * Delete does not become a new red. Two accents are locked, so the words carry
 * the weight instead (design-system.md 6.2).
 */
const control =
  "inline-flex items-center justify-center rounded-pill border border-line text-text hover:border-text-3 px-5 py-2.5 text-[14px] font-medium whitespace-nowrap transition-transform duration-200 ease-(--ease-out) active:scale-[0.98]";

function ConfirmButton({ ref }: { ref: React.Ref<HTMLButtonElement> }) {
  const { pending } = useFormStatus();

  return (
    <button
      ref={ref}
      type="submit"
      disabled={pending}
      className={`${control} disabled:cursor-wait disabled:opacity-70`}
    >
      {pending ? "Deleting..." : "Delete permanently"}
    </button>
  );
}

export function DeleteGenerationButton({ id }: { id: string }) {
  const [state, formAction] = useActionState(deleteGeneration, INITIAL_STATE);
  const [confirming, setConfirming] = useState(false);
  const openRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const hasOpened = useRef(false);

  // Revealing the confirm moves focus to it, and cancelling returns focus to
  // the control that opened it. The guard is what stops the first render from
  // taking focus off the page.
  useEffect(() => {
    if (confirming) {
      hasOpened.current = true;
      confirmRef.current?.focus();
    } else if (hasOpened.current) {
      openRef.current?.focus();
    }
  }, [confirming]);

  return (
    <div className="flex flex-col gap-3">
      {confirming ? (
        <>
          <p className="text-text-2 max-w-[46ch] text-[13px] leading-[22px]">
            This removes the image and its record for good. It cannot be undone.
          </p>
          <form action={formAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name={GENERATION_ID_FIELD} value={id} />
            <ConfirmButton ref={confirmRef} />
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
        <button
          ref={openRef}
          type="button"
          onClick={() => setConfirming(true)}
          className={control}
        >
          Delete
        </button>
      )}

      {/* The node stays mounted so a live region has something to update.
          The message is a plain sentence at full contrast, so it reads
          without relying on colour. */}
      <p
        role="status"
        aria-live="polite"
        className={
          state.error
            ? "text-text max-w-[46ch] text-[13px] leading-[22px]"
            : "sr-only"
        }
      >
        {state.error ?? ""}
      </p>
    </div>
  );
}
