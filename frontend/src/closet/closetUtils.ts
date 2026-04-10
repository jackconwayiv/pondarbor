import type { ClosetItem } from "./types";

export function displayName(itemUser: {
  display_name: string;
  email: string;
}): string {
  return itemUser.display_name || itemUser.email;
}

export function formatNeedByDateLabel(dateOnly: string): string {
  const parts = dateOnly.split("-");
  if (parts.length !== 3) return dateOnly;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  )
    return dateOnly;
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(utcDate.getTime())) return dateOnly;
  const nowYear = new Date().getFullYear();
  const needsYear = year !== nowYear;
  return utcDate.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    ...(needsYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** Normalize API / session user ids (JSON may use number or string; session cache can drift). */
export function coerceClosetUserId(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value))
    return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : Number.NaN;
  }
  return Number.NaN;
}

export function sameClosetUserId(a: unknown, b: unknown): boolean {
  const ca = coerceClosetUserId(a);
  const cb = coerceClosetUserId(b);
  return Number.isFinite(ca) && Number.isFinite(cb) && ca === cb;
}

export function closetPendingCount(item: { pending_request_count?: number }): number {
  const n = Number(item.pending_request_count ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function formatCategoryTagsSummaryLine(item: {
  category: string;
  tags: string[];
}): string | null {
  const cat = (item.category ?? "").trim();
  const tagParts = item.tags.map((t) => t.trim()).filter(Boolean);
  const hasCategory = Boolean(cat);
  const hasTags = tagParts.length > 0;
  if (!hasCategory && !hasTags) return null;
  const parts: string[] = [];
  if (hasCategory) parts.push(`Category: ${cat}`);
  if (hasTags) parts.push(`Tags: ${tagParts.join(", ")}`);
  return parts.join(" | ");
}

export function itemIsLoanedOut(item: ClosetItem): boolean {
  return !sameClosetUserId(item.current_holder_user.id, item.owner_user.id);
}
