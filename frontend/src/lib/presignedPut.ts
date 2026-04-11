/** PUT body to a presigned S3/R2 URL (shared by Closet and Meal uploads). */
export async function putPresignedImage(
  uploadUrl: string,
  contentType: string,
  body: Blob,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
}
