import "server-only";

import { del, getDownloadUrl, put } from "@vercel/blob";

export async function storeGenerationImage({
  userId,
  bytes,
  mediaType,
}: {
  userId: string;
  bytes: Uint8Array;
  mediaType: string;
}) {
  const extension = mediaType === "image/jpeg" ? "jpg" : "png";
  return put(
    `generations/${userId}/${crypto.randomUUID()}.${extension}`,
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
