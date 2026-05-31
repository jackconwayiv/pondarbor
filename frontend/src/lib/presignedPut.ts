/** Progress for presigned image PUT (resize/presign reported separately by callers). */
export type UploadProgress = {
  phase: "preparing" | "uploading";
  loaded?: number;
  total?: number;
};

export type PutPresignedImageOptions = {
  onProgress?: (progress: UploadProgress) => void;
};

/** PUT body to a presigned S3/R2 URL (shared by Closet and Meal uploads). */
export async function putPresignedImage(
  uploadUrl: string,
  contentType: string,
  body: Blob,
  options?: PutPresignedImageOptions,
): Promise<void> {
  const onProgress = options?.onProgress;
  if (!onProgress) {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body,
    });
    if (!response.ok) {
      throw new Error(`Upload failed (${response.status})`);
    }
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress({
          phase: "uploading",
          loaded: event.loaded,
          total: event.total,
        });
      } else {
        onProgress({ phase: "uploading" });
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed (network error)"));
    xhr.onabort = () => reject(new Error("Upload canceled"));
    onProgress({ phase: "uploading", loaded: 0, total: body.size });
    xhr.send(body);
  });
}
