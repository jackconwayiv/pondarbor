import { putPresignedImage, type UploadProgress } from "../lib/presignedPut";
import type { R2UploadResult } from "../lib/r2ImageApi";
import { resizeImageFileToJpegBlob } from "../closet/imageUpload";
import { requestMealImagePresign } from "./api";

export type MealImageUploadOptions = {
  onProgress?: (progress: UploadProgress) => void;
};

export async function uploadMealImageBlobViaPresign(
  getToken: () => Promise<string>,
  blob: Blob,
  options?: MealImageUploadOptions,
): Promise<R2UploadResult> {
  const token = await getToken();
  const meta = await requestMealImagePresign(token, "image/jpeg");
  if (blob.size > meta.max_bytes) {
    const kb = Math.round(meta.max_bytes / 1024);
    throw new Error(`Image must be under ${kb} KB after resizing.`);
  }
  const putOptions = options?.onProgress ? { onProgress: options.onProgress } : undefined;
  await putPresignedImage(meta.upload_url, "image/jpeg", blob, putOptions);
  return { key: meta.key, viewUrl: meta.view_url };
}

/**
 * Resize client-side, upload to R2 via meal presign, return object key for PATCH/POST `image_key`.
 */
export async function uploadMealImageViaPresign(
  getToken: () => Promise<string>,
  file: File,
  options?: MealImageUploadOptions,
): Promise<R2UploadResult> {
  options?.onProgress?.({ phase: "preparing" });
  const blob = await resizeImageFileToJpegBlob(file);
  return uploadMealImageBlobViaPresign(getToken, blob, options);
}
