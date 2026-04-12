import type { SongadayResponse } from "./types";

/**
 * Normalize Apple Music / streaming OG titles for display: strips marketing noise
 * ("on Apple Music") and fixes common mojibake (e.g. NBSP read as Â + space).
 */
export function cleanStreamingTitleLine(input: string): string {
  let s = input.trim();
  if (!s) return s;

  s = s.replace(/\u00c2\u00a0/g, " ");
  s = s.replace(/\u00a0/g, " ");
  s = s.replace(/Apple\s*\u00c2\s*Music/gi, "Apple Music");
  s = s.replace(/\s+on\s+Apple\s+Music\s*/gi, " ");
  s = s.replace(/\s{2,}/g, " ");
  return s.trim();
}

/** Artist — title, raw_label, or fallbacks; used in list rows and `SongadayMediaBlock`. */
export function songadayEntryTitleLine(entry: SongadayResponse): string {
  const clean = cleanStreamingTitleLine;
  if (entry.artist && entry.title) return `${clean(entry.artist)} — ${clean(entry.title)}`;
  if (entry.raw_label.trim()) return clean(entry.raw_label);
  if (entry.title.trim()) return clean(entry.title);
  if (entry.artist.trim()) return clean(entry.artist);
  return "Song";
}
