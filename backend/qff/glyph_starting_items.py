"""Glyph-starter gear: first glyph selects chest armor, second glyph selects main-hand weapon."""

from __future__ import annotations

from qff.glyph_class_map import GLYPH_IDS

# Items 01-04 (chest) / 05-08 (main_hand) — slugs match migration `0024_glyph_starter_items`.
ARMOR_SLUG_BY_GLYPH: dict[str, str] = {
    "war": "stained-jerkin",
    "survival": "tattered-cloak",
    "study": "stuffy-robe",
    "devotion": "threadbare-gown",
}

WEAPON_SLUG_BY_GLYPH: dict[str, str] = {
    "war": "rusty-sword",
    "survival": "chipped-knife",
    "study": "bent-staff",
    "devotion": "dull-scepter",
}


def resolve_starter_item_slugs(glyphs: list | None) -> tuple[str, str] | None:
    """Return (chest_item_slug, main_hand_item_slug) when glyphs are two valid ids."""
    if not glyphs or len(glyphs) != 2:
        return None
    g1, g2 = str(glyphs[0]).strip(), str(glyphs[1]).strip()
    if g1 not in GLYPH_IDS or g2 not in GLYPH_IDS:
        return None
    chest = ARMOR_SLUG_BY_GLYPH.get(g1)
    weapon = WEAPON_SLUG_BY_GLYPH.get(g2)
    if not chest or not weapon:
        return None
    return (chest, weapon)
