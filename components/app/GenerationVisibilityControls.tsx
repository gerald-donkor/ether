"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  changeGenerationVisibility,
  type VisibilityActionState,
} from "@/app/(generation)/g/[id]/actions";
import {
  GENERATION_VISIBILITIES,
  type GenerationVisibility,
} from "@/lib/generations/visibility";
import { GENERATION_ID_FIELD } from "@/lib/validation/generation";
import { VISIBILITY_FIELD } from "@/lib/validation/visibility";

const INITIAL_STATE: VisibilityActionState = {
  ok: null,
  error: null,
  visibility: null,
};

const control =
  "inline-flex items-center justify-center rounded-pill px-5 py-2.5 text-[14px] font-medium whitespace-nowrap transition-transform duration-200 ease-(--ease-out) active:scale-[0.98]";

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${control} bg-lime text-ink disabled:cursor-wait disabled:opacity-70`}
    >
      {pending ? "Saving..." : "Save visibility"}
    </button>
  );
}

function visibilityLabel(value: GenerationVisibility) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

export function GenerationVisibilityControls({
  id,
  visibility,
}: {
  id: string;
  visibility: GenerationVisibility;
}) {
  const [state, formAction] = useActionState(
    changeGenerationVisibility,
    INITIAL_STATE,
  );
  const [selected, setSelected] = useState(visibility);
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "pending" | "success" | "failure"
  >("idle");
  const statusRef = useRef<HTMLParagraphElement>(null);
  const effectiveVisibility =
    state.ok === true ? state.visibility : visibility;
  const shareable = effectiveVisibility !== "private";

  useEffect(() => {
    if (state.ok !== null) statusRef.current?.focus();
  }, [state]);

  async function copyLink() {
    setCopyStatus("pending");
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(
        new URL(`/g/${id}`, window.location.origin).href,
      );
      setCopyStatus("success");
    } catch {
      setCopyStatus("failure");
    }
    statusRef.current?.focus();
  }

  const message =
    copyStatus === "success"
      ? "Link copied."
      : copyStatus === "failure"
        ? "The link could not be copied. Use the link shown here."
        : state.error
          ? state.error
          : state.ok === true
            ? `Visibility saved as ${visibilityLabel(state.visibility)}.`
            : "";

  return (
    <section className="border-line mt-8 border-t pt-8" aria-labelledby="visibility-title">
      <h2 id="visibility-title" className="text-text text-[22px] leading-[30px]">
        Sharing
      </h2>
      <p
        id="visibility-help"
        className="text-text-2 mt-3 max-w-[62ch] text-[13px] leading-[22px]"
      >
        Private is visible only to you. Unlisted works for anyone with the exact
        link. Public also appears on the home page and in Community. Your prompt
        stays private.
      </p>

      <form action={formAction} className="mt-5 flex flex-wrap items-end gap-3">
        <input type="hidden" name={GENERATION_ID_FIELD} value={id} />
        <div className="min-w-[220px]">
          <label htmlFor="generation-visibility" className="text-text-3 block text-[13px]">
            Visibility
          </label>
          <select
            id="generation-visibility"
            name={VISIBILITY_FIELD}
            value={selected}
            onChange={(event) =>
              setSelected(event.target.value as GenerationVisibility)
            }
            aria-describedby="visibility-help"
            className="bg-surface-2 text-text rounded-pill mt-2 w-full px-5 py-2.5 text-[14px]"
          >
            {GENERATION_VISIBILITIES.map((value) => (
              <option key={value} value={value}>
                {visibilityLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <SaveButton />
      </form>

      {shareable ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <LinkValue id={id} />
          <button
            type="button"
            onClick={copyLink}
            disabled={copyStatus === "pending"}
            className={`${control} border-line text-text hover:border-text-3 border disabled:cursor-wait disabled:opacity-70`}
          >
            {copyStatus === "pending" ? "Copying..." : "Copy link"}
          </button>
        </div>
      ) : null}

      <p
        ref={statusRef}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        className={message ? "text-text mt-4 text-[13px] leading-[22px]" : "sr-only"}
      >
        {message}
      </p>
    </section>
  );
}

function LinkValue({ id }: { id: string }) {
  return (
    <a
      href={`/g/${id}`}
      className="text-text-2 hover:text-text rounded-sm break-all text-[13px] transition-colors"
    >
      /g/{id}
    </a>
  );
}
