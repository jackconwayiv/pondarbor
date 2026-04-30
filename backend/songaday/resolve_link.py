"""
Resolve artist/title from YouTube, Spotify, and Apple Music URLs (server-side oEmbed / OG).
"""
from __future__ import annotations

import html as html_module
import json
import re
from urllib.parse import quote, urlparse

import requests

from songaday.serializers import _host_allowed

_YOUTUBE_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{6,32}$")

_YOUTUBE_OEMBED = "https://www.youtube.com/oembed"
_SPOTIFY_OEMBED = "https://open.spotify.com/oembed"

_MAX_HTML_BYTES = 2_000_000
_REQUEST_TIMEOUT = (3, 12)

_SESSION = requests.Session()
_SESSION.headers.update(
    {
        "User-Agent": "PondArborSongaday/1.0 (+https://github.com/pondarbor)",
        "Accept": "application/json, text/html;q=0.9,*/*;q=0.8",
    }
)


class ResolveError(Exception):
    pass


def _youtube_watch_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={quote(video_id, safe='')}"


def _fetch_json(url: str) -> dict:
    r = _SESSION.get(url, timeout=_REQUEST_TIMEOUT)
    r.raise_for_status()
    return r.json()


def _resolve_youtube_watch_url(page_url: str) -> tuple[str, str]:
    try:
        oembed = f"{_YOUTUBE_OEMBED}?format=json&url={quote(page_url, safe='')}"
        data = _fetch_json(oembed)
    except (requests.RequestException, json.JSONDecodeError, ValueError) as e:
        raise ResolveError("Could not load YouTube metadata.") from e
    title = (data.get("title") or "").strip()
    return _youtube_artist_title_from_oembed_title(title)


_YOUTUBE_TRAILING_NOISE_RE = re.compile(
    r"""
    (?:
        \s*[\(\[]\s*
        (?:
            official(?:\s+(?:music\s+)?video)?|
            official\s+audio|
            lyric(?:s| video)?|
            visualizer|
            audio|
            hd|
            4k
        )
        [^\)\]]*
        [\)\]]
    )+\s*$
    """,
    re.I | re.X,
)


def _youtube_artist_title_from_oembed_title(raw: str) -> tuple[str, str]:
    cleaned = _YOUTUBE_TRAILING_NOISE_RE.sub("", (raw or "").strip()).strip(" -–—|:")
    if not cleaned:
        return "", ""
    parts = re.split(r"\s+[-–—|:]\s+|\s+by\s+", cleaned, maxsplit=1, flags=re.I)
    if len(parts) == 2:
        artist = parts[0].strip()
        title = parts[1].strip()
        if artist and title:
            return artist, title
    return "", cleaned


def _normalize_spotify_oembed_title(s: str) -> str:
    """Normalize unicode bullets/dots so 'Track · Artist' splits reliably."""
    t = s
    for ch in ("\u00b7", "\u2022", "\u2219", "\u2027", "\u22c5"):
        t = t.replace(ch, "\u00b7")
    t = re.sub(r"\s*\u00b7\s*", " · ", t)
    return t


def _spotify_artist_title_from_oembed_title(raw: str) -> tuple[str, str]:
    """Returns (artist, title)."""
    s = _normalize_spotify_oembed_title(raw.strip())
    if " · " in s:
        parts = [p.strip() for p in s.split(" · ") if p.strip()]
        if len(parts) >= 2:
            title_guess = parts[0]
            artist_guess = " · ".join(parts[1:])
            return artist_guess, title_guess
    for sep in (" – ", " — ", " - "):
        if sep in s:
            a, b = [x.strip() for x in s.split(sep, 1)]
            if a and b:
                return b, a
    return "", s


def _spotify_artist_title_from_page_html(html: str) -> tuple[str, str] | None:
    """
    Spotify's public track pages put artist in <title>, e.g.
    'Cut To The Feeling - song and lyrics by Carly Rae Jepsen | Spotify'
    while oEmbed 'title' is often track-only.
    """
    m = re.search(r"<title>([^<]+)</title>", html, re.I)
    if not m:
        return None
    t = html_module.unescape(m.group(1).strip())
    # "Track - song and lyrics by Artist | Spotify"
    m2 = re.match(
        r"^(.+?)\s+-\s+song and lyrics by\s+(.+?)\s+\|\s*Spotify\s*$",
        t,
        re.I,
    )
    if m2:
        return m2.group(2).strip(), m2.group(1).strip()
    # "Track by Artist | Spotify"
    m4 = re.match(r"^(.+?)\s+by\s+(.+?)\s+\|\s*Spotify\s*$", t, re.I)
    if m4:
        return m4.group(2).strip(), m4.group(1).strip()
    return None


