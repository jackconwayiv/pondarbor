"""Map ordered glyph pairs to CharacterClass slug. Glyphs: war, survival, study, devotion."""

from __future__ import annotations

GLYPH_IDS = frozenset({"war", "survival", "study", "devotion"})

# (first_glyph, second_glyph) -> class slug
GLYPH_PAIR_TO_SLUG: dict[tuple[str, str], str] = {
    ("war", "war"): "bulwark",
    ("survival", "survival"): "scoundrel",
    ("study", "study"): "magister",
    ("devotion", "devotion"): "devotee",
    ("war", "survival"): "skirmisher",
    ("survival", "war"): "wayfarer",
    ("war", "study"): "savant",
    ("study", "war"): "spellblade",
    ("war", "devotion"): "warden",
    ("devotion", "war"): "champion",
    ("survival", "study"): "virtuoso",
    ("study", "survival"): "tinker",
    ("survival", "devotion"): "firebrand",
    ("devotion", "survival"): "seeker",
    ("study", "devotion"): "physicker",
    ("devotion", "study"): "visionary",
}


def normalize_glyphs(raw: list | None) -> tuple[str, str] | None:
    """Return (g1, g2) if valid, else None."""
    if not raw or len(raw) != 2:
        return None
    g1, g2 = str(raw[0]).strip(), str(raw[1]).strip()
    if g1 not in GLYPH_IDS or g2 not in GLYPH_IDS:
        return None
    return (g1, g2)


def slug_for_glyphs(g1: str, g2: str) -> str | None:
    return GLYPH_PAIR_TO_SLUG.get((g1, g2))
