"""
Fetch and parse recipe pages into Meal-shaped data.

Ingredients always include full ``raw_line`` (grocery generation prefers it).
``amount``, ``unit``, and ``name`` are best-effort for future consolidation/search.
"""

from __future__ import annotations

import html
import ipaddress
import json
import re
import socket
from fractions import Fraction
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from rest_framework.exceptions import ValidationError

MAX_RESPONSE_BYTES = 3 * 1024 * 1024
MAX_IMAGE_BYTES = 2 * 1024 * 1024
REQUEST_TIMEOUT_SEC = 15
USER_AGENT = "PondArbor/MealMaestroRecipeImport/1.0"

# Leading quantity: digits, fractions, unicode fractions, ranges like "1-2"
_RE_AMOUNT_START = re.compile(
    r"^[\d\s./¼½¾⅓⅔⅛⅜⅝⅞\u2150-\u215E-]+",
    re.UNICODE,
)

# Single-token or short multi-token units (best-effort)
_COMMON_UNITS = frozenset(
    {
        "c",
        "cup",
        "cups",
        "tbsp",
        "t",
        "tablespoon",
        "tablespoons",
        "tsp",
        "teaspoon",
        "teaspoons",
        "oz",
        "ounce",
        "ounces",
        "lb",
        "lbs",
        "pound",
        "pounds",
        "g",
        "gram",
        "grams",
        "kg",
        "ml",
        "l",
        "liter",
        "liters",
        "litre",
        "litres",
        "clove",
        "cloves",
        "can",
        "cans",
        "package",
        "packages",
        "pkg",
        "stalk",
        "stalks",
        "slice",
        "slices",
        "bunch",
        "bunches",
        "pinch",
        "pinches",
        "dash",
        "dashes",
        "cube",
        "cubes",
        "medium",
        "large",
        "small",
        "whole",
        "sprig",
        "sprigs",
        "sheet",
        "sheets",
        "stick",
        "sticks",
        "ear",
        "ears",
    }
)


def _strip_tags(s: str) -> str:
    return re.sub(r"<[^>]+>", " ", s or "")


def _normalize_ws(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def _normalize_directions_text(s: str) -> str:
    """
    Keep newlines and horizontal spacing within each line (for readable imported steps).

    Normalizes CRLF/CR to LF, trims trailing spaces per line, strips only the
    document's outer leading/trailing whitespace.
    """
    if not (s or "").strip():
        return ""
    t = (s or "").replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in t.split("\n")]
    return "\n".join(lines).strip()


def _directions_from_markup(s: str) -> str:
    """Turn recipe instruction HTML or plain text into stored directions."""
    raw = (s or "").strip()
    if not raw:
        return ""
    raw = html.unescape(raw)
    if "<" in raw and ">" in raw:
        soup = BeautifulSoup(raw, "html.parser")
        # Block/line breaks become newlines; do not strip each segment (preserves indentation).
        extracted = soup.get_text("\n", strip=False)
        return _normalize_directions_text(extracted)
    return _normalize_directions_text(raw)


def parse_ingredient_line(raw_line: str) -> dict[str, str]:
    """
    Split a single ingredient string into raw_line plus optional amount/unit/name.

    ``raw_line`` is always the cleaned full line (matches grocery ``display_text`` behavior).
    """
    text = _normalize_ws(_strip_tags(html.unescape(raw_line or "")))[:512]
    if not text:
        return {"raw_line": "", "amount": "", "unit": "", "name": ""}

    # Try: [amount tokens...] [unit token] [name rest]
    amt_match = _RE_AMOUNT_START.match(text)
    if not amt_match:
        return {"raw_line": text, "amount": "", "unit": "", "name": ""}

    after_amt = text[amt_match.end() :].lstrip()
    if not after_amt:
        return {"raw_line": text, "amount": "", "unit": "", "name": ""}

    first_word = after_amt.split(None, 1)[0].lower().rstrip(".,;:")
    rest_after_unit = after_amt.split(None, 1)[1] if len(after_amt.split(None, 1)) > 1 else ""

    if first_word in _COMMON_UNITS and rest_after_unit:
        amount = amt_match.group(0).strip()[:64]
        unit = first_word[:64]
        name = rest_after_unit.strip()[:255]
        return {"raw_line": text, "amount": amount, "unit": unit, "name": name}

    return {"raw_line": text, "amount": "", "unit": "", "name": ""}


