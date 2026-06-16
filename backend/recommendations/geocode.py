from __future__ import annotations

import os
import re
from typing import Any

import requests

from recommendations.link_resolve import _infer_location_label
from recommendations.services import normalize_coordinate

GEOCODE_TIMEOUT = 10
_USER_AGENT = "PondArbor/RecommendationsGeocode/1.0"

_COORD_RE = re.compile(
    r"^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$"
)


def split_name_and_address(raw: str) -> tuple[str, str]:
    """
    Split "Business Name, 123 Main St, City, ST 12345" into title + address.
    If the first segment looks like a street address, treat the whole string as address.
    """
    text = (raw or "").strip()
    if "," not in text:
        return "", text
    first, _, rest = text.partition(",")
    first = first.strip()
    rest = rest.strip()
    if not rest:
        return "", text
    if re.match(r"^\d", first):
        return "", text
    return first, rest


def try_parse_coordinates(raw: str) -> tuple[str, str] | None:
    match = _COORD_RE.match((raw or "").strip())
    if not match:
        return None
    lat = float(match.group(1))
    lng = float(match.group(2))
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None
    return str(lat), str(lng)


def _google_reverse_geocode(lat: str, lng: str) -> dict[str, Any] | None:
    api_key = (os.getenv("GOOGLE_MAPS_SERVER_API_KEY") or "").strip()
    if not api_key:
        return None
    try:
        resp = requests.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"latlng": f"{lat},{lng}", "key": api_key},
            headers={"User-Agent": _USER_AGENT},
            timeout=GEOCODE_TIMEOUT,
        )
        resp.raise_for_status()
        payload = resp.json()
    except requests.RequestException:
        return None
    if payload.get("status") != "OK":
        return None
    results = payload.get("results") or []
    if not results:
        return None
    top = results[0]
    return {
        "formatted_address": (top.get("formatted_address") or "").strip(),
        "place_id": (top.get("place_id") or "").strip(),
    }


def reverse_geocode_coords(lat, lng) -> dict[str, Any] | None:
    """Reverse-geocode coordinates to formatted address + place_id."""
    lat_s = str(lat).strip() if lat is not None else ""
    lng_s = str(lng).strip() if lng is not None else ""
    if not lat_s or not lng_s:
        return None
    return _google_reverse_geocode(lat_s, lng_s)


def _google_geocode_place_id(place_id: str) -> dict[str, Any] | None:
    pid = (place_id or "").strip()
    if not pid:
        return None
    api_key = (os.getenv("GOOGLE_MAPS_SERVER_API_KEY") or "").strip()
    if not api_key:
        return None
    try:
        resp = requests.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"place_id": pid, "key": api_key},
            headers={"User-Agent": _USER_AGENT},
            timeout=GEOCODE_TIMEOUT,
        )
        resp.raise_for_status()
        payload = resp.json()
    except requests.RequestException:
        return None
    if payload.get("status") != "OK":
        return None
    results = payload.get("results") or []
    if not results:
        return None
    top = results[0]
    location = (top.get("geometry") or {}).get("location") or {}
    lat = location.get("lat")
    lng = location.get("lng")
    if lat is None or lng is None:
        return None
    try:
        lat_dec = normalize_coordinate(lat, kind="latitude")
        lng_dec = normalize_coordinate(lng, kind="longitude")
    except ValueError:
        return None
    if lat_dec is None or lng_dec is None:
        return None
    return {
        "lat": str(lat_dec),
        "lng": str(lng_dec),
        "formatted_address": (top.get("formatted_address") or "").strip(),
        "place_id": (top.get("place_id") or pid).strip(),
    }


