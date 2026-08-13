import "server-only";

import { IMAGE_MODEL } from "./model";

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
 * The model takes no width or height, and its documentation states neither the
 * output size nor the encoding, so both are read off the bytes that arrived.
 * The media type decides the stored file's extension, so guessing it would
 * write a mislabelled blob.
 */
function readImage(bytes: Uint8Array) {
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

export async function generateImageForPrompt(prompt: string) {
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

  let response: Response;
  try {
    response = await fetch(
      `${CLOUDFLARE_ACCOUNTS_ENDPOINT}/${accountId}/ai/run/${IMAGE_MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        // `steps` is the only other documented input and 4 is its default.
        // There is no width or height parameter to send.
        body: JSON.stringify({ prompt, steps: 4 }),
      },
    );
  } catch {
    throw new ImageGenerationError(
      "provider_unavailable",
      "The image provider could not be reached.",
    );
  }

  let payload: CloudflareRunResponse;
  try {
    payload = (await response.json()) as CloudflareRunResponse;
  } catch {
    throw new ImageGenerationError(
      "provider_unavailable",
      `The image provider returned an unreadable response. HTTP ${response.status}.`,
    );
  }

  if (!response.ok) {
    // 400 is the provider rejecting this particular request. Every other
    // status is the provider being unusable: unauthorized, throttled, or down.
    throw new ImageGenerationError(
      response.status === 400 ? "generation_rejected" : "provider_unavailable",
      `HTTP ${response.status}. ${describeErrors(payload.errors)}`,
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

  const bytes = new Uint8Array(Buffer.from(encoded, "base64"));
  const image = readImage(bytes);
  if (!image) {
    throw new ImageGenerationError(
      "provider_unavailable",
      "The image provider returned an unsupported image format.",
    );
  }

  return {
    bytes,
    mediaType: image.mediaType,
    width: image.width,
    height: image.height,
  };
}