def ingredient_product_name(raw_line: str) -> str:
    """
    Product name only: no leading quantity, no unit token (e.g. ``1 Hash Browns`` → ``Hash Browns``,
    ``2 cups flour`` → ``flour``).
    """
    p = parse_ingredient_line(raw_line or "")
    name = (p.get("name") or "").strip()
    if name:
        return name[:255]
    text = _normalize_ws(_strip_tags(html.unescape(raw_line or "")))[:512]
    if not text:
        return ""
    m = _RE_AMOUNT_START.match(text)
    if not m:
        return text[:255]
    after_amt = text[m.end() :].lstrip()
    if not after_amt:
        return ""
    first_word = after_amt.split(None, 1)[0].lower().rstrip(".,;:")
    rest_after_unit = after_amt.split(None, 1)[1] if len(after_amt.split(None, 1)) > 1 else ""
    if first_word in _COMMON_UNITS and rest_after_unit:
        return rest_after_unit.strip()[:255]
    return after_amt.strip()[:255]


_VULGAR_FRAC_VALUE = {
    "½": 0.5,
    "⅓": 1 / 3,
    "⅔": 2 / 3,
    "¼": 0.25,
    "¾": 0.75,
    "⅛": 0.125,
    "⅜": 0.375,
    "⅝": 0.625,
    "⅞": 0.875,
}


def parse_amount_to_float(s: str) -> float | None:
    """
    Parse a single amount token (``1``, ``1/2``, ``1 1/2``, ``½``, ``1½``, ``1-2`` range → midpoint).
    """
    raw = (s or "").strip()
    if not raw:
        return None
    if raw in _VULGAR_FRAC_VALUE:
        return _VULGAR_FRAC_VALUE[raw]
    # Range like 1-2 → average
    if raw.count("-") == 1 and not raw.startswith("-"):
        left, right = raw.split("-", 1)
        a, b = parse_amount_to_float(left.strip()), parse_amount_to_float(right.strip())
        if a is not None and b is not None:
            return (a + b) / 2.0
    parts = raw.split()
    if len(parts) == 2 and ("/" in parts[1] or parts[1] in _VULGAR_FRAC_VALUE):
        a0 = parse_amount_to_float(parts[0])
        a1 = parse_amount_to_float(parts[1])
        if a0 is not None and a1 is not None:
            return a0 + a1
    t = raw.replace(" ", "")
    m = re.match(r"^(\d+)([½⅓⅔¼¾⅛⅜⅝⅞])$", t)
    if m:
        return float(m.group(1)) + _VULGAR_FRAC_VALUE[m.group(2)]
    try:
        if "/" in t:
            return float(Fraction(t))
        return float(t)
    except (ValueError, ZeroDivisionError):
        return None


def leading_count_quantity(raw_line: str) -> float | None:
    """
    If the line is ``<amount> <product>`` with no unit token, return the amount (e.g. ``2 Hash Browns`` → 2).
    """
    text = _normalize_ws(_strip_tags(html.unescape(raw_line or "")))[:512]
    if not text:
        return None
    m = _RE_AMOUNT_START.match(text)
    if not m:
        return None
    after_amt = text[m.end() :].lstrip()
    if not after_amt:
        return None
    first_word = after_amt.split(None, 1)[0].lower().rstrip(".,;:")
    if first_word in _COMMON_UNITS:
        return None
    return parse_amount_to_float(m.group(0).strip())


def _host_must_be_public(hostname: str) -> None:
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as e:
        raise ValidationError({"url": "Could not resolve host."}) from e
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
            raise ValidationError({"url": "URL resolves to a disallowed address."})


