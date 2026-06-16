/** Format rating to 3 significant figures for display. */
export function formatRatingSigFigs(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumSignificantDigits: 3 });
}

/** Clamp and round user input to 3 sig figs between 1 and 5. */
export function normalizeRatingInput(raw: number): number {
  const clamped = Math.min(5, Math.max(1, raw));
  const s = clamped.toPrecision(3);
  return Number.parseFloat(s);
}

export function starFillPercent(rating: number): number {
  return ((Math.min(5, Math.max(0, rating)) / 5) * 100);
}

/** Round lat/lng to 6 decimal places for the recommendations API. */
export function formatCoordinateForApi(value: number | string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(6);
}

export const LOCATION_LABEL_PRESETS = [
  "phoenix",
  "scottsdale",
  "tempe",
  "mesa",
  "tucson",
  "flagstaff",
  "sedona",
] as const;

export function formatLocationLabel(label: string): string {
  const t = label.trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Secondary line for list/detail cards — location for places, type-specific metadata for media. */
export function formatEntrySecondaryLine(entry: {
  category: { slug: string; group: "places" | "media" | "links" };
  location_label: string;
  address: string;
  creator: string;
  media_source: string;
  link: string;
}): string | null {
  if (entry.category.group === "places") {
    if (entry.location_label.trim()) return formatLocationLabel(entry.location_label);
    if (entry.address.trim()) return entry.address;
    return null;
  }

  if (entry.category.slug === "links" || entry.category.group === "links") {
    const url = entry.link.trim();
    if (!url) return null;
    try {
      return new URL(url).hostname.replace(/^www\./i, "");
    } catch {
      return null;
    }
  }

  switch (entry.category.slug) {
    case "books":
      return entry.creator.trim() || null;
    case "tv":
      return entry.media_source.trim() || null;
    case "films":
      return null;
    case "music": {
      const artist = entry.creator.trim();
      const albumOrSong = entry.media_source.trim();
      if (artist && albumOrSong) return `${artist} — ${albumOrSong}`;
      return artist || albumOrSong || null;
    }
    default: {
      const creator = entry.creator.trim();
      const detail = entry.media_source.trim();
      if (creator && detail) return `${creator} · ${detail}`;
      return creator || detail || null;
    }
  }
}

export function formatRecommendationDate(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return `${month}/${day}/${year.slice(-2)}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const yy = String(parsed.getFullYear() % 100).padStart(2, "0");
  return `${mm}/${dd}/${yy}`;
}

export function formatEditedAt(iso: string | null | undefined): string | null {
  const formatted = formatRecommendationDate(iso);
  if (!formatted) return null;
  return `Edited ${formatted}`;
}
