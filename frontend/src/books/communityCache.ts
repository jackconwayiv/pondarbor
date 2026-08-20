import type { BooksCommunityEntry } from "./types";

const STORAGE_PREFIX = "pondarbor:books:community:v1:";

export type CommunitySnapshot = {
  savedAt: number;
  results: BooksCommunityEntry[];
};

function storageKey(viewerUserId: number): string {
  return `${STORAGE_PREFIX}${viewerUserId}`;
}

function isCommunityEntry(value: unknown): value is BooksCommunityEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as BooksCommunityEntry;
  return (
    row.user != null &&
    typeof row.user === "object" &&
    typeof row.user.id === "number" &&
    Array.isArray(row.shelves)
  );
}

export function readCommunitySnapshot(
  viewerUserId: number,
): CommunitySnapshot | null {
  if (!Number.isFinite(viewerUserId) || viewerUserId < 1) return null;
  try {
    const raw = localStorage.getItem(storageKey(viewerUserId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CommunitySnapshot>;
    if (
      typeof parsed.savedAt !== "number" ||
      !Array.isArray(parsed.results) ||
      !parsed.results.every(isCommunityEntry)
    ) {
      return null;
    }
    return { savedAt: parsed.savedAt, results: parsed.results };
  } catch {
    return null;
  }
}

export function writeCommunitySnapshot(
  viewerUserId: number,
  results: BooksCommunityEntry[],
): void {
  if (!Number.isFinite(viewerUserId) || viewerUserId < 1) return;
  try {
    const payload: CommunitySnapshot = {
      savedAt: Date.now(),
      results,
    };
    localStorage.setItem(storageKey(viewerUserId), JSON.stringify(payload));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function clearCommunitySnapshot(viewerUserId: number): void {
  if (!Number.isFinite(viewerUserId) || viewerUserId < 1) return;
  try {
    localStorage.removeItem(storageKey(viewerUserId));
  } catch {
    // ignore
  }
}

export function communityEntriesEqual(
  a: BooksCommunityEntry[],
  b: BooksCommunityEntry[],
): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
