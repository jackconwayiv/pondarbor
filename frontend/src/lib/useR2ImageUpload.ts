import { useCallback, useEffect, useRef, useState } from "react";
import { resizeImageFileToJpegBlob } from "../closet/imageUpload";
import type { UploadProgress } from "./presignedPut";
import { uploadStatusLabel, type UploadStatusKind } from "./uploadProgressUi";

export type R2ImageUploadFromBlob = (
  getToken: () => Promise<string>,
  blob: Blob,
  options?: { onProgress?: (progress: UploadProgress) => void },
) => Promise<string>;

export type UseR2ImageUploadOptions = {
  getApiAccessToken: () => Promise<string>;
  onKeyChange: (key: string) => void;
  uploadFromBlob: R2ImageUploadFromBlob;
  successMessage?: string;
  onUploadSuccess?: (key: string) => void | Promise<void>;
};

export function useR2ImageUpload({
  getApiAccessToken,
  onKeyChange,
  uploadFromBlob,
  successMessage = "Photo uploaded",
  onUploadSuccess,
}: UseR2ImageUploadOptions) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<UploadStatusKind>("idle");
  const localPreviewRef = useRef<string | null>(null);
  localPreviewRef.current = localPreviewUrl;

  const revokeLocalPreview = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  }, []);

  const setLocalPreview = useCallback(
    (url: string | null) => {
      setLocalPreviewUrl((prev) => {
        if (prev && prev !== url) revokeLocalPreview(prev);
        return url;
      });
    },
    [revokeLocalPreview],
  );

  useEffect(() => {
    return () => {
      const u = localPreviewRef.current;
      if (u) URL.revokeObjectURL(u);
    };
  }, []);

  const uploadBlob = useCallback(
    async (blob: Blob, options?: { skipPreview?: boolean }) => {
      setBusy(true);
      setError(null);
      setStatusKind("busy");
      setProgress({ phase: "preparing" });
      let previewUrl: string | null = null;
      if (!options?.skipPreview) {
        previewUrl = URL.createObjectURL(blob);
        setLocalPreview(previewUrl);
      }
      try {
        const key = await uploadFromBlob(getApiAccessToken, blob, {
          onProgress: setProgress,
        });
        onKeyChange(key);
        await onUploadSuccess?.(key);
        setStatusKind("success");
        setProgress(null);
        return key;
      } catch (err: unknown) {
        if (previewUrl) {
          revokeLocalPreview(previewUrl);
          setLocalPreview(null);
        }
        setError(err instanceof Error ? err.message : "Upload failed");
        setStatusKind("error");
        setProgress(null);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [
      getApiAccessToken,
      onKeyChange,
      onUploadSuccess,
      revokeLocalPreview,
      setLocalPreview,
      uploadFromBlob,
    ],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      setStatusKind("busy");
      setProgress({ phase: "preparing" });
      let previewUrl: string | null = null;
      try {
        const blob = await resizeImageFileToJpegBlob(file);
        previewUrl = URL.createObjectURL(blob);
        setLocalPreview(previewUrl);
        const key = await uploadFromBlob(getApiAccessToken, blob, {
          onProgress: setProgress,
        });
        onKeyChange(key);
        await onUploadSuccess?.(key);
        setStatusKind("success");
        setProgress(null);
        return key;
      } catch (err: unknown) {
        if (previewUrl) {
          revokeLocalPreview(previewUrl);
          setLocalPreview(null);
        }
        setError(err instanceof Error ? err.message : "Upload failed");
        setStatusKind("error");
        setProgress(null);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [
      getApiAccessToken,
      onKeyChange,
      onUploadSuccess,
      revokeLocalPreview,
      setLocalPreview,
      uploadFromBlob,
    ],
  );

  const handleFileInput = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      void uploadFile(file).catch(() => {
        /* error surfaced via state */
      });
    },
    [uploadFile],
  );

  const statusMessage = uploadStatusLabel(statusKind, progress, successMessage);

  return {
    busy,
    progress,
    localPreviewUrl,
    error,
    statusKind,
    statusMessage,
    uploadFile,
    uploadBlob,
    handleFileInput,
    clearError: () => setError(null),
    clearLocalPreview: () => setLocalPreview(null),
  };
}
