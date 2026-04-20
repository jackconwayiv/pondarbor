"""Glyph-starter gear: first glyph selects chest armor, second glyph selects main-hand weapon."""

from __future__ import annotations

from qff.glyph_class_map import GLYPH_IDS, normalize_glyph

# Items 01–05 (chest) / 06–10 (main_hand) — slugs match migration `0035_reflavor_glyphs_and_classes`.
ARMOR_SLUG_BY_GLYPH: dict[str, str] = {
    "🏛️": "soiled-suitcoat",
    "🤖": "oil-stained-smock",
    "🦠": "hospital-gown",
    "👽": "space-blanket",
    "🌡️": "wet-rags",
}

WEAPON_SLUG_BY_GLYPH: dict[str, str] = {
    "🏛️": "chipped-gavel",
    "🤖": "greasy-wrench",
    "🦠": "rusty-hacksaw",
    "👽": "stolen-blaster",
    "🌡️": "dessicated-branch",
}


def resolve_starter_item_slugs(glyphs: list | None) -> tuple[str, str] | None:
    """Return (chest_item_slug, main_hand_item_slug) when glyphs are two valid ids."""
    if not glyphs or len(glyphs) != 2:
        return None
    g1 = normalize_glyph(glyphs[0])
    g2 = normalize_glyph(glyphs[1])
    if g1 not in GLYPH_IDS or g2 not in GLYPH_IDS:
        return None
    chest = ARMOR_SLUG_BY_GLYPH.get(g1)
    weapon = WEAPON_SLUG_BY_GLYPH.get(g2)
    if not chest or not weapon:
        return None
    return (chest, weapon)
