"""
Goodreads public shelf RSS helpers.

Official API is retired; public per-shelf RSS feeds remain usable when the
profile is public. Shelf names are discovered from the public profile HTML
(RSS itself does not enumerate shelves).
"""

from __future__ import annotations

import ipaddress
import re
import socket
import xml.etree.ElementTree as ET
from typing import Any
from urllib.parse import parse_qs, urlparse

import requests
from bs4 import BeautifulSoup
from django.core.cache import cache
from rest_framework.exceptions import ValidationError

USER_AGENT = "PondArbor/BooksGoodreads/1.0"
REQUEST_TIMEOUT_SEC = 15
MAX_RESPONSE_BYTES = 3 * 1024 * 1024
CACHE_TTL_SEC = 300

STANDARD_SHELVES = ("currently-reading", "read", "to-read")
SHELF_LABELS = {
    "currently-reading": "Currently Reading",
    "read": "Read",
    "to-read": "Want to Read",
}

_RE_USER_SHOW = re.compile(
    r"goodreads\.com/user/show/(\d+)",
    re.IGNORECASE,
)
_RE_REVIEW_LIST = re.compile(
    r"goodreads\.com/review/list(?:_rss)?/(\d+)",
    re.IGNORECASE,
)
_RE_BARE_ID = re.compile(r"^\d{3,12}$")
_RE_SHELF_SLUG = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$")


def shelf_label(slug: str) -> str:
    if slug in SHELF_LABELS:
        return SHELF_LABELS[slug]
    return slug.replace("-", " ").replace("_", " ").strip().title()


