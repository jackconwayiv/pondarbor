import type { RecommendationEntry } from "./types";

export type LatLngPair = { lat: number; lng: number };

export function parseCoord(value: string | null): number | null {
  if (value == null || value === "") return null;
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export function geoEntryLatLng(entry: RecommendationEntry): LatLngPair | null {
  const lat = parseCoord(entry.latitude);
  const lng = parseCoord(entry.longitude);
  if (lat === null || lng === null) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

export function entriesWithGeo(entries: RecommendationEntry[]): RecommendationEntry[] {
  return entries.filter((e) => geoEntryLatLng(e) !== null);
}

export function latLngPairsForGeoEntries(entries: RecommendationEntry[]): LatLngPair[] {
  return entries
    .map((entry) => geoEntryLatLng(entry))
    .filter((pair): pair is LatLngPair => pair !== null);
}

/** Simple centroid for tests and single-map center fallback. */
export function boundsCenterFromPairs(pairs: LatLngPair[]): LatLngPair | null {
  if (pairs.length === 0) return null;
  if (pairs.length === 1) return pairs[0]!;
  const lat = pairs.reduce((sum, pair) => sum + pair.lat, 0) / pairs.length;
  const lng = pairs.reduce((sum, pair) => sum + pair.lng, 0) / pairs.length;
  return { lat, lng };
}
