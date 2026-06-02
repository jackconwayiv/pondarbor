"""Ingredients always treated as in-stock for pantry recipe matching (can-make / almost-make)."""

from __future__ import annotations

import re

# Fixed list for now; later: user-defined staples on profile.
ASSUMED_PANTRY_STAPLES: tuple[str, ...] = (
    "olive oil",
    "salt",
    "pepper",
    "butter",
)

# Ingredient names containing these phrases are not treated as the spice staple "pepper".
_PEPPER_VEGETABLE_MARKERS = (
    "bell pepper",
    "green pepper",
    "red pepper",
    "sweet pepper",
    "chili pepper",
    "chile pepper",
    "jalapeño",
    "jalapeno",
    "habanero",
    "serrano pepper",
    "poblano",
    "anaheim pepper",
)

_OLIVE_OIL_RE = re.compile(r"olive\s+oil", re.IGNORECASE)
_WORD_STAPLE_RES = {
    "salt": re.compile(r"\bsalt\b", re.IGNORECASE),
    "butter": re.compile(r"\bbutter\b", re.IGNORECASE),
    "pepper": re.compile(r"\bpepper\b", re.IGNORECASE),
}


def is_assumed_pantry_staple(name: str) -> bool:
    """
    True when this ingredient line should not count against pantry for preparability.

    Matches olive oil (phrase), salt/butter (word), and pepper (word) except common
    fresh pepper produce names (bell pepper, etc.).
    """
    n = (name or "").strip()
    if not n:
        return False
    fold = n.casefold()

    if _OLIVE_OIL_RE.search(n):
        return True

    if _WORD_STAPLE_RES["salt"].search(n):
        return True

    if _WORD_STAPLE_RES["butter"].search(n):
        return True

    if _WORD_STAPLE_RES["pepper"].search(n):
        if any(marker in fold for marker in _PEPPER_VEGETABLE_MARKERS):
            return False
        return True

    return False
