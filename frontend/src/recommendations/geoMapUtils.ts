import type { RecommendationEntry } from "./types";

export function parseCoord(value: string | null): number | null {
  if (value == null || value === "") return null;
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export function entriesWithGeo(entries: RecommendationEntry[]): RecommendationEntry[] {
  return entries.filter((e) => {
    const lat = parseCoord(e.latitude);
    const lng = parseCoord(e.longitude);
    return lat !== null && lng !== null && !(lat === 0 && lng === 0);
  });
}

/** Build a Google Static Maps URL with a marker per geo entry. */
export function buildStaticMapUrl(geoEntries: RecommendationEntry[], apiKey: string): string | null {
  if (geoEntries.length === 0 || !apiKey.trim()) return null;

  const points = geoEntries
    .map((e) => {
      const lat = parseCoord(e.latitude);
      const lng = parseCoord(e.longitude);
      if (lat === null || lng === null) return null;
      return `${lat},${lng}`;
    })
    .filter((p): p is string => p != null);

  if (points.length === 0) return null;

  const params = new URLSearchParams({
    size: "640x320",
    scale: "2",
    maptype: "roadmap",
    key: apiKey.trim(),
  });

  if (points.length === 1) {
    params.set("center", points[0]!);
    params.set("zoom", "14");
  } else {
    params.set("visible", points.join("|"));
  }

  params.set("markers", points.join("|"));
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}
