"""Glyph-starter gear for new single-glyph and legacy two-glyph heroes."""

from __future__ import annotations

from qff.glyph_class_map import ALL_GLYPH_IDS, GLYPH_IDS, LEGACY_GLYPH_IDS, normalize_glyph

# Legacy glyph compatibility mappings.
ARMOR_SLUG_BY_GLYPH_LEGACY: dict[str, str] = {
    "🏛️": "soiled-leathers",
    "🤖": "fleabitten-cloak",
    "🦠": "bloodstained-jacket",
    "👽": "unwashed-robe",
    "🌡️": "fleabitten-cloak",
}

WEAPON_SLUG_BY_GLYPH_LEGACY: dict[str, str] = {
    "🏛️": "rusty-sword",
    "🤖": "dented-knife",
    "🦠": "wooden-spoon",
    "👽": "broken-wand",
    "🌡️": "dented-knife",
}

ARMOR_SLUG_BY_GLYPH_NEW: dict[str, str] = {
    "⚔️": "soiled-leathers",
    "🔑": "fleabitten-cloak",
    "📖": "unwashed-robe",
    "❤️‍🩹": "bloodstained-jacket",
}

WEAPON_SLUG_BY_GLYPH_NEW: dict[str, str] = {
    "⚔️": "rusty-sword",
    "🔑": "dented-knife",
    "📖": "broken-wand",
    "❤️‍🩹": "wooden-spoon",
}


def resolve_starter_item_slugs(glyphs: list | None) -> tuple[str, str] | None:
    """Return (chest_item_slug, main_hand_item_slug) for valid glyph layouts."""
    if not glyphs:
        return None
    norm = [normalize_glyph(g) for g in glyphs]
    if any(g not in ALL_GLYPH_IDS for g in norm):
        return None
    if len(norm) == 1 and norm[0] in GLYPH_IDS:
        g = norm[0]
        chest = ARMOR_SLUG_BY_GLYPH_NEW.get(g)
        weapon = WEAPON_SLUG_BY_GLYPH_NEW.get(g)
        if chest and weapon:
            return (chest, weapon)
        return None
    if len(norm) != 2:
        return None
    g1, g2 = norm
    if g1 in LEGACY_GLYPH_IDS and g2 in LEGACY_GLYPH_IDS:
        chest = ARMOR_SLUG_BY_GLYPH_LEGACY.get(g1)
        weapon = WEAPON_SLUG_BY_GLYPH_LEGACY.get(g2)
    else:
        chest = ARMOR_SLUG_BY_GLYPH_NEW.get(g1)
        weapon = WEAPON_SLUG_BY_GLYPH_NEW.get(g2)
    if not chest or not weapon:
        return None
    return (chest, weapon)
