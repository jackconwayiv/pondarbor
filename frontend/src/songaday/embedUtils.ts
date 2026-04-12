/** Spotify share URL → embed iframe src, or null. */
export function spotifyEmbedSrc(url: string): string | null {
  const raw = (url || "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const m = u.pathname.match(/\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/);
    if (m) {
      return `https://open.spotify.com/embed/${m[1]}/${m[2]}${u.search}`;
    }
  } catch {
    return null;
  }
  return null;
}
