import { putPresignedImage, type UploadProgress } from "../lib/presignedPut";
import { resizeImageFileToJpegBlob } from "../closet/imageUpload";
import { requestMealImagePresign } from "./api";

export type MealImageUploadOptions = {
  onProgress?: (progress: UploadProgress) => void;
};

export async function uploadMealImageBlobViaPresign(
  getToken: () => Promise<string>,
  blob: Blob,
  options?: MealImageUploadOptions,
): Promise<string> {
  const token = await getToken();
  const meta = await requestMealImagePresign(token, "image/jpeg");
  if (blob.size > meta.max_bytes) {
    const kb = Math.round(meta.max_bytes / 1024);
    throw new Error(`Image must be under ${kb} KB after resizing.`);
  }
  const putOptions = options?.onProgress ? { onProgress: options.onProgress } : undefined;
  await putPresignedImage(meta.upload_url, "image/jpeg", blob, putOptions);
  return meta.key;
}

/**
 * Resize client-side, upload to R2 via meal presign, return object key for PATCH/POST `image_key`.
 */
export async function uploadMealImageViaPresign(
  getToken: () => Promise<string>,
  file: File,
  options?: MealImageUploadOptions,
): Promise<string> {
  options?.onProgress?.({ phase: "preparing" });
  const blob = await resizeImageFileToJpegBlob(file);
  return uploadMealImageBlobViaPresign(getToken, blob, options);
}
