/**
 * The closed list of image models, the sizes each one offers, and how each one
 * is called and decoded. Three places need this list: the shared schema in
 * `lib/validation/`, the client leaf that renders the selects, and the Server
 * Action. Duplicating it would give the closed list two definitions and one
 * drift, so it lives here once.
 *
 * This module is deliberately **not** `server-only`. It is pure data: it reads
 * no environment variable and imports nothing. `lib/ai/generate.ts` keeps
 * `server-only` and stays the only module that reads CLOUDFLARE_ACCOUNT_ID or
 * CLOUDFLARE_API_TOKEN. See AGENTS.md 6.3.
 */

export const FLUX_SCHNELL_ID = "@cf/black-forest-labs/flux-1-schnell";
export const SDXL_LIGHTNING_ID = "@cf/bytedance/stable-diffusion-xl-lightning";

/** The three counts a single request may ask for. Form values, so strings. */
export const GENERATION_COUNTS = ["1", "2", "4"] as const;

export type GenerationCount = (typeof GENERATION_COUNTS)[number];

export type ImageModelSize = {
  key: string;
  label: string;
  width: number;
  height: number;
};

export type ImageModel = {
  id: ImageModelId;
  label: string;
  /** One plain line shown next to the control. No hype, no em-dash. */
  note: string;
  beta: boolean;
  steps: number;
  sizes: readonly ImageModelSize[];
  /**
   * `native` means the model accepts no dimensions and its output size is
   * whatever it produces. `explicit` means width and height are sent.
   */
  sizing: "native" | "explicit";
  bodyStyle: "prompt-steps" | "prompt-dimensions";
  /** Measured from a real call, never taken from the model page. */
  responseStyle: "json-base64" | "binary";
  /** Tenths of a neuron reserved before one provider call. */
  providerUnitsPerImage: number;
};

/** The smallest integer scale that represents every verified catalog cost. */
export const PROVIDER_UNITS_PER_NEURON = 10;

export const IMAGE_MODEL_IDS = [FLUX_SCHNELL_ID, SDXL_LIGHTNING_ID] as const;

export type ImageModelId = (typeof IMAGE_MODEL_IDS)[number];

export const IMAGE_MODELS: Readonly<Record<ImageModelId, ImageModel>> = {
  /**
   * Verified against Cloudflare's live model page on 2026-08-13:
   * https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
   *
   * Takes `prompt`, `seed` and `steps` only, so there is no width or height to
   * send and the single size below is the output measured in docs/backend.md.
   * Cloudflare's pricing table still lists 4.80 neurons per 512x512 tile and
   * 9.60 per step. A live 1024x1024 call on 2026-08-13 returned the more
   * conservative `cf-ai-neurons: 172.80`, so reservations use that measured
   * response cost until the provider reconciles the discrepancy.
   */
  [FLUX_SCHNELL_ID]: {
    id: FLUX_SCHNELL_ID,
    label: "FLUX.1 schnell",
    note: "Fast, square output at a fixed size.",
    beta: false,
    steps: 4,
    sizing: "native",
    bodyStyle: "prompt-steps",
    responseStyle: "json-base64",
    providerUnitsPerImage: 1728,
    sizes: [
      { key: "square", label: "Square, 1024 x 1024", width: 1024, height: 1024 },
    ],
  },

  /**
   * Verified against Cloudflare's live model page on 2026-08-13:
   * https://developers.cloudflare.com/workers-ai/models/stable-diffusion-xl-lightning/
   *
   * The page documents width and height in the 256 to 2048 range and marks the
   * model beta. It does not state the REST response shape, so it was measured
   * on 2026-08-13: HTTP 200 with a raw image body, `cf-ai-neurons: 0.00`, and
   * no neuron row in the pricing table. The response's `content-type` header
   * said `image/png` while the bytes were JPEG, which is why the media type is
   * always sniffed off the bytes and never read from the header.
   *
   * Every size below is inside the documented range and a multiple of 64.
   */
  [SDXL_LIGHTNING_ID]: {
    id: SDXL_LIGHTNING_ID,
    label: "SDXL Lightning",
    note: "Beta. Offers landscape and portrait as well as square.",
    beta: true,
    steps: 4,
    sizing: "explicit",
    bodyStyle: "prompt-dimensions",
    responseStyle: "binary",
    providerUnitsPerImage: 0,
    sizes: [
      { key: "square", label: "Square, 1024 x 1024", width: 1024, height: 1024 },
      {
        key: "landscape",
        label: "Landscape, 1280 x 768",
        width: 1280,
        height: 768,
      },
      {
        key: "portrait",
        label: "Portrait, 768 x 1280",
        width: 768,
        height: 1280,
      },
    ],
  },
};

/**
 * The default is the model whose cost was measured: 172.80 neurons an image
 * against an account-wide allocation of 10,000 neurons a day.
 */
export const DEFAULT_MODEL_ID: ImageModelId = FLUX_SCHNELL_ID;

/** Returns `undefined` for anything not in the record, so an unknown id from
 * anywhere cannot be treated as a model. */
export function getModel(id: string): ImageModel | undefined {
  return IMAGE_MODELS[id as ImageModelId];
}

/** Resolves a size within a model, or `undefined` if the model does not
 * declare it. The model and size are only ever valid as a pair. */
export function getModelSize(
  model: ImageModel,
  sizeKey: string,
): ImageModelSize | undefined {
  return model.sizes.find((size) => size.key === sizeKey);
}