def validate_http_url(url: str) -> str:
    """Normalize and validate scheme/host; raises ValidationError if unsafe."""
    raw = (url or "").strip()
    if not raw:
        raise ValidationError({"url": "URL is required."})
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        raise ValidationError({"url": "Only http and https URLs are allowed."})
    host = parsed.hostname
    if not host:
        raise ValidationError({"url": "Invalid URL."})
    _host_must_be_public(host)
    # Reconstruct without credentials
    netloc = host
    if parsed.port and parsed.port not in (80, 443):
        netloc = f"{host}:{parsed.port}"
    rebuilt = parsed._replace(netloc=netloc, fragment="").geturl()
    return rebuilt


def fetch_recipe_html(url: str) -> tuple[str, str]:
    """
    GET the page, return (html_text, final_url after redirects).

    Validates the final URL host after redirects for SSRF protection.
    """
    headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"}
    try:
        resp = requests.get(
            url,
            headers=headers,
            timeout=REQUEST_TIMEOUT_SEC,
            stream=True,
            allow_redirects=True,
        )
    except requests.RequestException as e:
        raise ValidationError({"url": f"Could not fetch page: {e}"}) from e

    if resp.status_code >= 400:
        try:
            resp.close()
        except Exception:
            pass
        raise ValidationError(
            {"url": f"Server returned {resp.status_code} for the recipe page."},
        )

    final = resp.url
    final_parsed = urlparse(final)
    if final_parsed.scheme not in ("http", "https"):
        raise ValidationError({"url": "Redirect led to an invalid URL."})
    fh = final_parsed.hostname
    if not fh:
        raise ValidationError({"url": "Invalid URL after redirect."})
    _host_must_be_public(fh)

    chunks: list[bytes] = []
    total = 0
    try:
        for chunk in resp.iter_content(chunk_size=65536):
            if not chunk:
                continue
            total += len(chunk)
            if total > MAX_RESPONSE_BYTES:
                raise ValidationError({"url": "Page is too large to import."})
            chunks.append(chunk)
    finally:
        resp.close()

    raw_bytes = b"".join(chunks)
    encoding = resp.encoding or "utf-8"
    try:
        text = raw_bytes.decode(encoding, errors="replace")
    except LookupError:
        text = raw_bytes.decode("utf-8", errors="replace")

    return text, final


def _walk_json(node: Any) -> list[dict]:
    out: list[dict] = []
    if isinstance(node, dict):
        out.append(node)
        for v in node.values():
            out.extend(_walk_json(v))
    elif isinstance(node, list):
        for item in node:
            out.extend(_walk_json(item))
    return out


def _is_recipe(obj: dict) -> bool:
    t = obj.get("@type")
    if t is None:
        return False
    if isinstance(t, list):
        return any(x == "Recipe" for x in t)
    return t == "Recipe"


def _as_str(x: Any) -> str:
    if x is None:
        return ""
    if isinstance(x, str):
        return x
    if isinstance(x, dict):
        for key in ("text", "name", "headline", "description"):
            v = x.get(key)
            if isinstance(v, str) and v.strip():
                return v
    return str(x)


def _flatten_instructions(node: Any) -> str:
    if node is None:
        return ""
    if isinstance(node, str):
        return _directions_from_markup(node)
    if isinstance(node, dict):
        t = node.get("@type")
        if t == "HowToSection":
            name = _as_str(node.get("name"))
            parts = [_directions_from_markup(name)] if name else []
            for el in node.get("itemListElement") or []:
                parts.append(_flatten_instructions(el))
            return _normalize_directions_text("\n\n".join(p for p in parts if p))
        if t == "HowToStep":
            step = node.get("text") or node.get("name")
            if isinstance(step, list):
                merged = "\n".join(
                    _directions_from_markup(x) if isinstance(x, str) else str(x) for x in step
                )
                return _normalize_directions_text(merged)
            if isinstance(step, str):
                return _directions_from_markup(step)
            return _normalize_directions_text(_as_str(step))
        if "itemListElement" in node:
            bits = [_flatten_instructions(x) for x in node["itemListElement"]]
            return _normalize_directions_text("\n\n".join(b for b in bits if b))
        raw = node.get("text") or node
        if isinstance(raw, str):
            return _directions_from_markup(raw)
        return _normalize_directions_text(_as_str(raw))
    if isinstance(node, list):
        bits = [_flatten_instructions(x) for x in node]
        return _normalize_directions_text("\n\n".join(b for b in bits if b))
    return ""


