"""Map unordered glyph pairs to CharacterClass slug. Glyph ids are emoji (NFC-normalized)."""

from __future__ import annotations

import unicodedata
from typing import Any

# Canonical display order (also used in character creation UI).
GLYPHS: tuple[str, ...] = ("👽", "🤖", "🌡️", "🏛️", "🦠")
GLYPH_IDS = frozenset(GLYPHS)


def normalize_glyph(s: str) -> str:
    return unicodedata.normalize("NFC", str(s).strip())


def normalize_glyphs(raw: list | None) -> tuple[str, str] | None:
    """Return (g1, g2) in request order if valid, else None."""
    if not raw or len(raw) != 2:
        return None
    g1 = normalize_glyph(raw[0])
    g2 = normalize_glyph(raw[1])
    if g1 not in GLYPH_IDS or g2 not in GLYPH_IDS:
        return None
    return (g1, g2)


# Shorthand for building frozenset keys (each pair normalized at import time).
def _p(a: str, b: str) -> frozenset[str]:
    return frozenset({normalize_glyph(a), normalize_glyph(b)})


# Unordered pair -> metadata (slug is the CharacterClass slug).
CLASSES_BY_PAIR: dict[frozenset[str], dict[str, Any]] = {
    _p("🏛️", "🏛️"): {
        "slug": "warlord",
        "name": "Warlord",
        "description": (
            "A commanding force who uses strength and presence to dominate enemies and rally allies."
        ),
        "stat_1": "gains",
        "stat_2": "rizz",
        "sort_order": 10,
    },
    _p("🌡️", "🌡️"): {
        "slug": "wastelander",
        "name": "Wastelander",
        "description": (
            "A hardened survivor who endures brutal conditions through sheer toughness and resilience."
        ),
        "stat_1": "gains",
        "stat_2": "guts",
        "sort_order": 11,
    },
    _p("👽", "👽"): {
        "slug": "ravager",
        "name": "Ravager",
        "description": (
            "A relentless combatant who crashes into enemies and tears through them with speed and force."
        ),
        "stat_1": "gains",
        "stat_2": "moves",
        "sort_order": 12,
    },
    _p("🦠", "🦠"): {
        "slug": "medic",
        "name": "Medic",
        "description": (
            "A battlefield healer who diagnoses, stabilizes, and restores allies through skill and awareness."
        ),
        "stat_1": "smarts",
        "stat_2": "sense",
        "sort_order": 13,
    },
    _p("🤖", "🤖"): {
        "slug": "mechanist",
        "name": "Mechanist",
        "description": (
            "A technical warrior who understands machines and dismantles them with force and precision."
        ),
        "stat_1": "gains",
        "stat_2": "smarts",
        "sort_order": 14,
    },
    _p("🏛️", "🤖"): {
        "slug": "sentinel",
        "name": "Sentinel",
        "description": (
            "A vigilant defender who reads threats and holds the line against hostile machines."
        ),
        "stat_1": "gains",
        "stat_2": "sense",
        "sort_order": 15,
    },
    _p("🤖", "🦠"): {
        "slug": "splicer",
        "name": "Splicer",
        "description": (
            "A resilient specialist who blends science and endurance to combat biological dangers."
        ),
        "stat_1": "smarts",
        "stat_2": "guts",
        "sort_order": 16,
    },
    _p("🦠", "👽"): {
        "slug": "witness",
        "name": "Witness",
        "description": (
            "A survivor who has seen the truth and drives others to act through clarity and conviction."
        ),
        "stat_1": "sense",
        "stat_2": "rizz",
        "sort_order": 17,
    },
    _p("👽", "🌡️"): {
        "slug": "runner",
        "name": "Runner",
        "description": (
            "A mobile scout who navigates dangerous terrain and identifies threats before they strike."
        ),
        "stat_1": "moves",
        "stat_2": "sense",
        "sort_order": 18,
    },
    _p("🌡️", "🏛️"): {
        "slug": "handler",
        "name": "Handler",
        "description": (
            "A strategic organizer who keeps allies supplied, coordinated, and ready for any challenge."
        ),
        "stat_1": "smarts",
        "stat_2": "rizz",
        "sort_order": 19,
    },
    _p("🏛️", "🦠"): {
        "slug": "caretaker",
        "name": "Caretaker",
        "description": (
            "A steady survivor who sustains and guides others through hardship with resilience and resolve."
        ),
        "stat_1": "guts",
        "stat_2": "rizz",
        "sort_order": 20,
    },
    _p("🤖", "👽"): {
        "slug": "saboteur",
        "name": "Saboteur",
        "description": (
            "A precision operative who disrupts enemy systems through speed, skill, and technical insight."
        ),
        "stat_1": "moves",
        "stat_2": "smarts",
        "sort_order": 21,
    },
    _p("🦠", "🌡️"): {
        "slug": "survivalist",
        "name": "Survivalist",
        "description": (
            "A resourceful survivor who withstands harsh environments through awareness and endurance."
        ),
        "stat_1": "guts",
        "stat_2": "sense",
        "sort_order": 22,
    },
    _p("👽", "🏛️"): {
        "slug": "liaison",
        "name": "Liaison",
        "description": (
            "A cunning intermediary who moves between factions, using agility and charm to navigate danger."
        ),
        "stat_1": "moves",
        "stat_2": "rizz",
        "sort_order": 23,
    },
    _p("🌡️", "🤖"): {
        "slug": "scavenger",
        "name": "Scavenger",
        "description": (
            "A scrappy opportunist who survives by recovering and repurposing what others leave behind."
        ),
        "stat_1": "moves",
        "stat_2": "guts",
        "sort_order": 24,
    },
}

# Slug -> row metadata (for DB sync when migration 0035 has not been applied).
SLUG_TO_META: dict[str, dict[str, Any]] = {
    meta["slug"]: meta for meta in CLASSES_BY_PAIR.values()
}


def slug_for_glyphs(g1: str, g2: str) -> str | None:
    """Resolve class slug from two glyphs (order-independent)."""
    key = frozenset({normalize_glyph(g1), normalize_glyph(g2)})
    meta = CLASSES_BY_PAIR.get(key)
    return meta["slug"] if meta else None


def class_meta_for_glyphs(g1: str, g2: str) -> dict[str, Any] | None:
    key = frozenset({normalize_glyph(g1), normalize_glyph(g2)})
    return CLASSES_BY_PAIR.get(key)
