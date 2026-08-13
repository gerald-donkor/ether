"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  reportGeneration,
  type ReportActionState,
} from "@/app/(generation)/g/[id]/report/actions";
import {
  REPORT_CATEGORIES,
  REPORT_GENERATION_FIELD,
  REPORT_REASON_FIELD,
  REPORT_REASON_LABELS,
  reportSchema,
} from "@/lib/validation/report";

const INITIAL_STATE: ReportActionState = { ok: null, status: "idle", message: "" };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="bg-lime text-ink rounded-pill inline-flex items-center justify-center px-5 py-2.5 text-[14px] font-medium whitespace-nowrap transition-transform duration-200 ease-(--ease-out) active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Submitting..." : "Submit report"}
    </button>
  );
}

export function ReportGenerationForm({ generationId }: { generationId: string }) {
  const [state, formAction] = useActionState(reportGeneration, INITIAL_STATE);
  const [clientError, setClientError] = useState("");
  const statusRef = useRef<HTMLParagraphElement>(null);
  const settled = state.ok === true;

  useEffect(() => {
    if (state.ok !== null) statusRef.current?.focus();
  }, [state]);

  return (
    <form
      action={formAction}
      className="border-line mt-10 border-t pt-8"
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const parsed = reportSchema.safeParse({
          generationId: data.get(REPORT_GENERATION_FIELD),
          reason: data.get(REPORT_REASON_FIELD),
        });
        if (!parsed.success) {
          event.preventDefault();
          setClientError(parsed.error.issues[0]?.message ?? "Check the report and try again.");
          statusRef.current?.focus();
        } else {
          setClientError("");
        }
      }}
    >
      <input type="hidden" name={REPORT_GENERATION_FIELD} value={generationId} />
      <label htmlFor="report-reason" className="text-text-3 block text-[13px]">
        Reason
      </label>
      <select
        id="report-reason"
        name={REPORT_REASON_FIELD}
        disabled={settled}
        defaultValue=""
        className="bg-surface-2 text-text rounded-pill mt-2 w-full max-w-[420px] px-5 py-2.5 text-[14px]"
      >
        <option value="" disabled>Choose a reason</option>
        {REPORT_CATEGORIES.map((category) => (
          <option key={category} value={category}>{REPORT_REASON_LABELS[category]}</option>
        ))}
      </select>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SubmitButton disabled={settled} />
        <a
          href={`/g/${generationId}`}
          className="border-line text-text hover:border-text-3 rounded-pill inline-flex items-center justify-center border px-5 py-2.5 text-[14px] font-medium whitespace-nowrap transition-transform duration-200 ease-(--ease-out) active:scale-[0.98]"
        >
          Back to image
        </a>
      </div>
      <p
        ref={statusRef}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        className={clientError || state.message ? "text-text mt-5 text-[13px] leading-[22px]" : "sr-only"}
      >
        {clientError || state.message}
      </p>
    </form>
  );
}
