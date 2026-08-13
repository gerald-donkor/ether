"use client";

import { useId, useRef, useState } from "react";

import {
  DEFAULT_MODEL_ID,
  GENERATION_COUNTS,
  IMAGE_MODELS,
  IMAGE_MODEL_IDS,
  type ImageModel,
  type ImageModelId,
} from "@/lib/ai/catalog";
import {
  COUNT_FIELD,
  MODEL_FIELD,
  SIZE_FIELD,
} from "@/lib/validation/generation";

/** What the workspace needs in order to reserve the right shape and number of
 * result slots before the response arrives. */
export type GenerationLayout = {
  width: number;
  height: number;
  count: number;
};

const DEFAULT_MODEL = IMAGE_MODELS[DEFAULT_MODEL_ID];

export const DEFAULT_GENERATION_LAYOUT: GenerationLayout = {
  width: DEFAULT_MODEL.sizes[0].width,
  height: DEFAULT_MODEL.sizes[0].height,
  count: 1,
};

const CONTROL_CLASS =
  "bg-surface-2 rounded-pill text-text max-w-full px-4 py-2 text-[13px]";
const LABEL_CLASS = "text-text-3 text-[13px] font-medium";

/**
 * The three controls, as native selects with real labels, so each one inherits
 * the global lime focus ring and the platform's own keyboard behaviour.
 *
 * Only the model id is state, because it is the one value that changes what
 * another control offers: each model declares its own sizes. The size select
 * is remounted with `key` when the model changes, so it can never show a size
 * the chosen model does not accept. Size and count are lifted to the workspace
 * through `onLayoutChange`, from event handlers rather than an effect.
 */
export function GenerationControls({
  onLayoutChange,
}: {
  onLayoutChange: (layout: GenerationLayout) => void;
}) {
  const id = useId();
  const [modelId, setModelId] = useState<ImageModelId>(DEFAULT_MODEL_ID);

  // Transient values that nothing renders from, so they do not need to cause a
  // re-render when they change.
  const sizeKeyRef = useRef(DEFAULT_MODEL.sizes[0].key);
  const countRef = useRef(DEFAULT_GENERATION_LAYOUT.count);

  const model = IMAGE_MODELS[modelId];

  function report(nextModel: ImageModel, sizeKey: string, count: number) {
    const size =
      nextModel.sizes.find((entry) => entry.key === sizeKey) ??
      nextModel.sizes[0];
    onLayoutChange({ width: size.width, height: size.height, count });
  }

  return (
    <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-4">
      <div className="flex min-w-0 flex-col gap-2">
        <label htmlFor={`${id}-model`} className={LABEL_CLASS}>
          Model
        </label>
        <select
          id={`${id}-model`}
          name={MODEL_FIELD}
          value={modelId}
          onChange={(event) => {
            const nextId = event.target.value as ImageModelId;
            const nextModel = IMAGE_MODELS[nextId];
            setModelId(nextId);
            sizeKeyRef.current = nextModel.sizes[0].key;
            report(nextModel, sizeKeyRef.current, countRef.current);
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
          key={modelId}
          id={`${id}-size`}
          name={SIZE_FIELD}
          defaultValue={model.sizes[0].key}
          onChange={(event) => {
            sizeKeyRef.current = event.target.value;
            report(model, sizeKeyRef.current, countRef.current);
          }}
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
          id={`${id}-count`}
          name={COUNT_FIELD}
          defaultValue={GENERATION_COUNTS[0]}
          onChange={(event) => {
            countRef.current = Number(event.target.value);
            report(model, sizeKeyRef.current, countRef.current);
          }}
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