def _host_must_be_public(hostname: str) -> None:
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as e:
        raise ValidationError({"profile_url": "Could not resolve host."}) from e
    for info in infos:
        ip_str = info[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise ValidationError({"profile_url": "URL resolves to a disallowed address."})


def _validate_goodreads_url(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        raise ValidationError({"profile_url": "A Goodreads profile URL is required."})
    if _RE_BARE_ID.match(raw):
        return f"https://www.goodreads.com/user/show/{raw}"
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        raise ValidationError({"profile_url": "Only http and https URLs are allowed."})
    host = (parsed.hostname or "").lower()
    if host not in ("goodreads.com", "www.goodreads.com"):
        raise ValidationError({"profile_url": "URL must be a goodreads.com link."})
    _host_must_be_public(host)
    netloc = host
    if parsed.port and parsed.port not in (80, 443):
        netloc = f"{host}:{parsed.port}"
    return parsed._replace(scheme="https", netloc=netloc, fragment="").geturl()


def extract_user_id_from_text(text: str) -> str | None:
    for pattern in (_RE_USER_SHOW, _RE_REVIEW_LIST):
        m = pattern.search(text or "")
        if m:
            return m.group(1)
    return None


def parse_goodreads_user_id(profile_url: str) -> str:
    """
    Extract numeric Goodreads user id from a profile/share/list URL.

    Accepts bare numeric ids. For vanity URLs without an id in the path,
    fetches the page and reads the id from links on the public profile.
    """
    url = _validate_goodreads_url(profile_url)
    found = extract_user_id_from_text(url)
    if found:
        return found

    html, final_url = _fetch_text(url, accept="text/html,application/xhtml+xml;q=0.9,*/*;q=0.8")
    found = extract_user_id_from_text(final_url) or extract_user_id_from_text(html)
    if found:
        return found
    raise ValidationError(
        {
            "profile_url": (
                "Could not find a Goodreads user id. Paste a profile link like "
                "https://www.goodreads.com/user/show/12345678 and ensure the profile is public."
            ),
        },
    )


def _fetch_text(url: str, *, accept: str) -> tuple[str, str]:
    headers = {"User-Agent": USER_AGENT, "Accept": accept}
    try:
        resp = requests.get(
            url,
            headers=headers,
            timeout=REQUEST_TIMEOUT_SEC,
            stream=True,
            allow_redirects=True,
        )
    except requests.RequestException as e:
        raise ValidationError({"profile_url": f"Could not reach Goodreads: {e}"}) from e

    if resp.status_code >= 400:
        try:
            resp.close()
        except Exception:
            pass
        raise ValidationError(
            {"profile_url": f"Goodreads returned HTTP {resp.status_code}."},
        )

    final = resp.url
    final_parsed = urlparse(final)
    if final_parsed.scheme not in ("http", "https"):
        raise ValidationError({"profile_url": "Redirect led to an invalid URL."})
    fh = final_parsed.hostname
    if not fh:
        raise ValidationError({"profile_url": "Invalid URL after redirect."})
    host = fh.lower()
    if host not in ("goodreads.com", "www.goodreads.com"):
        raise ValidationError({"profile_url": "Redirect left goodreads.com."})
    _host_must_be_public(fh)

    chunks: list[bytes] = []
    total = 0
    try:
        for chunk in resp.iter_content(chunk_size=65536):
            if not chunk:
                continue
            total += len(chunk)
            if total > MAX_RESPONSE_BYTES:
                raise ValidationError({"profile_url": "Goodreads response was too large."})
            chunks.append(chunk)
    finally:
        try:
            resp.close()
        except Exception:
            pass

    return b"".join(chunks).decode("utf-8", errors="replace"), final


def discover_shelf_slugs(user_id: str) -> list[str]:
    """
    Discover shelf slugs from the public profile page, plus the three standard shelves.

    Custom shelves appear as ``?shelf=slug`` links on the profile when public.
    """
    if not _RE_BARE_ID.match(str(user_id)):
        raise ValidationError({"profile_url": "Invalid Goodreads user id."})

    profile_url = f"https://www.goodreads.com/user/show/{user_id}"
    html, _final = _fetch_text(
        profile_url,
        accept="text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    )
    soup = BeautifulSoup(html, "html.parser")
    found: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        parsed = urlparse(href)
        qs = parse_qs(parsed.query)
        shelf_vals = qs.get("shelf") or []
        for raw in shelf_vals:
            slug = (raw or "").strip()
            if slug == "all":
                continue
            if _RE_SHELF_SLUG.match(slug):
                found.add(slug)

    ordered: list[str] = []
    for slug in STANDARD_SHELVES:
        ordered.append(slug)
        found.discard(slug)
    ordered.extend(sorted(found))
    return ordered


def _xml_text(el: ET.Element | None) -> str:
    if el is None or el.text is None:
        return ""
    return el.text.strip()


def _first_child(item: ET.Element, tag: str) -> ET.Element | None:
    for child in item:
        local = child.tag.rsplit("}", 1)[-1]
        if local == tag:
            return child
    return None


def _parse_book_item(item: ET.Element) -> dict[str, Any] | None:
    title = _xml_text(_first_child(item, "title"))
    if not title:
        return None

    num_pages = ""
    book_el = _first_child(item, "book")
    if book_el is not None:
        num_pages = _xml_text(_first_child(book_el, "num_pages"))

    rating_raw = _xml_text(_first_child(item, "user_rating"))
    try:
        user_rating = int(rating_raw) if rating_raw else 0
    except ValueError:
        user_rating = 0

    return {
        "title": title,
        "author_name": _xml_text(_first_child(item, "author_name")),
        "book_id": _xml_text(_first_child(item, "book_id")),
        "isbn": _xml_text(_first_child(item, "isbn")),
        "link": _xml_text(_first_child(item, "link")),
        "book_image_url": _xml_text(_first_child(item, "book_medium_image_url"))
        or _xml_text(_first_child(item, "book_image_url")),
        "book_large_image_url": _xml_text(_first_child(item, "book_large_image_url")),
        "num_pages": num_pages,
        "user_rating": user_rating,
        "user_read_at": _xml_text(_first_child(item, "user_read_at")),
        "user_started_at": _xml_text(_first_child(item, "user_started_at")),
        "user_date_added": _xml_text(_first_child(item, "user_date_added")),
        "average_rating": _xml_text(_first_child(item, "average_rating")),
        "book_published": _xml_text(_first_child(item, "book_published")),
        "user_review": _xml_text(_first_child(item, "user_review")),
    }


def parse_shelf_rss(xml_text: str) -> list[dict[str, Any]]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        raise ValidationError({"detail": f"Could not parse Goodreads RSS: {e}"}) from e

    channel = None
    for child in root:
        if child.tag.rsplit("}", 1)[-1] == "channel":
            channel = child
            break
    if channel is None:
        return []

    books: list[dict[str, Any]] = []
    for child in channel:
        if child.tag.rsplit("}", 1)[-1] != "item":
            continue
        book = _parse_book_item(child)
        if book:
            books.append(book)
    return books


def fetch_shelf_books(user_id: str, shelf: str) -> list[dict[str, Any]]:
    if not _RE_BARE_ID.match(str(user_id)):
        raise ValidationError({"detail": "Invalid Goodreads user id."})
    if not _RE_SHELF_SLUG.match(shelf):
        raise ValidationError({"detail": "Invalid shelf name."})
    url = f"https://www.goodreads.com/review/list_rss/{user_id}?shelf={shelf}"
    xml_text, _final = _fetch_text(url, accept="application/rss+xml, application/xml, text/xml, */*")
    return parse_shelf_rss(xml_text)


def fetch_shelf_books_cached(
    user_id: str,
    shelf: str,
    *,
    use_cache: bool = True,
) -> list[dict[str, Any]]:
    cache_key = f"books:goodreads:shelf:{user_id}:{shelf}"
    if use_cache:
        cached = cache.get(cache_key)
        if cached is not None:
            return cached
    books = fetch_shelf_books(user_id, shelf)
    cache.set(cache_key, books, CACHE_TTL_SEC)
    return books


def fetch_all_shelves(user_id: str, *, use_cache: bool = True) -> dict[str, Any]:
    cache_key = f"books:goodreads:shelves:{user_id}"
    if use_cache:
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

    slugs = discover_shelf_slugs(user_id)
    shelves: list[dict[str, Any]] = []
    for slug in slugs:
        try:
            books = fetch_shelf_books_cached(user_id, slug, use_cache=use_cache)
        except ValidationError:
            # Skip shelves that error (private/missing); keep others.
            continue
        shelves.append(
            {
                "slug": slug,
                "label": shelf_label(slug),
                "book_count": len(books),
                "books": books,
            },
        )

    payload = {
        "goodreads_user_id": str(user_id),
        "profile_url": f"https://www.goodreads.com/user/show/{user_id}",
        "shelves": shelves,
    }
    cache.set(cache_key, payload, CACHE_TTL_SEC)
    return payload


def invalidate_shelves_cache(user_id: str) -> None:
    cache.delete(f"books:goodreads:shelves:{user_id}")
    for shelf in STANDARD_SHELVES:
        cache.delete(f"books:goodreads:shelf:{user_id}:{shelf}")
