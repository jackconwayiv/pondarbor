import { putPresignedImage } from "../lib/presignedPut";
import { requestClosetImagePresign } from "./api";

export { putPresignedImage };

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

export async function resizeImageFileToJpegBlob(
  file: File,
  maxEdge: number = MAX_EDGE,
  quality: number = JPEG_QUALITY,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const w = bitmap.width;
    const h = bitmap.height;
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not prepare image.");
    }
    ctx.drawImage(bitmap, 0, 0, tw, th);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not encode image."))),
        "image/jpeg",
        quality,
      );
    });
  } finally {
    bitmap.close();
  }
}

/**
 * Upload an already-resized blob (e.g. JPEG from resizeImageFileToJpegBlob).
 */
export async function uploadClosetImageBlobViaPresign(
  getToken: () => Promise<string>,
  blob: Blob,
  contentType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
): Promise<string> {
  const token = await getToken();
  const meta = await requestClosetImagePresign(token, contentType);
  if (blob.size > meta.max_bytes) {
    const kb = Math.round(meta.max_bytes / 1024);
    throw new Error(`Image must be under ${kb} KB after resizing.`);
  }
  await putPresignedImage(meta.upload_url, contentType, blob);
  return meta.key;
}

/**
 * Resize client-side, upload to R2 via presigned PUT, return object key for PATCH/POST image_key.
 */
export async function uploadClosetImageViaPresign(
  getToken: () => Promise<string>,
  file: File,
): Promise<string> {
  const blob = await resizeImageFileToJpegBlob(file);
  return uploadClosetImageBlobViaPresign(getToken, blob, "image/jpeg");
}
