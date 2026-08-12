"use client";

import { useId } from "react";

/**
 * The prompt field from the reference. It is presentational: there is no
 * generation backend in this build, so the form does not submit.
 *
 * It is still a real input with a real label. A styled div pretending to be a
 * field would be a fake screenshot, and a placeholder standing in for a label
 * would fail anyone using a screen reader.
 *
 * The input is uncontrolled: nothing reads the value, so holding it in state
 * would re-render on every keystroke for no reason.
 */
export function PromptField() {
  const id = useId();

  return (
    <form id="generate" onSubmit={(e) => e.preventDefault()} className="mt-7">
      <label htmlFor={id} className="text-text-3 block text-[12px] font-medium">
        Your prompt
      </label>

      <div className="bg-surface-2 rounded-pill mt-2 flex w-full min-w-0 items-center gap-2 py-1.5 pr-1.5 pl-5">
        <input
          id={id}
          name="prompt"
          type="text"
          autoComplete="off"
          placeholder="A macaw, feathers beaded with water…"
          className="text-text placeholder:text-text-3 min-w-0 flex-1 bg-transparent py-2 text-[14px] outline-none"
        />
        <button
          type="submit"
          className="bg-lime text-ink rounded-pill shrink-0 px-5 py-2.5 text-[14px] font-medium transition-transform duration-200 ease-(--ease-out) active:scale-[0.98]"
        >
          Generate
        </button>
      </div>
    </form>
  );
}