def _ingredient_to_str(x: Any) -> str:
    if isinstance(x, str):
        return _normalize_ws(_strip_tags(html.unescape(x)))
    if isinstance(x, dict):
        return _normalize_ws(_strip_tags(_as_str(x)))
    return _normalize_ws(str(x))


def _extract_json_ld_recipe(soup: BeautifulSoup) -> dict[str, Any] | None:
    for script in soup.find_all("script", attrs={"type": re.compile(r"ld\+json", re.I)}):
        raw = script.string or script.get_text() or ""
        raw = raw.strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        for obj in _walk_json(data):
            if isinstance(obj, dict) and _is_recipe(obj):
                return obj
    return None


def _meta_content(soup: BeautifulSoup, *, prop: str | None = None, name: str | None = None) -> str:
    if prop:
        tag = soup.find("meta", attrs={"property": prop})
    else:
        tag = soup.find("meta", attrs={"name": name})
    if tag and tag.get("content"):
        return _normalize_ws(html.unescape(tag["content"]))
    return ""


def _first_h1(soup: BeautifulSoup) -> str:
    h1 = soup.find("h1")
    if h1:
        return _normalize_ws(_strip_tags(h1.get_text(" ", strip=True)))
    return ""


def _recipe_ld_image_url(recipe: dict[str, Any]) -> str | None:
    img = recipe.get("image")
    if isinstance(img, str) and img.strip():
        return img.strip()
    if isinstance(img, list) and img:
        first = img[0]
        if isinstance(first, str) and first.strip():
            return first.strip()
        if isinstance(first, dict):
            u = first.get("url") or first.get("contentUrl")
            if isinstance(u, str) and u.strip():
                return u.strip()
    return None


def _meta_image_url_raw(soup: BeautifulSoup, *, prop: str | None = None, name: str | None = None) -> str:
    """Meta image URL without collapsing whitespace (preserve query strings)."""
    if prop:
        tag = soup.find("meta", attrs={"property": prop})
    else:
        tag = soup.find("meta", attrs={"name": name})
    if tag and tag.get("content"):
        return html.unescape(str(tag["content"])).strip()
    return ""


def extract_recipe_image_url(soup: BeautifulSoup, page_url: str, recipe_ld: dict[str, Any] | None) -> str | None:
    """Best-effort absolute URL for the recipe's hero image."""
    candidates: list[str] = []
    if recipe_ld:
        u = _recipe_ld_image_url(recipe_ld)
        if u:
            candidates.append(u)
    og = _meta_image_url_raw(soup, prop="og:image") or _meta_image_url_raw(soup, name="twitter:image")
    if og:
        candidates.append(og)
    tw = soup.find("meta", attrs={"name": "twitter:image:src"})
    if tw and tw.get("content"):
        candidates.append(html.unescape(str(tw["content"])).strip())
    for c in candidates:
        c = (c or "").strip()
        if not c or c.startswith("data:"):
            continue
        abs_url = urljoin(page_url, c)
        try:
            validate_http_url(abs_url)
        except ValidationError:
            continue
        return abs_url
    return None


def fetch_recipe_image_bytes(image_page_url: str) -> bytes:
    """Download image after URL validation (same host rules as recipe page)."""
    normalized = validate_http_url(image_page_url)
    headers = {"User-Agent": USER_AGENT, "Accept": "image/*,*/*;q=0.8"}
    try:
        resp = requests.get(
            normalized,
            headers=headers,
            timeout=REQUEST_TIMEOUT_SEC,
            stream=True,
            allow_redirects=True,
        )
    except requests.RequestException as e:
        raise ValidationError({"url": f"Could not fetch recipe image: {e}"}) from e
    if resp.status_code >= 400:
        try:
            resp.close()
        except Exception:
            pass
        raise ValidationError({"url": f"Recipe image returned HTTP {resp.status_code}."})
    final_parsed = urlparse(resp.url)
    if final_parsed.scheme not in ("http", "https"):
        resp.close()
        raise ValidationError({"url": "Recipe image redirect led to an invalid URL."})
    fh = final_parsed.hostname
    if not fh:
        resp.close()
        raise ValidationError({"url": "Invalid recipe image URL after redirect."})
    _host_must_be_public(fh)
    chunks: list[bytes] = []
    total = 0
    try:
        for chunk in resp.iter_content(chunk_size=65536):
            if not chunk:
                continue
            total += len(chunk)
            if total > MAX_IMAGE_BYTES:
                raise ValidationError({"url": "Recipe image is too large."})
            chunks.append(chunk)
    finally:
        resp.close()
    return b"".join(chunks)


