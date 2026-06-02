"""Normalize and validate pantry_tags JSON on UserIngredientInventory."""

from __future__ import annotations

PANTRY_TAG_KEYS = ("food_group", "storage", "preferred_meal", "dietary")

MAX_TAGS_PER_DIMENSION = 12
MAX_TAG_STRING_LEN = 64


def _clean_tag_string(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    s = value.strip()[:MAX_TAG_STRING_LEN]
    return s if s else None


def normalize_pantry_tags(raw: object) -> dict[str, list[str]]:
    """
    Return a dict with all PANTRY_TAG_KEYS; each value is a deduped list of short strings.
    Unknown keys are dropped. Accepts dict or None.
    """
    out: dict[str, list[str]] = {k: [] for k in PANTRY_TAG_KEYS}
    if raw is None:
        return out
    if not isinstance(raw, dict):
        return out
    for key in PANTRY_TAG_KEYS:
        val = raw.get(key)
        if val is None:
            continue
        if not isinstance(val, list):
            continue
        seen: set[str] = set()
        cleaned: list[str] = []
        for item in val:
            s = _clean_tag_string(item)
            if not s:
                continue
            fold = s.casefold()
            if fold in seen:
                continue
            seen.add(fold)
            cleaned.append(s)
            if len(cleaned) >= MAX_TAGS_PER_DIMENSION:
                break
        out[key] = cleaned
    return out
