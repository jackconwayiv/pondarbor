"""
Parse /song command text into fields compatible with SongResponseCreateSerializer.
"""

from __future__ import annotations

import html
import re
from urllib.parse import parse_qs, urlparse

import emoji

from songaday.resolve_link import ResolveError, resolve_from_youtube_video_id, resolve_song_link_metadata
from songaday.serializers import _host_allowed

_SLACK_LINK = re.compile(r"^<([^|>\s]+)(?:\|[^>]+)?>$")
_SLACK_LINK_SEARCH = re.compile(r"<(https?://[^|>\s]+)(?:\|[^>]+)?>", re.I)
_PLAIN_URL_RE = re.compile(r"https?://\S+", re.I)
_SLACK_MENTION = re.compile(r"<@[^>]+>")
_SLACK_CHANNEL = re.compile(r"<#[^>]+>")
_SLACK_SPECIAL = re.compile(r"<![^>]+>")
_SLACK_EMOJI_TOKEN = re.compile(r":([a-z0-9_+-]+):", re.I)
_MAX_NOTES_LEN = 10000


def extract_first_slack_url(text: str) -> str:
    """
    Pull the first http(s) URL from Slack message text.

    Handles Slack link formatting (<https://...|label>) and plain URLs embedded in text.
    """
    if not text:
        return ""
    m = _SLACK_LINK_SEARCH.search(text)
    if m:
        return m.group(1).strip()
    m2 = _PLAIN_URL_RE.search(text)
    if m2:
        return m2.group(0).strip().rstrip(").,>]")
    return ""


def _normalize_notes_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _render_slack_emoji(text: str) -> str:
    rendered = emoji.emojize(text, language="alias")
    return _SLACK_EMOJI_TOKEN.sub(" ", rendered)


def extract_slack_message_notes(message_text: str, *, url: str = "") -> str:
    """
    Pull comment prose from a Slack message, omitting song links and mention tokens.

    Decodes HTML entities and converts standard Slack :emoji: aliases to Unicode.
    Unrecognized :custom_emoji: tokens are removed.
    """
    s = (message_text or "").strip()
    if not s:
        return ""

    s = _SLACK_LINK_SEARCH.sub(" ", s)
    s = _PLAIN_URL_RE.sub(" ", s)
    if url:
        s = s.replace(url, " ")
    s = _SLACK_MENTION.sub(" ", s)
    s = _SLACK_CHANNEL.sub(" ", s)
    s = _SLACK_SPECIAL.sub(" ", s)
    s = html.unescape(s)
    s = _render_slack_emoji(s)
    s = _normalize_notes_whitespace(s)
    if len(s) > _MAX_NOTES_LEN:
        return s[:_MAX_NOTES_LEN]
    return s


def _strip_slack_wrappers(raw: str) -> str:
    s = (raw or "").strip()
    m = _SLACK_LINK.match(s)
    if m:
        return m.group(1).strip()
    return s


def _youtube_id_from_url(url: str) -> str:
    try:
        p = urlparse(url)
    except Exception:
        return ""
    host = (p.netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]
    path = (p.path or "").strip("/")
    if host in ("youtu.be", "www.youtu.be"):
        part = path.split("/")[0] if path else ""
        return part.strip() if part else ""
    if "youtube" not in host:
        return ""
    if path.startswith("watch"):
        q = parse_qs(p.query)
        v = q.get("v", [""])[0]
        return (v or "").strip()
    if path.startswith("shorts/"):
        return path.split("/")[1].strip() if "/" in path else ""
    if path.startswith("embed/"):
        return path.split("/")[1].strip() if "/" in path else ""
    return ""


def build_serializer_data_from_slack_text(
    *, text: str, entry_date, prompt_snapshot: str, notes: str = ""
) -> dict:
    """
    Returns a dict suitable for SongResponseCreateSerializer (date objects, not strings).
    """
    raw = _strip_slack_wrappers(text)
    if not raw:
        raise ValueError("Add a song link or YouTube id after `/song`.")

    youtube_video_id = ""
    spotify_url = ""
    apple_music_url = ""
    raw_label = ""

    if re.fullmatch(r"^[a-zA-Z0-9_-]{6,32}$", raw):
        youtube_video_id = raw
    elif "://" in raw or raw.startswith("http"):
        low = raw.lower()
        if any(h in low for h in ("spotify.com", "spotify.link")):
            spotify_url = raw
        elif "music.apple.com" in low or "geo.music.apple.com" in low:
            apple_music_url = raw
        else:
            yt = _youtube_id_from_url(raw)
            if yt:
                youtube_video_id = yt
            elif _host_allowed(raw):
                spotify_url = raw if "spotify" in low else ""
                apple_music_url = raw if "apple.com" in low else ""
                if not spotify_url and not apple_music_url:
                    raw_label = raw
            else:
                raw_label = raw
    else:
        raw_label = raw

    artist = ""
    title = ""
    try:
        if youtube_video_id:
            artist, title, _src = resolve_from_youtube_video_id(youtube_video_id)
        elif spotify_url or apple_music_url:
            artist, title, _src = resolve_song_link_metadata(spotify_url or apple_music_url)
    except ResolveError:
        pass

    return {
        "entry_date": entry_date,
        "prompt_snapshot": prompt_snapshot,
        "notes": (notes or "").strip(),
        "artist": artist or "",
        "title": title or "",
        "raw_label": raw_label or "",
        "youtube_video_id": youtube_video_id or "",
        "spotify_url": spotify_url or "",
        "apple_music_url": apple_music_url or "",
    }
