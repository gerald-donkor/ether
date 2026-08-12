import "server-only";

import { del, put } from "@vercel/blob";

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
