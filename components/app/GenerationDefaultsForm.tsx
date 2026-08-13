"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  savePreferences,
  type PreferencesActionState,
} from "@/app/(app)/account/actions";
import { GenerationControls } from "@/components/app/GenerationControls";
import type { GenerationChoice } from "@/lib/generations/choice";
import { PUBLISH_FIELD, PUBLISH_VALUE } from "@/lib/validation/generation";

const INITIAL_STATE: PreferencesActionState = { ok: null, error: null };

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-lime text-ink rounded-pill inline-flex items-center justify-center px-5 py-2.5 text-[14px] font-medium whitespace-nowrap transition-transform duration-200 ease-(--ease-out) active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Saving..." : "Save defaults"}
    </button>
  );
}

/**
 * The generation defaults, rendered with the same `GenerationControls` the
 * generator uses, so the account form and the generate form cannot offer
 * different options. The publish checkbox is the same closed name and value
 * pair `PromptField` sends.
 *
 * The controls are controlled here for the same reason the workspace controls
 * them: switching model has to move the size to one that model declares.
 */
export function GenerationDefaultsForm({
  initialChoice,
  initialPublish,
}: {
  initialChoice: GenerationChoice;
  initialPublish: boolean;
}) {
  const id = useId();
  const [state, formAction] = useActionState(savePreferences, INITIAL_STATE);
  const [choice, setChoice] = useState<GenerationChoice>(initialChoice);
  const [publish, setPublish] = useState(initialPublish);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const publishRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok !== null) statusRef.current?.focus();
  }, [state]);

  // The same reset defect `GenerationControls` documents, for the same reason:
  // React calls the form's native `reset()` after a Server Action settles, and
  // native reset reverts a checkbox to its HTML default without React learning
  // the DOM moved. No dependency array, so this runs after every commit and is
  // a no-op whenever the DOM already agrees.
  useEffect(() => {
    if (publishRef.current) publishRef.current.checked = publish;
  });

  const message = state.error
    ? state.error
    : state.ok === true
      ? "Defaults saved. New generations start from them."
      : "";

  return (
    <form action={formAction} className="mt-6">
      <GenerationControls choice={choice} onChange={setChoice} />

      <div className="mt-4 flex items-start gap-2.5">
        <input
          ref={publishRef}
          id={`${id}-publish`}
          name={PUBLISH_FIELD}
          value={PUBLISH_VALUE}
          type="checkbox"
          checked={publish}
          onChange={(event) => setPublish(event.target.checked)}
          className="accent-lime mt-px size-4 shrink-0"
        />
        <label
          htmlFor={`${id}-publish`}
          className="text-text-2 max-w-[62ch] text-[13px] leading-[20px]"
        >
          Start new generations with the publish box already checked. You still
          confirm it on every generation.
        </label>
      </div>

      <div className="mt-6">
        <SaveButton />
      </div>

      {/* Mounted from first paint, so the live region has something to update
          and the result reserves its own space. The message is a plain
          sentence at full contrast, so it reads without relying on colour. */}
      <p
        ref={statusRef}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        className={
          message
            ? "text-text mt-4 max-w-[62ch] text-[13px] leading-[22px]"
            : "sr-only"
        }
      >
        {message}
      </p>
    </form>
  );
}
