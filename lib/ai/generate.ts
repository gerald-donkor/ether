import "server-only";

import { generateImage } from "ai";
import { IMAGE_MODEL } from "./model";

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

function readDimensions(bytes: Uint8Array) {
  return readPngDimensions(bytes) ?? readJpegDimensions(bytes);
}

export async function generateImageForPrompt(prompt: string) {
  const { image } = await generateImage({
    model: IMAGE_MODEL,
    prompt,
    aspectRatio: "1:1",
  });

  const dimensions = readDimensions(image.uint8Array);
  if (!dimensions) {
    throw new Error("The image provider returned an unsupported image format.");
  }

  return {
    bytes: image.uint8Array,
    mediaType: image.mediaType,
    ...dimensions,
  };
}
