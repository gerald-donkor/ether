import "server-only";

import { getModel, getModelSize } from "./catalog";
import {
  IMAGE_MODERATION_MODEL_ID,
  IMAGE_MODERATION_POLICY,
  parseImageModeration,
  parsePromptModeration,
  PROMPT_MODERATION_MODEL_ID,
  type ModerationCategory,
  type ModerationDecision,
} from "./moderation";

const CLOUDFLARE_ACCOUNTS_ENDPOINT =
  "https://api.cloudflare.com/client/v4/accounts";

/**
 * A provider that is unreachable, unauthorized, or out of its daily allocation
 * is not something the user can type their way past, so it must not be
 * reported as a prompt problem. The caller reads this to pick the message.
 */
export type ImageGenerationFailureKind =
  | "provider_unavailable"
  | "generation_rejected";

export class ImageGenerationError extends Error {
  readonly kind: ImageGenerationFailureKind;

  constructor(kind: ImageGenerationFailureKind, message: string) {
    super(message);
    this.name = "ImageGenerationError";
    this.kind = kind;
  }
}

type CloudflareRunResponse = {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  result?: { image?: string };
};

type ModerationRunResponse = {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  result?: {
    response?: unknown;
    result?: { answer?: unknown };
  };
};

async function runModerationModel(model: string, body: unknown) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) return null;

  try {
    const response = await fetch(
      `${CLOUDFLARE_ACCOUNTS_ENDPOINT}/${accountId}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as ModerationRunResponse;
    return payload.success === true ? payload : null;
  } catch {
    return null;
  }
}

export async function screenPrompt(prompt: string): Promise<ModerationDecision> {
  const payload = await runModerationModel(PROMPT_MODERATION_MODEL_ID, {
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    max_tokens: 16,
  });
  return parsePromptModeration(payload?.result?.response);
}

export async function screenImage({
  bytes,
  mediaType,
  reportedCategory,
}: {
  bytes: Uint8Array;
  mediaType: "image/png" | "image/jpeg";
  reportedCategory?: ModerationCategory;
}): Promise<ModerationDecision> {
  const categoryContext = reportedCategory
    ? ` The report category is ${reportedCategory}. Apply the same policy and do not assume the report is correct.`
    : "";
  const payload = await runModerationModel(IMAGE_MODERATION_MODEL_ID, {
    task: "query",
    image: `data:${mediaType};base64,${Buffer.from(bytes).toString("base64")}`,
    question: `${IMAGE_MODERATION_POLICY}${categoryContext}`,
    reasoning: false,
    temperature: 0,
    max_tokens: 16,
    stream: false,
  });
  return parseImageModeration(payload?.result?.result?.answer);
}

function readPngDimensions(bytes: Uint8Array) {
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!pngSignature.every((byte, index) => bytes[index] === byte)) return null;
  if (bytes.length < 24) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpegDimensions(bytes: Uint8Array) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
    if (length < 2) return null;

    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: (bytes[offset + 5] << 8) + bytes[offset + 6],
        width: (bytes[offset + 7] << 8) + bytes[offset + 8],
      };
    }

    offset += length + 2;
  }

  return null;
}

/**
 * The size and the encoding are read off the bytes that arrived, for every
 * model, including the one the request asked for a size from. The default
 * model documents neither. The other returns a raw body whose `content-type`
 * header said `image/png` over JPEG bytes when it was measured on 2026-08-13,
 * so the header cannot be trusted either. The media type decides the stored
 * file's extension, so guessing it would write a mislabelled blob.
 */
function readImage(
  bytes: Uint8Array,
): { mediaType: "image/png" | "image/jpeg"; width: number; height: number } | null {
  const png = readPngDimensions(bytes);
  if (png) return { mediaType: "image/png", ...png };

  const jpeg = readJpegDimensions(bytes);
  if (jpeg) return { mediaType: "image/jpeg", ...jpeg };

  return null;
}

function describeErrors(errors: CloudflareRunResponse["errors"]) {
  if (!errors?.length) return "no error detail returned";
  return errors
    .map((entry) => `${entry.code ?? "unknown"}: ${entry.message ?? "no message"}`)
    .join("; ");
}

/** Both response styles report a failure as a JSON envelope, so an error body
 * is read the same way whether the success path would have been bytes or
 * JSON. */
function describeErrorBody(body: string) {
  try {
    const payload = JSON.parse(body) as CloudflareRunResponse;
    return describeErrors(payload.errors);
  } catch {
    return "no readable error detail returned";
  }
}

export async function generateImageForPrompt({
  prompt,
  modelId,
  sizeKey,
}: {
  prompt: string;
  modelId: string;
  sizeKey: string;
}) {
  // Read inside the function, never at module scope. `next build` evaluates
  // top-level module code, so a client built at import time against an unset
  // variable would fail the build before any route renders.
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new ImageGenerationError(
      "provider_unavailable",
      "CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is not set.",
    );
  }

  // The schema rejects an unknown model or a size the model does not declare
  // before anything reaches here, so either one arriving now is a bug in this
  // codebase rather than a state the user can be told to act on.
  const model = getModel(modelId);
  if (!model) {
    throw new ImageGenerationError(
      "provider_unavailable",
      `Unknown model id: ${modelId}`,
    );
  }

  const size = getModelSize(model, sizeKey);
  if (!size) {
    throw new ImageGenerationError(
      "provider_unavailable",
      `Unknown size "${sizeKey}" for model ${modelId}`,
    );
  }

  const body =
    model.bodyStyle === "prompt-dimensions"
      ? {
          prompt,
          width: size.width,
          height: size.height,
          num_steps: model.steps,
        }
      : // There is no width or height parameter to send for this style.
        { prompt, steps: model.steps };

  let response: Response;
  try {
    response = await fetch(
      `${CLOUDFLARE_ACCOUNTS_ENDPOINT}/${accountId}/ai/run/${model.id}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
  } catch {
    throw new ImageGenerationError(
      "provider_unavailable",
      "The image provider could not be reached.",
    );
  }

  if (!response.ok) {
    const detail = describeErrorBody(await response.text().catch(() => ""));

    // 400 is the provider rejecting this particular request. Every other
    // status is the provider being unusable: unauthorized, throttled, or down.
    throw new ImageGenerationError(
      response.status === 400 ? "generation_rejected" : "provider_unavailable",
      `HTTP ${response.status}. ${detail}`,
    );
  }

  const bytes =
    model.responseStyle === "binary"
      ? await readBinaryBody(response)
      : await readJsonBody(response);

  const image = readImage(bytes);
  if (!image) {
    // A binary-style model reports a model error as a JSON body inside a 200,
    // which lands here as bytes that are not an image.
    const detail = describeErrorBody(Buffer.from(bytes).toString("utf8"));
    throw new ImageGenerationError(
      "generation_rejected",
      `The image provider returned no usable image. ${detail}`,
    );
  }

  return {
    bytes,
    mediaType: image.mediaType,
    width: image.width,
    height: image.height,
  };
}

async function readBinaryBody(response: Response) {
  try {
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    throw new ImageGenerationError(
      "provider_unavailable",
      `The image provider returned an unreadable body. HTTP ${response.status}.`,
    );
  }
}

async function readJsonBody(response: Response) {
  let payload: CloudflareRunResponse;
  try {
    payload = (await response.json()) as CloudflareRunResponse;
  } catch {
    throw new ImageGenerationError(
      "provider_unavailable",
      `The image provider returned an unreadable response. HTTP ${response.status}.`,
    );
  }

  // Cloudflare reports model errors inside a 200, so checking `response.ok`
  // alone would hand an undefined image to the decoder.
  if (payload.success === false) {
    throw new ImageGenerationError(
      "generation_rejected",
      describeErrors(payload.errors),
    );
  }

  const encoded = payload.result?.image;
  if (typeof encoded !== "string" || encoded.length === 0) {
    throw new ImageGenerationError(
      "provider_unavailable",
      "The image provider returned no image.",
    );
  }

  return new Uint8Array(Buffer.from(encoded, "base64"));
}
