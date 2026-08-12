"use client";

import { useId, type FormEvent } from "react";
import { useFormStatus } from "react-dom";

/**
 * The prompt field from the reference. It stays inert on the landing page and
 * becomes the real generation form when an action is supplied.
 *
 * It is still a real input with a real label. A styled div pretending to be a
 * field would be a fake screenshot, and a placeholder standing in for a label
 * would fail anyone using a screen reader.
 *
 * The input is uncontrolled: nothing reads the value, so holding it in state
 * would re-render on every keystroke for no reason.
 */
function GenerateButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-lime text-ink rounded-pill shrink-0 px-5 py-2.5 text-[14px] font-medium whitespace-nowrap transition-transform duration-200 ease-(--ease-out) active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Generating..." : "Generate"}
    </button>
  );
}

export function PromptField({
  action,
  describedBy,
  className = "mt-7",
}: {
  action?: (formData: FormData) => void | Promise<void>;
  describedBy?: string;
  className?: string;
}) {
  const id = useId();
  const preventSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <form
      id="generate"
      action={action}
      onSubmit={action ? undefined : preventSubmit}
      className={className}
    >
      <label htmlFor={id} className="text-text-3 block text-[12px] font-medium">
        Your prompt
      </label>

      <div className="bg-surface-2 rounded-pill mt-2 flex w-full min-w-0 items-center gap-2 py-1.5 pr-1.5 pl-5">
        <input
          id={id}
          name="prompt"
          type="text"
          maxLength={500}
          required={Boolean(action)}
          aria-describedby={describedBy}
          autoComplete="off"
          placeholder="A macaw, feathers beaded with water…"
          className="text-text placeholder:text-text-3 min-w-0 flex-1 bg-transparent py-2 text-[14px] outline-none"
        />
        <GenerateButton />
      </div>
    </form>
  );
}