def extract_recipe_from_html(page_html: str, page_url: str) -> dict[str, Any]:
    """
    Return keys: title, blurb, directions, ingredients (list of dicts for MealIngredient).

    Raises ValidationError if nothing usable is found.
    """
    soup = BeautifulSoup(page_html, "html.parser")
    recipe = _extract_json_ld_recipe(soup)

    title = ""
    blurb = ""
    directions = ""
    ingredient_strings: list[str] = []

    if recipe:
        title = _normalize_ws(_as_str(recipe.get("name")))
        desc = recipe.get("description")
        if isinstance(desc, str):
            blurb = _normalize_ws(_strip_tags(html.unescape(desc)))[:2000]
        ri = recipe.get("recipeIngredient") or recipe.get("ingredients")
        if isinstance(ri, list):
            for x in ri:
                s = _ingredient_to_str(x)
                if s:
                    ingredient_strings.append(s)
        elif isinstance(ri, str) and ri.strip():
            ingredient_strings.append(_ingredient_to_str(ri))

        instr = recipe.get("recipeInstructions")
        directions = _flatten_instructions(instr)

    if not title:
        title = _meta_content(soup, prop="og:title") or _meta_content(soup, name="twitter:title")
    if not title:
        ttl = soup.find("title")
        if ttl and ttl.string:
            title = _normalize_ws(html.unescape(ttl.string))
    if not title:
        title = _first_h1(soup)

    if not ingredient_strings:
        # Heuristic fallback: lists near common class names
        for sel in (
            "[class*='ingredient' i]",
            "[class*='wprm-recipe-ingredient' i]",
            "[data-ingredient]",
        ):
            for ul in soup.select(sel):
                parent = ul if ul.name in ("ul", "ol") else ul.find(["ul", "ol"])
                if parent:
                    for li in parent.find_all("li", recursive=False):
                        t = _normalize_ws(_strip_tags(li.get_text(" ", strip=True)))
                        if t and len(t) < 400:
                            ingredient_strings.append(t)
            if ingredient_strings:
                break

    if not directions:
        for sel in ("[class*='instruction' i]", "[class*='direction' i]", "[class*='recipe-steps' i]"):
            block = soup.select_one(sel)
            if block:
                directions = _normalize_directions_text(block.get_text("\n", strip=False))[:20000]
                if directions:
                    break

    if not title.strip():
        raise ValidationError({"url": "Could not find a recipe title on this page."})
    if not ingredient_strings:
        raise ValidationError(
            {"url": "Could not find ingredients on this page (it may require login or block imports)."},
        )

    ingredients: list[dict[str, str]] = []
    for line in ingredient_strings:
        row = parse_ingredient_line(line)
        if row["raw_line"]:
            ingredients.append(row)

    if not ingredients:
        raise ValidationError({"url": "Could not parse any ingredient lines from this page."})

    if not directions:
        directions = ""

    recipe_image_url = extract_recipe_image_url(soup, page_url, recipe)

    out: dict[str, Any] = {
        "title": title[:255],
        "blurb": blurb,
        "directions": directions,
        "ingredients": ingredients,
        "canonical_url": page_url,
    }
    if recipe_image_url:
        out["recipe_image_url"] = recipe_image_url
    if recipe:
        from meal.import_hints import build_import_hints_from_json_ld

        hints = build_import_hints_from_json_ld(recipe)
        if hints:
            out["import_hints"] = hints
    return out
