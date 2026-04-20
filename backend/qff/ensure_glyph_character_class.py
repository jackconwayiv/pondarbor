"""Create glyph-backed CharacterClass rows from canon metadata if missing (e.g. unmigrated DB)."""

from __future__ import annotations

from qff.glyph_class_map import SLUG_TO_META
from qff.models import CharacterClass


def ensure_glyph_character_class(slug: str) -> CharacterClass | None:
    """If slug is one of the 15 glyph classes, ensure a DB row exists and return it."""
    meta = SLUG_TO_META.get(slug)
    if not meta:
        return None
    cc, _ = CharacterClass.objects.get_or_create(
        slug=slug,
        defaults={
            "name": meta["name"],
            "description": meta["description"],
            "sort_order": meta["sort_order"],
            "priority_stat_1": meta["stat_1"],
            "priority_stat_2": meta["stat_2"],
            "starter_chest_item": None,
            "starter_main_hand_item": None,
            "extra_data": {},
        },
    )
    return cc
