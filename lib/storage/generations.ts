import "server-only";

import { del, getDownloadUrl, put } from "@vercel/blob";

export async function storeGenerationImage({
  generationId,
  bytes,
  mediaType,
}: {
  generationId: string;
  bytes: Uint8Array;
  mediaType: string;
}) {
  const extension = mediaType === "image/jpeg" ? "jpg" : "png";
  return put(
    `generations/${generationId}.${extension}`,
    Buffer.from(bytes),
    {
      access: "public",
      addRandomSuffix: false,
      contentType: mediaType,
    },
  );
}

export async function deleteGenerationImage(url: string) {
  await del(url);
}

const MAX_MODERATION_IMAGE_BYTES = 10 * 1024 * 1024;

export async function readGenerationImageForModeration(
  url: string,
): Promise<{
  bytes: Uint8Array;
  mediaType: "image/png" | "image/jpeg";
}> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Stored generation URL is invalid.");
  }
  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname.endsWith(".public.blob.vercel-storage.com") ||
    !parsed.pathname.startsWith("/generations/")
  ) {
    throw new Error("Stored generation URL is outside the image store.");
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Stored generation image is unavailable.");
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_MODERATION_IMAGE_BYTES) {
    throw new Error("Stored generation image is too large.");
  }
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0];
  if (mediaType !== "image/png" && mediaType !== "image/jpeg") {
    throw new Error("Stored generation image has an unsupported type.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_MODERATION_IMAGE_BYTES) {
    throw new Error("Stored generation image has an invalid size.");
  }
  return { bytes, mediaType };
}

/**
 * The url a download link points at. Blob is a different origin, where the
 * `download` attribute is ignored, so a bare link opens the image instead of
 * saving it. This appends the query parameter that makes Blob answer with
 * `Content-Disposition: attachment`.
 *
 * It is a pure string function and reads no token, but it stays behind this
 * module so `@vercel/blob` keeps exactly one importer outside `lib/`.
 */
export function generationDownloadUrl(url: string) {
  return getDownloadUrl(url);
}
