"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteGeneration,
  type DeleteGenerationState,
} from "@/app/(generation)/g/[id]/actions";
import {
  removeGeneration,
  restoreGeneration,
  type LibraryActionState,
} from "@/app/(app)/library/actions";
import {
  GENERATION_ID_FIELD,
  RETURN_TO_FIELD,
} from "@/lib/validation/generation";
import type { LibraryView } from "@/lib/validation/library";

const INITIAL_STATE: LibraryActionState = { ok: null, error: null };
const DELETE_INITIAL_STATE: DeleteGenerationState = { ok: null, error: null };

/**
 * The ghost treatment from components/app/DeleteGenerationButton.tsx, at the
 * 13px meta size the ledger row uses. Every other value is unchanged: the same
 * `--r-pill`, the same `--line` border, the same `--text-3` hover, the same
 * `active:scale`. Nothing destructive becomes a new colour, so the words carry
 * the weight (design-system.md 6.2).
 */
const control =
  "inline-flex items-center justify-center rounded-pill border border-line text-text hover:border-text-3 px-4 py-2 text-[13px] font-medium whitespace-nowrap transition-transform duration-200 ease-(--ease-out) active:scale-[0.98]";

function SubmitButton({
  ref,
  label,
  pendingLabel,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      ref={ref}
      type="submit"
      disabled={pending}
      className={`${control} disabled:cursor-wait disabled:opacity-70`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * A control that reveals its confirmation in markup rather than in a browser
 * dialog, moves focus to the confirm, and returns focus to the opener on
 * cancel. The pattern is `DeleteGenerationButton`'s, which the permalink still
 * owns for its own delete.
 */
function ConfirmingAction({
  opener,
  label,
  pendingLabel,
  sentence,
  action,
  children,
}: {
  opener: string;
  label: string;
  pendingLabel: string;
  sentence: string;
  action: (formData: FormData) => void;
  children: React.ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const openRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const hasOpened = useRef(false);

  useEffect(() => {
    if (confirming) {
      hasOpened.current = true;
      confirmRef.current?.focus();
    } else if (hasOpened.current) {
      openRef.current?.focus();
    }
  }, [confirming]);

  if (!confirming) {
    return (
      <button
        ref={openRef}
        type="button"
        onClick={() => setConfirming(true)}
        className={control}
      >
        {opener}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-text-2 max-w-[40ch] text-[13px] leading-[22px]">
        {sentence}
      </p>
      <form action={action} className="flex flex-wrap items-center gap-2">
        {children}
        <SubmitButton
          ref={confirmRef}
          label={label}
          pendingLabel={pendingLabel}
        />
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className={control}
        >
          Cancel
        </button>
      </form>
    </div>
  );
}

export function LibraryRowActions({
  id,
  view,
}: {
  id: string;
  view: LibraryView;
}) {
  const [removeState, removeAction] = useActionState(
    removeGeneration,
    INITIAL_STATE,
  );
  const [restoreState, restoreAction] = useActionState(
    restoreGeneration,
    INITIAL_STATE,
  );
  // A successful permanent delete redirects, so only its failure ever renders
  // here. The state is still read, because a swallowed failure would be the
  // silent success AGENTS.md 8.2 rule 4 forbids.
  const [deleteState, deleteAction] = useActionState(
    deleteGeneration,
    DELETE_INITIAL_STATE,
  );

  const state = view === "active" ? removeState : restoreState;
  const message =
    deleteState.error ??
    state.error ??
    (state.ok === true ? successFor(view) : "");

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap items-start gap-2 sm:justify-end">
        {view === "active" ? (
          <ConfirmingAction
            opener="Remove"
            label="Remove"
            pendingLabel="Removing..."
            sentence="This takes the image out of your library. You can restore it from the Removed view."
            action={removeAction}
          >
            <input type="hidden" name={GENERATION_ID_FIELD} value={id} />
          </ConfirmingAction>
        ) : (
          <>
            {/* Restore is one press, because it is not destructive. */}
            <form action={restoreAction}>
              <input type="hidden" name={GENERATION_ID_FIELD} value={id} />
              <SubmitButton label="Restore" pendingLabel="Restoring..." />
            </form>
            <ConfirmingAction
              opener="Delete permanently"
              label="Delete permanently"
              pendingLabel="Deleting..."
              sentence="This removes the image and its record for good. It cannot be undone."
              action={deleteAction}
            >
              <input type="hidden" name={GENERATION_ID_FIELD} value={id} />
              {/* The action accepts only its two known paths, so this decides
                  which of them, and never where. */}
              <input type="hidden" name={RETURN_TO_FIELD} value="/library" />
            </ConfirmingAction>
          </>
        )}
      </div>

      {/* The node stays mounted so a live region has something to update, and
          the message is a plain sentence at full contrast, so it reads without
          relying on colour. */}
      <p
        role="status"
        aria-live="polite"
        className={
          message
            ? "text-text max-w-[40ch] text-[13px] leading-[22px] sm:text-right"
            : "sr-only"
        }
      >
        {message}
      </p>
    </div>
  );
}

function successFor(view: LibraryView) {
  return view === "active"
    ? "Removed. It is in the Removed view."
    : "Restored to your library.";
}
