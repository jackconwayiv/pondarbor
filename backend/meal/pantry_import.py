"""Parse free-form pantry/freezer inventory text into structured rows."""

from __future__ import annotations

import re
from dataclasses import dataclass

from meal.recipe_import import (
    ingredient_product_name,
    leading_count_quantity,
    parse_amount_to_float,
    parse_ingredient_line,
)

_RE_AMOUNT_START = re.compile(
    r"^[\d\s./¼½¾⅓⅔⅛⅜⅝⅞\u2150-\u215E-]+",
    re.UNICODE,
)

_CONTAINER_PREFIX = re.compile(
    r"^(?:(?:open|sealed|half[- ]gone|mostly[- ]gone|slightly)\s+)?"
    r"(?:bags?|box(?:es)?|packages?|pkgs?|loaves?|loaf|pucks?|fillet|fillets)\s*,?\s*(?:of\s+)?",
    re.IGNORECASE,
)


def _normalize_ws(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def _title_case_location(header: str) -> str:
    return _normalize_ws(header).title()[:120]


def is_section_header(line: str) -> bool:
    """True for short mostly-uppercase labels like CHEST FREEZER (no leading quantity)."""
    text = _normalize_ws(line)
    if not text or _RE_AMOUNT_START.match(text):
        return False
    words = text.split()
    if len(words) > 8:
        return False
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    upper_ratio = sum(c.isupper() for c in letters) / len(letters)
    return upper_ratio >= 0.75


def strip_container_prefix(name: str) -> str:
    text = _normalize_ws(name)
    while text:
        m = _CONTAINER_PREFIX.match(text)
        if not m:
            break
        text = text[m.end() :].lstrip()
    return text[:255]


def pantry_product_name(raw_line: str) -> str:
    base = ingredient_product_name(raw_line)
    if not base:
        text = _normalize_ws(raw_line)
        m = _RE_AMOUNT_START.match(text)
        if m:
            base = text[m.end() :].lstrip()
        else:
            base = text
    cleaned = strip_container_prefix(base)
    return (cleaned or base or _normalize_ws(raw_line))[:255]


def pantry_line_quantity(raw_line: str) -> int:
    parsed = parse_ingredient_line(raw_line)
    amount = (parsed.get("amount") or "").strip()
    unit = (parsed.get("unit") or "").strip()
    if amount and unit:
        val = parse_amount_to_float(amount)
        if val is not None:
            return max(0, int(round(val)))
    count = leading_count_quantity(raw_line)
    if count is not None:
        return max(0, int(round(count)))
    return 1


@dataclass
class ParsedPantryItem:
    raw_line: str = ""
    location: str = ""
    name: str = ""
    quantity: int = 0
    skipped: bool = False
    is_section_header: bool = False


def parse_pantry_line(raw_line: str, *, location: str = "") -> ParsedPantryItem:
    text = _normalize_ws(raw_line)
    if not text:
        return ParsedPantryItem(raw_line="", skipped=True)

    if is_section_header(text):
        return ParsedPantryItem(
            raw_line=text,
            location=_title_case_location(text),
            skipped=True,
            is_section_header=True,
        )

    name = pantry_product_name(text)
    qty = pantry_line_quantity(text)
    return ParsedPantryItem(
        raw_line=text,
        location=location,
        name=name,
        quantity=qty,
        skipped=not name,
    )


def parse_pantry_text(text: str) -> list[ParsedPantryItem]:
    """
    Parse multiline pantry/freezer inventory text.

    Section headers optionally set location for following lines. Duplicate
    (location, name) pairs within one paste are merged by summing quantity.
    """
    current_location = ""
    merged: dict[tuple[str, str], ParsedPantryItem] = {}
    order: list[tuple[str, str]] = []
    headers: list[ParsedPantryItem] = []

    for raw in (text or "").replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        item = parse_pantry_line(raw, location=current_location)
        if not item.raw_line and item.skipped:
            continue

        if item.is_section_header:
            current_location = item.location
            headers.append(item)
            continue

        if item.skipped or not item.name:
            continue

        key = (item.location, item.name.casefold())
        if key in merged:
            merged[key].quantity += item.quantity
            merged[key].raw_line = f"{merged[key].raw_line}; {item.raw_line}"
        else:
            merged[key] = ParsedPantryItem(
                raw_line=item.raw_line,
                location=item.location,
                name=item.name,
                quantity=item.quantity,
                skipped=False,
            )
            order.append(key)

    results: list[ParsedPantryItem] = []
    emitted_locations: set[str] = set()
    for header in headers:
        loc = header.location
        if loc in emitted_locations:
            continue
        if any(k[0] == loc for k in order):
            results.append(header)
            emitted_locations.add(loc)

    for key in order:
        results.append(merged[key])

    return results


def parsed_pantry_items_to_dicts(items: list[ParsedPantryItem]) -> list[dict]:
    return [
        {
            "raw_line": it.raw_line,
            "location": it.location,
            "name": it.name,
            "quantity": it.quantity,
            "skipped": it.skipped,
            "is_section_header": it.is_section_header,
        }
        for it in items
    ]
