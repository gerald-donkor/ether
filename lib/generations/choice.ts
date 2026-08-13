import {
  DEFAULT_MODEL_ID,
  GENERATION_COUNTS,
  IMAGE_MODELS,
  getModel,
  getModelSize,
  type ImageModelId,
} from "@/lib/ai/catalog";

/**
 * The three chosen values, and the fallback they resolve to.
 *
 * This used to live in `components/app/GenerationControls.tsx`. It moved here
 * when `/account` gained stored defaults, because the server now has to resolve
 * a stored row against the catalog before any client component renders, and the
 * fallback must have exactly one definition rather than one per caller. The
 * module is pure data over the pure-data catalog: it reads no environment
 * variable, which is why it is not `server-only`.
 */
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

/**
 * A stored default that is no longer in the closed list must not break
 * `/generate`. A model id is one edit away from leaving `lib/ai/catalog.ts`
 * (AGENTS.md 5.3 rule 2), and a row written before that edit would then name a
 * model the controls cannot render and the action would reject.
 *
 * So each field is resolved through the catalog and falls back on its own: an
 * unknown model falls back to the default model, and a size the resolved model
 * does not declare falls back to that model's first size. Nothing that is not
 * in the catalog is ever rendered as an option or sent to the action.
 */
export function resolveGenerationChoice(stored: {
  model: string;
  size: string;
  count: number;
} | null): GenerationChoice {
  if (!stored) return DEFAULT_GENERATION_CHOICE;

  const model = getModel(stored.model) ?? IMAGE_MODELS[DEFAULT_MODEL_ID];
  const size = getModelSize(model, stored.size) ?? model.sizes[0];
  const count = GENERATION_COUNTS.some(
    (value) => Number(value) === stored.count,
  )
    ? stored.count
    : DEFAULT_GENERATION_CHOICE.count;

  return { modelId: model.id, sizeKey: size.key, count };
}
