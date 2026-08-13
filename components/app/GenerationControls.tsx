"use client";

import { useEffect, useId, useRef } from "react";

import {
  DEFAULT_MODEL_ID,
  GENERATION_COUNTS,
  IMAGE_MODELS,
  IMAGE_MODEL_IDS,
  getModelSize,
  type ImageModelId,
} from "@/lib/ai/catalog";
import {
  COUNT_FIELD,
  MODEL_FIELD,
  SIZE_FIELD,
} from "@/lib/validation/generation";

/** The three chosen values. The workspace owns them, because it needs the size
 * and count to reserve the right result slots, and because they have to survive
 * React resetting the form after an action. */
export type GenerationChoice = {
  modelId: ImageModelId;
  sizeKey: string;
  count: number;
};

export const DEFAULT_GENERATION_CHOICE: GenerationChoice = {
  modelId: DEFAULT_MODEL_ID,
  sizeKey: IMAGE_MODELS[DEFAULT_MODEL_ID].sizes[0].key,
  count: Number(GENERATION_COUNTS[0]),
};

/** The reserved result slot's shape, resolved from the chosen model and size. */
export function choiceDimensions(choice: GenerationChoice) {
  const model = IMAGE_MODELS[choice.modelId];
  const size = getModelSize(model, choice.sizeKey) ?? model.sizes[0];
  return { width: size.width, height: size.height };
}

const CONTROL_CLASS =
  "bg-surface-2 rounded-pill text-text max-w-full px-4 py-2 text-[13px]";
const LABEL_CLASS = "text-text-3 text-[13px] font-medium";

/**
 * The three controls, as native selects with real labels, so each one inherits
 * the global lime focus ring and the platform's own keyboard behaviour.
 *
 * All three are controlled from the workspace, which needs the size and count
 * to reserve the right result slots.
 *
 * **The effect below is not optional.** React calls the form element's native
 * `reset()` after a Server Action settles, in the layout phase of the commit
 * (`commitLayoutEffectOnFiber` in `react-dom-client`), and native reset reverts
 * every control to its HTML default. React's own value props are unchanged, so
 * nothing re-renders and React never learns the DOM moved: the selects would
 * show defaults while the page still believed the user's choice, which is
 * exactly the desync this fixes. Passive effects flush after the layout phase,
 * so this is the first moment the values can be put back, and writing them here
 * also means a generation no longer discards the model and size that were
 * picked.
 */
export function GenerationControls({
  choice,
  onChange,
}: {
  choice: GenerationChoice;
  onChange: (choice: GenerationChoice) => void;
}) {
  const id = useId();
  const model = IMAGE_MODELS[choice.modelId];

  const modelRef = useRef<HTMLSelectElement>(null);
  const sizeRef = useRef<HTMLSelectElement>(null);
  const countRef = useRef<HTMLSelectElement>(null);

  // No dependency array: this runs after every commit, which is what catches
  // the one commit that reset the form. Each write is a no-op when the DOM
  // already agrees.
  useEffect(() => {
    if (modelRef.current) modelRef.current.value = choice.modelId;
    if (sizeRef.current) sizeRef.current.value = choice.sizeKey;
    if (countRef.current) countRef.current.value = String(choice.count);
  });

  return (
    <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-4">
      <div className="flex min-w-0 flex-col gap-2">
        <label htmlFor={`${id}-model`} className={LABEL_CLASS}>
          Model
        </label>
        <select
          ref={modelRef}
          id={`${id}-model`}
          name={MODEL_FIELD}
          value={choice.modelId}
          onChange={(event) => {
            const modelId = event.target.value as ImageModelId;
            // Each model declares its own sizes, so switching model falls back
            // to that model's first size rather than keeping one it may not
            // accept.
            onChange({
              ...choice,
              modelId,
              sizeKey: IMAGE_MODELS[modelId].sizes[0].key,
            });
          }}
          className={CONTROL_CLASS}
        >
          {IMAGE_MODEL_IDS.map((entryId) => (
            <option key={entryId} value={entryId}>
              {IMAGE_MODELS[entryId].label}
              {IMAGE_MODELS[entryId].beta ? " (beta)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <label htmlFor={`${id}-size`} className={LABEL_CLASS}>
          Size
        </label>
        <select
          ref={sizeRef}
          id={`${id}-size`}
          name={SIZE_FIELD}
          value={choice.sizeKey}
          onChange={(event) =>
            onChange({ ...choice, sizeKey: event.target.value })
          }
          className={CONTROL_CLASS}
        >
          {model.sizes.map((size) => (
            <option key={size.key} value={size.key}>
              {size.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <label htmlFor={`${id}-count`} className={LABEL_CLASS}>
          Images
        </label>
        <select
          ref={countRef}
          id={`${id}-count`}
          name={COUNT_FIELD}
          value={String(choice.count)}
          onChange={(event) =>
            onChange({ ...choice, count: Number(event.target.value) })
          }
          className={CONTROL_CLASS}
        >
          {GENERATION_COUNTS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </div>

      <p className="text-text-3 max-w-[42ch] text-[13px] leading-[22px]">
        {model.note}
      </p>
    </div>
  );
}
