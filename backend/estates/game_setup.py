from __future__ import annotations

import random
from dataclasses import dataclass


SUIT_CARD_CONFIG = (
    ("peasant", "green", "pitchfork"),
    ("noble", "blue", "heraldic_shield"),
    ("royal", "yellow", "crown"),
)

ZONE_NAMES_IN_SCORING_ORDER = ("gate", "throne", "farm", "road", "tower")

# Automated scoring pauses: one zone per step in scoring order.
SCORING_STEPS_IN_ORDER: tuple[tuple[str, ...], ...] = (
    ("gate",),
    ("throne",),
    ("farm",),
    ("road",),
    ("tower",),
)
ZONE_ALLOWED_SUITS = {
    "gate": {"peasant", "noble", "royal"},
    "farm": {"peasant"},
    "road": {"peasant", "noble"},
    "tower": {"noble", "royal"},
    "throne": {"royal"},
}
SUIT_STRENGTH = {"peasant": 1, "noble": 2, "royal": 3}


@dataclass
class OpeningHandResult:
    deck: list[dict]
    hand: list[dict]
    discard: list[dict]


def build_starting_deck() -> list[dict]:
    cards: list[dict] = []
    card_index = 0
    for suit, color, symbol in SUIT_CARD_CONFIG:
        for rank in range(1, 6):
            for _ in range(2):
                card_index += 1
                cards.append(
                    {
                        "card_id": f"{suit}-{rank}-{card_index}",
                        "suit": suit,
                        "color": color,
                        "symbol": symbol,
                        "rank": rank,
                        "temporary_value_modifier": 0,
                        "permanent_value_bonus": 0,
                    }
                )
    return cards


def create_opening_hand_state(*, hand_size: int = 5) -> OpeningHandResult:
    deck = list(build_starting_deck())
    random.shuffle(deck)
    hand = deck[:hand_size]
    draw_pile = deck[hand_size:]
    return OpeningHandResult(deck=draw_pile, hand=hand, discard=[])


def initial_placements_by_zone() -> dict[str, dict[str, dict | None]]:
    return {
        zone: {
            "1": None,
            "2": None,
        }
        for zone in ZONE_NAMES_IN_SCORING_ORDER
    }


def coerce_int(value, default: int = 0) -> int:
    if value is None or value is False:
        return default
    if isinstance(value, bool):
        return int(value)
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def card_total_value(card: dict) -> int:
    rank = coerce_int(card.get("rank"), 0)
    permanent = coerce_int(card.get("permanent_value_bonus"), 0)
    temporary = coerce_int(card.get("temporary_value_modifier"), 0)
    return rank + permanent + temporary


def normalize_suit_value(suit: str) -> str:
    """Map suit/color alias strings to canonical peasant, noble, or royal."""
    value = str(suit or "").strip().lower()
    if value in {"peasant", "green"}:
        return "peasant"
    if value in {"noble", "blue"}:
        return "noble"
    if value in {"royal", "orange", "yellow"}:
        return "royal"
    return value


def normalize_card_suit(card: dict) -> str:
    """Map suit/color fields to canonical peasant, noble, or royal."""
    suit = str(card.get("suit") or "").strip().lower()
    color = str(card.get("color") or "").strip().lower()
    for value in (suit, color):
        if value in {"peasant", "green"}:
            return "peasant"
        if value in {"noble", "blue"}:
            return "noble"
        if value in {"royal", "orange", "yellow"}:
            return "royal"
    return suit


def suit_strength(suit: str) -> int:
    return SUIT_STRENGTH.get(normalize_suit_value(suit), 0)


def is_suit_allowed_in_zone(*, zone: str, suit: str) -> bool:
    allowed = ZONE_ALLOWED_SUITS.get(zone)
    if not allowed:
        return False
    return normalize_suit_value(suit) in allowed

