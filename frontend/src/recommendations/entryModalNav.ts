import type { RecommendationEntry } from "./types";

export function parseEntryIdParam(value: string | null): number | null {
  if (value == null || value === "") return null;
  const id = Number.parseInt(value, 10);
  if (!Number.isFinite(id) || id < 1) return null;
  return id;
}

export function entryHref(
  pathname: string,
  searchParams: URLSearchParams,
  entryId: number,
): string {
  const next = new URLSearchParams(searchParams);
  next.set("entry", String(entryId));
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function findEntryInList(
  id: number,
  entries: RecommendationEntry[],
): RecommendationEntry | undefined {
  return entries.find((e) => e.id === id);
}
