from __future__ import annotations

import html
import re
from urllib.parse import unquote, urlparse

import requests
from bs4 import BeautifulSoup
from rest_framework.exceptions import ValidationError

from meal.recipe_import import extract_recipe_image_url, validate_http_url
from songaday.resolve_link import ResolveError, resolve_song_link_metadata

REQUEST_TIMEOUT = 12
USER_AGENT = "PondArbor/RecommendationsLinkResolve/1.0"

_FILM_HOSTS = ("imdb.com", "letterboxd.com", "netflix.com", "justwatch.com", "rottentomatoes.com")
_TV_HOSTS = ("hulu.com", "max.com", "disneyplus.com", "tv.apple.com", "crunchyroll.com")
_BOOK_HOSTS = ("goodreads.com", "storygraph.com", "amazon.com", "audible.com")
_MUSIC_HOSTS = ("youtube.com", "youtu.be", "spotify.com", "spotify.link", "music.apple.com")
_RESTAURANT_HOSTS = ("yelp.com", "doordash.com", "grubhub.com", "opentable.com")
_DESTINATION_HOSTS = ("tripadvisor.com", "booking.com", "airbnb.com", "hotels.com", "expedia.com")
_MAPS_HOSTS = ("google.com", "maps.app.goo.gl", "goo.gl")

_LOCATION_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(phoenix|phx)\b", re.I), "phoenix"),
    (re.compile(r"\b(scottsdale)\b", re.I), "scottsdale"),
    (re.compile(r"\b(tempe)\b", re.I), "tempe"),
    (re.compile(r"\b(tucson)\b", re.I), "tucson"),
    (re.compile(r"\b(flagstaff|flag)\b", re.I), "flagstaff"),
    (re.compile(r"\b(sedona)\b", re.I), "sedona"),
    (re.compile(r"\b(mesa)\b", re.I), "mesa"),
]


def _host(url: str) -> str:
    p = urlparse(url)
    h = (p.netloc or "").lower()
    if h.startswith("www."):
        h = h[4:]
    return h


def _host_matches(host: str, suffixes: tuple[str, ...]) -> bool:
    return any(host == s or host.endswith("." + s) for s in suffixes)


def _suggest_category(url: str) -> str | None:
    host = _host(url)
    if _host_matches(host, _MUSIC_HOSTS):
        return "music"
    if _host_matches(host, _FILM_HOSTS):
        return "films"
    if _host_matches(host, _TV_HOSTS):
        return "tv"
    if _host_matches(host, _BOOK_HOSTS):
        return "books"
    if _host_matches(host, _RESTAURANT_HOSTS):
        return "restaurants"
    if _host_matches(host, _DESTINATION_HOSTS):
        return "destinations"
    if _host_matches(host, _MAPS_HOSTS) and "/maps" in url.lower():
        return "restaurants"
    return None


def _infer_location_label(url: str, title: str = "", address: str = "") -> str:
    blob = f"{url} {title} {address}"
    for pattern, label in _LOCATION_PATTERNS:
        if pattern.search(blob):
            return label
    return ""


def _meta_content(soup: BeautifulSoup, *, prop: str | None = None, name: str | None = None) -> str:
    if prop:
        tag = soup.find("meta", attrs={"property": prop})
    else:
        tag = soup.find("meta", attrs={"name": name})
    if tag and tag.get("content"):
        return html.unescape(str(tag["content"]).strip())
    return ""


