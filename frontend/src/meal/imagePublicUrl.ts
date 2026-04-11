/** Public URL for an R2 object key when the static host env is set (same bucket as Closet). */
export function publicUrlForR2ImageKey(imageKey: string): string {
  const trimmedKey = imageKey.trim();
  if (!trimmedKey) return "";
  const base = (
    import.meta.env.VITE_CLOSET_R2_PUBLIC_BASE_URL ??
    import.meta.env.VITE_CLOSET_IMAGE_PUBLIC_BASE_URL ??
    import.meta.env.VITE_API_CLOSET_IMAGE_PUBLIC_BASE_URL ??
    ""
  ).trim();
  if (!base) return "";
  return `${base.replace(/\/+$/, "")}/${trimmedKey}`;
}
