import type { UploadProgress } from "./presignedPut";

export type UploadStatusKind = "idle" | "busy" | "success" | "error";

export function uploadProgressPercent(progress: UploadProgress | null): number | null {
  if (!progress || progress.phase !== "uploading") return null;
  const { loaded, total } = progress;
  if (loaded == null || total == null || total <= 0) return null;
  return Math.min(100, Math.round((loaded / total) * 100));
}

export function uploadStatusLabel(
  kind: UploadStatusKind,
  progress: UploadProgress | null,
  successMessage: string,
): string | null {
  if (kind === "success") return successMessage;
  if (kind !== "busy") return null;
  if (!progress || progress.phase === "preparing") return "Preparing image…";
  const pct = uploadProgressPercent(progress);
  return pct != null ? `Uploading… ${pct}%` : "Uploading…";
}
