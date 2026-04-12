import type { ParsedSongFields } from "./types";

const emptyFields = (): ParsedSongFields => ({
  artist: "",
  title: "",
  raw_label: "",
  youtube_video_id: "",
  spotify_url: "",
  apple_music_url: "",
});

/** Extract YouTube video id from watch, shorts, embed, youtu.be URLs. */
export function extractYoutubeVideoId(input: string): string {
  const s = input.trim();
  if (!s) return "";
  try {
    const u = new URL(s, "https://example.com");
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return /^[a-zA-Z0-9_-]{6,32}$/.test(id) ? id : "";
    }
    if (host.endsWith("youtube.com") || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{6,32}$/.test(v)) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const si = parts.indexOf("shorts");
      if (si >= 0 && parts[si + 1] && /^[a-zA-Z0-9_-]{6,32}$/.test(parts[si + 1])) {
        return parts[si + 1];
      }
      const ei = parts.indexOf("embed");
      if (ei >= 0 && parts[ei + 1] && /^[a-zA-Z0-9_-]{6,32}$/.test(parts[ei + 1])) {
        return parts[ei + 1];
      }
    }
  } catch {
    /* ignore */
  }
  if (/^[a-zA-Z0-9_-]{6,32}$/.test(s) && !s.includes(" ") && !s.includes("/")) {
    return s;
  }
  return "";
}

function normalizeHttpsUrl(s: string): string {
  const t = s.trim();
  if (!t) return "";
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  return `https://${t}`;
}

/** Spotify track/album/playlist URL or spotify: URI → https URL when possible. */
export function extractSpotifyUrl(input: string): string {
  const s = input.trim();
  if (!s) return "";
  if (s.startsWith("spotify:")) {
    const rest = s.replace(/^spotify:/, "").split(":").filter(Boolean);
    if (rest.length >= 2) {
      const kind = rest[0];
      const id = rest[1];
      if (["track", "album", "playlist", "episode"].includes(kind) && id) {
        return `https://open.spotify.com/${kind}/${id}`;
      }
    }
    return "";
  }
  const url = normalizeHttpsUrl(s);
  try {
    const u = new URL(url);
    if (!u.hostname.replace(/^www\./, "").endsWith("spotify.com")) return "";
    return u.toString();
  } catch {
    return "";
  }
}

export function extractAppleMusicUrl(input: string): string {
  const s = input.trim();
  if (!s) return "";
  const url = normalizeHttpsUrl(s);
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "").toLowerCase();
    if (h === "music.apple.com" || h.endsWith(".apple.com")) return u.toString();
  } catch {
    /* ignore */
  }
  return "";
}

const TITLE_SPLIT_RE = /\s+[-–—|:]\s+|\s+by\s+/i;

/**
 * Parse pasted blob: prefer first URL line, then artist/title split.
 * Returns merged fields (caller merges with existing form state as needed).
 */
export function parseSongPasteInput(raw: string): ParsedSongFields {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out = emptyFields();

  for (const line of lines) {
    const yt = extractYoutubeVideoId(line);
    if (yt) {
      out.youtube_video_id = yt;
      continue;
    }
    const sp = extractSpotifyUrl(line);
    if (sp) {
      out.spotify_url = sp;
      continue;
    }
    const am = extractAppleMusicUrl(line);
    if (am) {
      out.apple_music_url = am;
      continue;
    }
  }

  const textLine =
    lines.find((l) => !/^https?:\/\//i.test(l) && !l.startsWith("spotify:")) ?? lines[0] ?? "";
  if (textLine && !extractYoutubeVideoId(textLine) && !extractSpotifyUrl(textLine) && !extractAppleMusicUrl(textLine)) {
    const parts = textLine.split(TITLE_SPLIT_RE).map((p) => p.trim());
    if (parts.length >= 2) {
      out.artist = parts[0];
      out.title = parts.slice(1).join(" — ");
    } else {
      out.raw_label = textLine;
    }
  }

  return out;
}