def _fetch_spotify_track_page(url: str) -> str:
    r = _SESSION.get(url, timeout=_REQUEST_TIMEOUT, allow_redirects=True)
    r.raise_for_status()
    if len(r.content) > _MAX_HTML_BYTES:
        raise ResolveError("Spotify page was too large.")
    return r.text


def _resolve_spotify(url: str) -> tuple[str, str]:
    try:
        oembed = f"{_SPOTIFY_OEMBED}?url={quote(url, safe='')}"
        data = _fetch_json(oembed)
    except (requests.RequestException, json.JSONDecodeError, ValueError) as e:
        raise ResolveError("Could not load Spotify metadata.") from e
    raw = (data.get("title") or "").strip()
    artist, title = ("", "")
    if raw:
        artist, title = _spotify_artist_title_from_oembed_title(raw)
    if not artist:
        try:
            html = _fetch_spotify_track_page(url)
        except requests.RequestException as e:
            raise ResolveError("Could not load Spotify page for artist name.") from e
        parsed = _spotify_artist_title_from_page_html(html)
        if parsed:
            page_artist, page_title = parsed
            artist = artist or page_artist
            title = title or page_title or raw
        elif not title:
            title = raw
    if not title and raw:
        title = raw
    return artist, title


def _og_title_from_html(html: str) -> str | None:
    m = re.search(
        r'<meta\s+property=["\']og:title["\']\s+content=["\']([^"\']*)["\']',
        html,
        re.I,
    ) or re.search(
        r'<meta\s+content=["\']([^"\']*)["\']\s+property=["\']og:title["\']',
        html,
        re.I,
    )
    if not m:
        return None
    return html_module.unescape(m.group(1).strip()) or None


def _clean_apple_og_title_noise(s: str) -> str:
    """Strip Apple Music marketing noise and fix common UTF-8 mojibake in OG titles."""
    t = html_module.unescape(s).strip()
    t = t.replace("\u00c2\u00a0", " ").replace("\xa0", " ")
    t = re.sub(r"Apple\s*\u00c2\s*Music", "Apple Music", t, flags=re.I)
    t = re.sub(r"\s+on\s+Apple\s+Music\s*", " ", t, flags=re.I)
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"\s+-\s+Apple Music\s*$", "", t, flags=re.I).strip()
    return t


def _resolve_apple_music(url: str) -> tuple[str, str]:
    try:
        r = _SESSION.get(url, timeout=_REQUEST_TIMEOUT, allow_redirects=True)
        r.raise_for_status()
    except requests.RequestException as e:
        raise ResolveError("Could not load Apple Music page.") from e
    if len(r.content) > _MAX_HTML_BYTES:
        raise ResolveError("Apple Music page was too large.")
    html = r.text
    og = _og_title_from_html(html)
    if not og:
        raise ResolveError("Could not find title on Apple Music page.")
    cleaned = _clean_apple_og_title_noise(og)
    # "Song by Artist" or "Song - Artist"
    m = re.match(r"^(.+?)\s+by\s+(.+)$", cleaned, re.I)
    if m:
        return m.group(2).strip(), m.group(1).strip()
    for sep in (" – ", " — ", " - "):
        if sep in cleaned:
            a, b = cleaned.split(sep, 1)
            a, b = a.strip(), b.strip()
            if a and b:
                return (b, a) if _looks_like_artist_last(a, b) else (a, b)
    return "", cleaned


def _looks_like_artist_last(a: str, b: str) -> bool:
    """Prefer 'Title - Artist' ordering when second segment looks like a person/band."""
    return len(b) <= 48 and (len(a) > len(b) or "feat" in a.lower())


def resolve_song_link_metadata(url: str) -> tuple[str, str, str]:
    """
    Returns (artist, title, source) where source is youtube | spotify | apple | unknown.
    Empty strings mean unknown.
    """
    raw = (url or "").strip()
    if not raw:
        raise ResolveError("Empty URL.")
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    if not _host_allowed(raw):
        raise ResolveError("URL host is not allowed.")

    try:
        p = urlparse(raw)
    except Exception as e:
        raise ResolveError("Invalid URL.") from e
    host = (p.netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]

    if host in ("youtu.be",) or host.endswith("youtube.com"):
        artist, title = _resolve_youtube_watch_url(raw)
        return artist, title, "youtube"

    if "spotify.com" in host or host.endswith("spotify.link"):
        artist, title = _resolve_spotify(raw)
        return artist, title, "spotify"

    if "apple.com" in host and "music" in host:
        artist, title = _resolve_apple_music(raw)
        return artist, title, "apple"

    raise ResolveError("Unsupported URL type for this host.")


def resolve_from_youtube_video_id(video_id: str) -> tuple[str, str, str]:
    v = (video_id or "").strip()
    if not v:
        raise ResolveError("Empty YouTube id.")
    if not _YOUTUBE_ID_RE.fullmatch(v):
        raise ResolveError("Invalid YouTube video id.")
    return resolve_song_link_metadata(_youtube_watch_url(v))