def _google_geocode(query: str) -> dict[str, Any] | None:
    api_key = (os.getenv("GOOGLE_MAPS_SERVER_API_KEY") or "").strip()
    if not api_key:
        return None
    try:
        resp = requests.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": query, "key": api_key},
            headers={"User-Agent": _USER_AGENT},
            timeout=GEOCODE_TIMEOUT,
        )
        resp.raise_for_status()
        payload = resp.json()
    except requests.RequestException:
        return None
    if payload.get("status") != "OK":
        return None
    results = payload.get("results") or []
    if not results:
        return None
    top = results[0]
    location = (top.get("geometry") or {}).get("location") or {}
    lat = location.get("lat")
    lng = location.get("lng")
    if lat is None or lng is None:
        return None
    try:
        lat_dec = normalize_coordinate(lat, kind="latitude")
        lng_dec = normalize_coordinate(lng, kind="longitude")
    except ValueError:
        return None
    if lat_dec is None or lng_dec is None:
        return None
    return {
        "lat": str(lat_dec),
        "lng": str(lng_dec),
        "formatted_address": (top.get("formatted_address") or "").strip(),
        "place_id": (top.get("place_id") or "").strip(),
    }


def resolve_place_query(query: str) -> dict:
    """Geocode a free-form place name / address paste (non-URL)."""
    raw = (query or "").strip()
    hints: list[str] = []
    title, address = split_name_and_address(raw)
    geocode_query = raw

    result: dict = {
        "title": title,
        "description": "",
        "image_url": "",
        "address": address or raw,
        "location_label": "",
        "category_slug": "restaurants",
        "google_place_id": "",
        "latitude": None,
        "longitude": None,
        "hints": hints,
        "partial": False,
    }

    geocoded = _google_geocode(geocode_query)
    if geocoded:
        result["latitude"] = geocoded["lat"]
        result["longitude"] = geocoded["lng"]
        result["google_place_id"] = geocoded.get("place_id") or ""
        if geocoded.get("formatted_address"):
            result["address"] = geocoded["formatted_address"]
        if not title and geocoded.get("formatted_address"):
            result["title"] = geocoded["formatted_address"].split(",")[0].strip()
        result["location_label"] = _infer_location_label(
            geocoded.get("formatted_address") or raw,
            result["title"],
            result["address"],
        )
        hints.append("Found this place on the map.")
        return result

    if title:
        hints.append("Saved the name and address — add coordinates later if needed.")
    else:
        hints.append("Saved the address — add a title on the next step if needed.")
    result["location_label"] = _infer_location_label(raw, title, result["address"])
    result["partial"] = True
    if not os.getenv("GOOGLE_MAPS_SERVER_API_KEY"):
        hints.append("Set GOOGLE_MAPS_SERVER_API_KEY to geocode addresses automatically.")
    else:
        hints.append("Could not geocode this address — you can still post without map coordinates.")
    return result


def resolve_coordinates_pair(lat: str, lng: str) -> dict:
    hints = ["Using pasted coordinates."]
    try:
        lat_dec = normalize_coordinate(lat, kind="latitude")
        lng_dec = normalize_coordinate(lng, kind="longitude")
    except ValueError:
        lat_dec = None
        lng_dec = None
    result: dict = {
        "title": "",
        "description": "",
        "image_url": "",
        "address": "",
        "location_label": "",
        "category_slug": "restaurants",
        "google_place_id": "",
        "latitude": str(lat_dec) if lat_dec is not None else lat,
        "longitude": str(lng_dec) if lng_dec is not None else lng,
        "hints": hints,
        "partial": True,
    }
    geocoded = reverse_geocode_coords(lat, lng)
    if geocoded:
        formatted = geocoded.get("formatted_address") or ""
        if formatted:
            result["address"] = formatted
        result["google_place_id"] = geocoded.get("place_id") or ""
        result["location_label"] = _infer_location_label(formatted, "", formatted)
        if result["location_label"]:
            hints.append(f"Near {result['location_label'].title()}.")
        else:
            hints.append("Found an address for these coordinates.")
        result["partial"] = False
    elif not os.getenv("GOOGLE_MAPS_SERVER_API_KEY"):
        hints.append("Set GOOGLE_MAPS_SERVER_API_KEY to look up city from coordinates.")
    return result
