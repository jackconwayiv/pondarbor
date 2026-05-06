"""Glyph/class mapping.

New creation flow uses one glyph (4 options). Legacy pair mappings remain for compatibility.
"""

from __future__ import annotations

import unicodedata
from typing import Any

# New canonical creation glyphs.
GLYPHS: tuple[str, ...] = ("⚔️", "🔑", "📖", "❤️‍🩹")
GLYPH_IDS = frozenset(GLYPHS)

# Legacy glyphs kept for old characters/mappings.
LEGACY_GLYPHS: tuple[str, ...] = ("👽", "🤖", "🌡️", "🏛️", "🦠")
LEGACY_GLYPH_IDS = frozenset(LEGACY_GLYPHS)
ALL_GLYPH_IDS = frozenset((*GLYPHS, *LEGACY_GLYPHS))


def normalize_glyph(s: str) -> str:
    return unicodedata.normalize("NFC", str(s).strip())


def normalize_glyphs(raw: list | None) -> tuple[str, ...] | None:
    """Return validated glyph tuple in request order for create payload."""
    if not raw or len(raw) not in (1, 2):
        return None
    norm = tuple(normalize_glyph(g) for g in raw)
    if len(norm) == 1:
        if norm[0] not in GLYPH_IDS:
            return None
        return norm
    if norm[0] not in ALL_GLYPH_IDS or norm[1] not in ALL_GLYPH_IDS:
        return None
    return norm


def normalize_two_glyphs(raw: list | None) -> tuple[str, str] | None:
    """Compatibility parser for legacy 2-glyph records."""
    if not raw or len(raw) != 2:
        return None
    g1 = normalize_glyph(raw[0])
    g2 = normalize_glyph(raw[1])
    if g1 not in ALL_GLYPH_IDS or g2 not in ALL_GLYPH_IDS:
        return None
    return (g1, g2)


# Shorthand for building frozenset keys (each pair normalized at import time).
def _p(a: str, b: str) -> frozenset[str]:
    return frozenset({normalize_glyph(a), normalize_glyph(b)})


# New one-glyph base classes.
CLASSES_BY_SINGLE: dict[str, dict[str, Any]] = {
    normalize_glyph("⚔️"): {
        "slug": "brawler",
        "name": "Brawler",
        "description": "A fighter of alien invaders and rebellious robots.",
        "stat_1": "gains",
        "stat_2": "guts",
        "sort_order": 1,
    },
    normalize_glyph("🔑"): {
        "slug": "scavenger",
        "name": "Scavenger",
        "description": "A rogue with stealthy skills to fend for yourself.",
        "stat_1": "moves",
        "stat_2": "sense",
        "sort_order": 2,
    },
    normalize_glyph("📖"): {
        "slug": "occultist",
        "name": "Occultist",
        "description": "A scholar of lost knowledge and magical power.",
        "stat_1": "smarts",
        "stat_2": "sense",
        "sort_order": 3,
    },
    normalize_glyph("❤️‍🩹"): {
        "slug": "mender",
        "name": "Mender",
        "description": "A caretaker, steward, and fixer of the broken world.",
        "stat_1": "guts",
        "stat_2": "rizz",
        "sort_order": 4,
    },
}

# New evolved classes (unordered pair from base+second glyph choice).
CLASSES_BY_PAIR_NEW: dict[frozenset[str], dict[str, Any]] = {
    _p("⚔️", "⚔️"): {
        "slug": "brawler_master",
        "name": "Brawler",
        "description": "A master fighter of alien invaders and rebellious robots.",
        "stat_1": "gains",
        "stat_2": "guts",
        "sort_order": 11,
    },
    _p("🔑", "🔑"): {
        "slug": "scavenger_expert",
        "name": "Scavenger",
        "description": "An expert rogue with stealthy skills to fend for yourself.",
        "stat_1": "moves",
        "stat_2": "sense",
        "sort_order": 12,
    },
    _p("📖", "📖"): {
        "slug": "occultist_brilliant",
        "name": "Occultist",
        "description": "A brilliant scholar of lost knowledge and magical power.",
        "stat_1": "smarts",
        "stat_2": "sense",
        "sort_order": 13,
    },
    _p("❤️‍🩹", "❤️‍🩹"): {
        "slug": "mender_potent",
        "name": "Mender",
        "description": "A potent caretaker, steward, and fixer of the broken world.",
        "stat_1": "guts",
        "stat_2": "rizz",
        "sort_order": 14,
    },
    _p("⚔️", "🔑"): {
        "slug": "tracker",
        "name": "Tracker",
        "description": "You take the fight to the enemy with precision and force.",
        "stat_1": "moves",
        "stat_2": "gains",
        "sort_order": 15,
    },
    _p("⚔️", "📖"): {
        "slug": "incarnate",
        "name": "Incarnate",
        "description": "You embody arcane power as a destructive force.",
        "stat_1": "gains",
        "stat_2": "smarts",
        "sort_order": 16,
    },
    _p("⚔️", "❤️‍🩹"): {
        "slug": "defender",
        "name": "Defender",
        "description": "You use your might to protect those who need it.",
        "stat_1": "gains",
        "stat_2": "rizz",
        "sort_order": 17,
    },
    _p("🔑", "📖"): {
        "slug": "hacker",
        "name": "Hacker",
        "description": "You know just enough to make yourself dangerous.",
        "stat_1": "moves",
        "stat_2": "smarts",
        "sort_order": 18,
    },
    _p("🔑", "❤️‍🩹"): {
        "slug": "runner",
        "name": "Runner",
        "description": "You run vital supplies through dangerous lands.",
        "stat_1": "moves",
        "stat_2": "guts",
        "sort_order": 19,
    },
    _p("📖", "❤️‍🩹"): {
        "slug": "witness",
        "name": "Witness",
        "description": "You have seen power beyond mortal reckoning.",
        "stat_1": "smarts",
        "stat_2": "rizz",
        "sort_order": 20,
    },
}

# Legacy unordered pair -> metadata (slug is the CharacterClass slug).
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

# Slug -> row metadata (for DB sync/ensure).
SLUG_TO_META: dict[str, dict[str, Any]] = {}
for _meta in CLASSES_BY_SINGLE.values():
    SLUG_TO_META[_meta["slug"]] = _meta
for _meta in CLASSES_BY_PAIR_NEW.values():
    SLUG_TO_META[_meta["slug"]] = _meta
for _meta in CLASSES_BY_PAIR.values():
    SLUG_TO_META[_meta["slug"]] = _meta


def slug_for_single_glyph(g1: str) -> str | None:
    meta = CLASSES_BY_SINGLE.get(normalize_glyph(g1))
    return meta["slug"] if meta else None


def slug_for_pair_glyphs(g1: str, g2: str) -> str | None:
    key = frozenset({normalize_glyph(g1), normalize_glyph(g2)})
    meta = CLASSES_BY_PAIR_NEW.get(key) or CLASSES_BY_PAIR.get(key)
    return meta["slug"] if meta else None


def class_meta_for_glyphs(g1: str, g2: str) -> dict[str, Any] | None:
    key = frozenset({normalize_glyph(g1), normalize_glyph(g2)})
    return CLASSES_BY_PAIR_NEW.get(key) or CLASSES_BY_PAIR.get(key)
