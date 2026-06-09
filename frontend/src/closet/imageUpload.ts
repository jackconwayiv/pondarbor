import {
  putPresignedImage,
  type PutPresignedImageOptions,
  type UploadProgress,
} from "../lib/presignedPut";
import type { R2UploadResult } from "../lib/r2ImageApi";
import { requestClosetImagePresign } from "./api";

export type { R2UploadResult };

export { putPresignedImage };
export type { UploadProgress, PutPresignedImageOptions };

export type ClosetImageUploadOptions = {
  onProgress?: (progress: UploadProgress) => void;
};

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
  options?: ClosetImageUploadOptions,
): Promise<R2UploadResult> {
  const token = await getToken();
  const meta = await requestClosetImagePresign(token, contentType);
  if (blob.size > meta.max_bytes) {
    const kb = Math.round(meta.max_bytes / 1024);
    throw new Error(`Image must be under ${kb} KB after resizing.`);
  }
  const putOptions: PutPresignedImageOptions | undefined = options?.onProgress
    ? { onProgress: options.onProgress }
    : undefined;
  await putPresignedImage(meta.upload_url, contentType, blob, putOptions);
  return { key: meta.key, viewUrl: meta.view_url };
}

/**
 * Resize client-side, upload to R2 via presigned PUT, return object key for PATCH/POST image_key.
 */
export async function uploadClosetImageViaPresign(
  getToken: () => Promise<string>,
  file: File,
  options?: ClosetImageUploadOptions,
): Promise<R2UploadResult> {
  options?.onProgress?.({ phase: "preparing" });
  const blob = await resizeImageFileToJpegBlob(file);
  return uploadClosetImageBlobViaPresign(getToken, blob, "image/jpeg", options);
}

/** Adapter for {@link useR2ImageUpload} (options third, default JPEG). */
export async function uploadClosetImageBlobForField(
  getToken: () => Promise<string>,
  blob: Blob,
  options?: ClosetImageUploadOptions,
): Promise<R2UploadResult> {
  return uploadClosetImageBlobViaPresign(getToken, blob, "image/jpeg", options);
}
