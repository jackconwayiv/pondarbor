import { putPresignedImage } from "../lib/presignedPut";
import { resizeImageFileToJpegBlob } from "../closet/imageUpload";
import { requestMealImagePresign } from "./api";

/**
 * Resize client-side, upload to R2 via meal presign, return object key for PATCH/POST `image_key`.
 */
export async function uploadMealImageViaPresign(
  getToken: () => Promise<string>,
  file: File,
): Promise<string> {
  const blob = await resizeImageFileToJpegBlob(file);
  const token = await getToken();
  const meta = await requestMealImagePresign(token, "image/jpeg");
  if (blob.size > meta.max_bytes) {
    const kb = Math.round(meta.max_bytes / 1024);
    throw new Error(`Image must be under ${kb} KB after resizing.`);
  }
  await putPresignedImage(meta.upload_url, "image/jpeg", blob);
  return meta.key;
}