def _fetch_html(url: str) -> tuple[str, str]:
    normalized = validate_http_url(url)
    try:
        resp = requests.get(
            normalized,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        raise ValidationError({"url": f"Could not fetch page: {e}"}) from e
    return resp.text[:2_000_000], resp.url


def _expand_maps_url(url: str) -> str:
    """Follow short Google Maps links to the canonical URL."""
    lower = (url or "").lower()
    if "maps.app.goo.gl" not in lower and "goo.gl/maps" not in lower:
        return url
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
        resp.raise_for_status()
        return resp.url
    except requests.RequestException:
        return url


def _extract_maps_coords(decoded: str) -> tuple[str, str] | None:
    """
    Extract place pin coordinates from a Google Maps URL.

    Prefer !3d/!4d in the data blob (actual place pin), then @lat,lng on the
    /place/ segment. Avoid the first bare @ match — that is often map viewport.
    """
    data_match = re.search(r"!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)", decoded)
    if data_match:
        return data_match.group(1), data_match.group(2)

    for pattern in (
        r"/maps/place/[^/@]+/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)",
        r"/place/[^/@]+/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)",
    ):
        place_at = re.search(pattern, decoded)
        if place_at:
            return place_at.group(1), place_at.group(2)

    at_matches = list(re.finditer(r"@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)", decoded))
    if len(at_matches) > 1:
        return at_matches[-1].group(1), at_matches[-1].group(2)
    if at_matches:
        return at_matches[0].group(1), at_matches[0].group(2)
    return None


def _extract_maps_place_id(decoded: str) -> str:
    for pattern in (
        r"place_id[:=](ChIJ[A-Za-z0-9_-]+)",
        r"!1s(ChIJ[A-Za-z0-9_-]+)",
        r"[?&]query_place_id=(ChIJ[A-Za-z0-9_-]+)",
    ):
        match = re.search(pattern, decoded)
        if match:
            return match.group(1)
    return ""


def _maps_path_title(decoded: str) -> str:
    place_name = re.search(r"/maps/place/([^/@?]+)", decoded)
    if not place_name:
        return ""
    return html.unescape(place_name.group(1).replace("+", " ")).strip()


def _looks_like_street_address(text: str) -> bool:
    return bool(re.search(r"\d", text) and "," in text)


def _parse_google_maps_url(url: str) -> dict:
    """Best-effort extract place_id, coords, title from Maps URLs without API."""
    out: dict = {}
    decoded = unquote(url)

    place_id = _extract_maps_place_id(decoded)
    if place_id:
        out["google_place_id"] = place_id

    coords = _extract_maps_coords(decoded)
    if coords:
        out["latitude"], out["longitude"] = coords

    title = _maps_path_title(decoded)
    if title:
        out["title"] = title
        if _looks_like_street_address(title):
            out["address"] = title
    return out


def _enrich_maps_data_with_geocode(maps_data: dict) -> dict:
    """Prefer geocoded pin + address over viewport coords parsed from the URL."""
    from recommendations.geocode import _google_geocode, _google_geocode_place_id

    place_id = (maps_data.get("google_place_id") or "").strip()
    geocoded = None
    if place_id.startswith("ChIJ"):
        geocoded = _google_geocode_place_id(place_id)

    title = (maps_data.get("title") or "").strip()
    if geocoded is None and title:
        geocoded = _google_geocode(title)

    if not geocoded:
        return maps_data

    maps_data["latitude"] = geocoded["lat"]
    maps_data["longitude"] = geocoded["lng"]
    if geocoded.get("formatted_address"):
        maps_data["address"] = geocoded["formatted_address"]
    if geocoded.get("place_id"):
        maps_data["google_place_id"] = geocoded["place_id"]
    return maps_data


def _looks_like_url(raw: str) -> bool:
    lower = raw.lower()
    return lower.startswith(("http://", "https://", "geo:"))


def resolve_recommendation_link(url: str) -> dict:
    """
    Return suggested fields + hints for inline form feedback.
    Keys: title, description, image_url, address, location_label, category_slug,
          google_place_id, latitude, longitude, hints (list[str]), partial (bool)
    """
    raw = (url or "").strip()
    hints: list[str] = []
    result: dict = {
        "title": "",
        "description": "",
        "image_url": "",
        "address": "",
        "location_label": "",
        "category_slug": None,
        "google_place_id": "",
        "latitude": None,
        "longitude": None,
        "hints": hints,
        "partial": False,
    }
    if not raw:
        hints.append("Enter a URL or fill in the fields manually.")
        result["partial"] = True
        return result

    if not _looks_like_url(raw):
        from recommendations.geocode import (
            resolve_coordinates_pair,
            resolve_place_query,
            try_parse_coordinates,
        )

        coords = try_parse_coordinates(raw)
        if coords:
            return resolve_coordinates_pair(coords[0], coords[1])
        return resolve_place_query(raw)

    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw

    host = _host(raw)
    result["category_slug"] = _suggest_category(raw)

    # Google Maps URLs
    if _host_matches(host, _MAPS_HOSTS) and ("/maps" in raw.lower() or "maps.app" in host):
        expanded = _expand_maps_url(raw)
        maps_data = _enrich_maps_data_with_geocode(_parse_google_maps_url(expanded))
        result.update({k: v for k, v in maps_data.items() if v})
        if result.get("latitude") and result.get("address"):
            hints.append("Found this place on the map.")
        elif not result.get("title"):
            hints.append("Could not read place name from Maps URL — enter title manually.")
            result["partial"] = True
        if result["category_slug"] is None:
            result["category_slug"] = "restaurants"
        result["location_label"] = _infer_location_label(
            expanded, result.get("title", ""), result.get("address", "")
        )
        return result

    # Music URLs via songaday resolver
    if _host_matches(host, _MUSIC_HOSTS):
        try:
            artist, title, _src = resolve_song_link_metadata(raw)
            if artist and title:
                result["title"] = f"{artist} — {title}"
            elif title:
                result["title"] = title
            else:
                hints.append("Could not read track title — enter manually.")
                result["partial"] = True
            result["category_slug"] = result["category_slug"] or "music"
            return result
        except ResolveError as e:
            hints.append(str(e))
            result["partial"] = True
            return result

    # Generic OG fetch
    try:
        page_html, final_url = _fetch_html(raw)
    except ValidationError as e:
        detail = e.detail
        msg = detail.get("url") if isinstance(detail, dict) else str(detail)
        hints.append(str(msg))
        hints.append("You can still enter details manually.")
        result["partial"] = True
        return result

    soup = BeautifulSoup(page_html, "html.parser")
    title = (
        _meta_content(soup, prop="og:title")
        or _meta_content(soup, name="twitter:title")
        or ""
    )
    if not title:
        ttl = soup.find("title")
        if ttl and ttl.string:
            title = html.unescape(ttl.string.strip())
    result["title"] = title.strip()
    if not result["title"]:
        hints.append("Couldn't fetch title — enter manually.")
        result["partial"] = True

    desc = _meta_content(soup, prop="og:description") or _meta_content(soup, name="description")
    result["description"] = (desc or "").strip()[:2000]

    image = extract_recipe_image_url(soup, final_url, None)
    if image:
        result["image_url"] = image
    else:
        hints.append("No image found.")

    result["location_label"] = _infer_location_label(final_url, result["title"], result.get("address", ""))
    if result["category_slug"] is None:
        result["category_slug"] = "links"
    return result
