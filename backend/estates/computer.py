from __future__ import annotations

import json
import random
from collections import Counter
from dataclasses import dataclass
from math import comb
from typing import Callable, Literal

from .constants import COMPUTER_PERSONAS
from .game_setup import (
    SUIT_CARD_CONFIG,
    ZONE_NAMES_IN_SCORING_ORDER,
    card_total_value,
    is_suit_allowed_in_zone,
    normalize_card_suit,
    suit_strength,
)

ZoneName = Literal["gate", "farm", "road", "tower", "throne"]
EffectType = Literal["gate_debuff", "farm_upgrade", "tower_discard"]

# Fair-info: opponent hand/deck are never read. Spent pile (discard) is public and used on normal/hard.
# Placement goals (higher tier = more important). Gate has no tier of its own—the value of
# winning Gate is the best win/block tier achievable via -1 debuff on another zone.
ZONE_WIN_TIER: dict[str, int] = {
    "throne": 8,
    "farm": 6,
    "road": 4,
    "tower": 2,
}
ZONE_BLOCK_TIER: dict[str, int] = {
    "throne": 7,
    "farm": 5,
    "road": 3,
    "tower": 1,
}
TIER_POINTS = 12.0
CARDS_PER_PLAYER_PER_ROUND = 3
HARD_CONTESTED_ZONES = frozenset({"throne", "tower"})
NORMAL_CONTESTED_ZONES = frozenset({"throne", "tower"})

PERSONA_ZONE_WEIGHTS: dict[str, dict[str, float]] = {
    "throne_rush": {"throne": 1.6, "farm": 1.0, "road": 0.9, "gate": 0.85, "tower": 1.0},
    "farm_builder": {"throne": 1.1, "farm": 1.6, "road": 1.0, "gate": 0.9, "tower": 0.95},
    "road_runner": {"throne": 1.0, "farm": 0.95, "road": 1.5, "gate": 0.9, "tower": 1.05},
    "gate_slasher": {"throne": 1.0, "farm": 0.9, "road": 0.95, "gate": 1.5, "tower": 1.0},
}

BASE_ZONE_WEIGHTS = {
    "throne": 1.6,
    "farm": 1.2,
    "road": 0.9,
    "tower": 0.7,
    "gate": 0.4,
}

EASY_ZONE_TIEBREAK = dict(ZONE_WIN_TIER)

@dataclass(frozen=True)
class PlacementMove:
    kind: Literal["placement"] = "placement"
    card_id: str = ""
    zone: str = ""


@dataclass(frozen=True)
class EffectMove:
    kind: Literal["effect"] = "effect"
    effect_type: str = ""
    target_zone: str = ""
    target_card_id: str = ""
    target_card_ids: tuple[str, ...] = ()
    go_first: bool | None = None


ComputerMove = PlacementMove | EffectMove
ZonePersonas = dict[str, str]


def pick_random_zone_personas() -> ZonePersonas:
    return {zone: random.choice(COMPUTER_PERSONAS) for zone in ZONE_NAMES_IN_SCORING_ORDER}


def pick_random_persona() -> str:
    """Legacy: single persona id; easy games store full zone map via serialize_zone_personas."""
    return random.choice(COMPUTER_PERSONAS)


def serialize_zone_personas(personas: ZonePersonas) -> str:
    return json.dumps(personas, sort_keys=True)


def normalize_zone_personas(raw: str | dict | None) -> ZonePersonas:
    if isinstance(raw, dict):
        return {zone: _valid_persona(raw.get(zone)) for zone in ZONE_NAMES_IN_SCORING_ORDER}
    if isinstance(raw, str) and raw.strip():
        if raw in COMPUTER_PERSONAS:
            return {zone: raw for zone in ZONE_NAMES_IN_SCORING_ORDER}
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return {zone: _valid_persona(parsed.get(zone)) for zone in ZONE_NAMES_IN_SCORING_ORDER}
        except json.JSONDecodeError:
            pass
    return pick_random_zone_personas()


def _valid_persona(value: object) -> str:
    persona = str(value or "").strip()
    return persona if persona in COMPUTER_PERSONAS else "throne_rush"


def assign_round_zone_personas(
    *,
    difficulty: str,
    stored_persona: str,
    opponent_discard: list[dict],
    placements: dict,
    opponent_seat: int,
    opponent_hand_count: int = 0,
    opponent_deck_count: int = 0,
) -> ZonePersonas:
    if difficulty == "easy":
        return normalize_zone_personas(stored_persona)
    if difficulty == "normal":
        return pick_random_zone_personas()
    card_pool = build_opponent_card_pool(
        opponent_discard=opponent_discard,
        placements=placements,
        opponent_seat=opponent_seat,
        opponent_hand_count=opponent_hand_count,
        opponent_deck_count=opponent_deck_count,
    )
    return optimize_zone_personas(
        opponent_discard=opponent_discard,
        placements=placements,
        opponent_seat=opponent_seat,
        card_pool=card_pool,
    )


def optimize_zone_personas(
    *,
    opponent_discard: list[dict],
    placements: dict,
    opponent_seat: int,
    card_pool: OpponentCardPool | None = None,
) -> ZonePersonas:
    """Hard: count cards from spent pile + board; pick per-zone personas."""
    pressure = _opponent_zone_pressure(
        opponent_discard=opponent_discard,
        placements=placements,
        opponent_seat=opponent_seat,
        card_pool=card_pool,
    )
    personas: ZonePersonas = {}
    for zone in ZONE_NAMES_IN_SCORING_ORDER:
        opp_strength = pressure.get(zone, 0.0)
        best_persona = "throne_rush"
        best_score = -1.0
        zone_tier = max(ZONE_WIN_TIER.get(zone, 0), ZONE_BLOCK_TIER.get(zone, 0))
        for persona in COMPUTER_PERSONAS:
            weight = _zone_weight(zone, {zone: persona})
            score = (zone_tier + 1.0) * weight * (3.0 - min(opp_strength, 3.0))
            if score > best_score:
                best_score = score
                best_persona = persona
        personas[zone] = best_persona
    return personas


def zone_personas_from_payload(payload: dict | None, *, stored_persona: str) -> ZonePersonas:
    if isinstance(payload, dict):
        raw = payload.get("computer_zone_personas")
        if isinstance(raw, dict) and raw:
            return normalize_zone_personas(raw)
    return normalize_zone_personas(stored_persona)


def _zone_weight(zone: str, zone_personas: ZonePersonas) -> float:
    persona = _valid_persona(zone_personas.get(zone))
    tweaks = PERSONA_ZONE_WEIGHTS.get(persona, PERSONA_ZONE_WEIGHTS["throne_rush"])
    return BASE_ZONE_WEIGHTS[zone] * tweaks.get(zone, 1.0)


def _confirmed_card(zone_payload: dict, seat_key: str) -> dict | None:
    placed = zone_payload.get(seat_key)
    if not isinstance(placed, dict) or not placed.get("confirmed"):
        return None
    card = placed.get("card")
    return card if isinstance(card, dict) else None


def _zone_winner_seat(zone_payload: dict) -> int | None:
    top = _confirmed_card(zone_payload, "1")
    bottom = _confirmed_card(zone_payload, "2")
    if top is None and bottom is None:
        return None

    def eligible(card: dict | None) -> bool:
        return card is not None and card_total_value(card) > 0

    top_ok = eligible(top)
    bottom_ok = eligible(bottom)
    if top_ok and not bottom_ok:
        return 1
    if bottom_ok and not top_ok:
        return 2
    if not top_ok and not bottom_ok:
        return None
    tv = card_total_value(top)
    bv = card_total_value(bottom)
    if tv > bv:
        return 1
    if bv > tv:
        return 2
    ts = suit_strength(normalize_card_suit(top))
    bs = suit_strength(normalize_card_suit(bottom))
    if ts > bs:
        return 1
    if bs > ts:
        return 2
    return None


def _hypothetical_zone_payload(zone_payload: dict, *, seat: int, card: dict) -> dict:
    payload = {
        "1": zone_payload.get("1"),
        "2": zone_payload.get("2"),
    }
    payload[str(seat)] = {"card": dict(card), "confirmed": True}
    return payload


def _zone_is_empty_for_both(zone_payload: dict, *, computer_seat: int, opponent_seat: int) -> bool:
    return (
        _confirmed_card(zone_payload, str(computer_seat)) is None
        and _confirmed_card(zone_payload, str(opponent_seat)) is None
    )


def _computer_slot_open(zone_payload: dict, *, computer_seat: int) -> bool:
    seat_key = str(computer_seat)
    placed = zone_payload.get(seat_key)
    return not (isinstance(placed, dict) and placed.get("confirmed"))


def _hypothetical_winner(
    *,
    card: dict,
    zone_payload: dict,
    computer_seat: int,
) -> int | None:
    hypo = _hypothetical_zone_payload(zone_payload, seat=computer_seat, card=card)
    return _zone_winner_seat(hypo)


def _would_win_zone(
    *,
    card: dict,
    zone_payload: dict,
    computer_seat: int,
) -> bool:
    return _hypothetical_winner(card=card, zone_payload=zone_payload, computer_seat=computer_seat) == computer_seat


def _opportunity_tier_for_move(
    *,
    zone: str,
    zone_payload: dict,
    card: dict,
    placements: dict,
    computer_seat: int,
    opponent_seat: int,
    computer_score: int,
    victory_score: int,
) -> int:
    """Best strategic tier this play achieves (win tier beats block tier for same zone)."""
    before_winner = _zone_winner_seat(zone_payload)
    after_winner = _hypothetical_winner(card=card, zone_payload=zone_payload, computer_seat=computer_seat)
    if zone == "gate" and after_winner == computer_seat:
        tier, _ = _best_gate_debuff_outcome(
            placements=placements,
            actor_seat=computer_seat,
            target_seat=opponent_seat,
            computer_score=computer_score,
            victory_score=victory_score,
        )
        return tier
    if after_winner == computer_seat:
        return ZONE_WIN_TIER.get(zone, 0)
    if before_winner == opponent_seat and after_winner is None:
        return ZONE_BLOCK_TIER.get(zone, 0)
    return 0


def _gate_debuff_goal_for_target(
    *,
    placements: dict,
    zone_name: str,
    card: dict,
    target_seat: int,
    actor_seat: int,
    computer_score: int,
    victory_score: int,
) -> tuple[int, float]:
    """Tier and score for applying Gate -1 to an opponent card in another zone."""
    zone_payload = placements.get(zone_name) or {}
    before, after = _gate_debuff_outcome(zone_payload, card=card, target_seat=target_seat)
    if before == actor_seat:
        return 0, 0.0

    if after == actor_seat and before != actor_seat:
        tier = ZONE_WIN_TIER.get(zone_name, 0)
        bonus = tier * TIER_POINTS
        if zone_name == "throne" and computer_score + 1 >= victory_score:
            bonus += 40.0
        elif zone_name == "throne":
            bonus += 15.0
        return tier, bonus

    if before == target_seat and after != target_seat:
        tier = ZONE_BLOCK_TIER.get(zone_name, 0)
        return tier, tier * TIER_POINTS * 0.55

    if before == target_seat and after is None:
        tier = ZONE_BLOCK_TIER.get(zone_name, 0)
        return tier, tier * TIER_POINTS * 0.55

    return 0, 0.0


def _best_gate_debuff_outcome(
    *,
    placements: dict,
    actor_seat: int,
    target_seat: int,
    computer_score: int,
    victory_score: int,
) -> tuple[int, float]:
    """Best ranked win/block achievable by winning Gate and debuffing the opponent."""
    best_tier = 0
    best_bonus = 0.0
    for zone_name, _, card in _gate_targets(placements, actor_seat=actor_seat, target_seat=target_seat):
        tier, bonus = _gate_debuff_goal_for_target(
            placements=placements,
            zone_name=zone_name,
            card=card,
            target_seat=target_seat,
            actor_seat=actor_seat,
            computer_score=computer_score,
            victory_score=victory_score,
        )
        if tier > best_tier or (tier == best_tier and bonus > best_bonus):
            best_tier, best_bonus = tier, bonus
    return best_tier, best_bonus


def _strategic_goal_bonus(
    *,
    zone: str,
    zone_payload: dict,
    card: dict,
    placements: dict,
    computer_seat: int,
    opponent_seat: int,
    computer_score: int,
    victory_score: int,
    opp_card: dict | None,
) -> float:
    """Score from ranked goals: win throne > block throne > win farm > … > block tower."""
    before_winner = _zone_winner_seat(zone_payload)
    after_winner = _hypothetical_winner(card=card, zone_payload=zone_payload, computer_seat=computer_seat)

    if zone == "gate":
        if after_winner != computer_seat:
            if before_winner == opponent_seat and after_winner is None:
                return ZONE_BLOCK_TIER.get("throne", 0) * TIER_POINTS * 0.15
            return 0.0
        _, bonus = _best_gate_debuff_outcome(
            placements=placements,
            actor_seat=computer_seat,
            target_seat=opponent_seat,
            computer_score=computer_score,
            victory_score=victory_score,
        )
        return bonus

    bonus = 0.0

    if after_winner == computer_seat:
        tier = ZONE_WIN_TIER.get(zone, 0)
        bonus = tier * TIER_POINTS
        if zone == "throne":
            if computer_score + 1 >= victory_score:
                bonus += 40.0
            elif before_winner == opponent_seat:
                bonus += 15.0
        return bonus

    if before_winner == opponent_seat and after_winner is None:
        tier = ZONE_BLOCK_TIER.get(zone, 0)
        return tier * TIER_POINTS * 0.55

    if before_winner == opponent_seat and after_winner == opponent_seat:
        return -8.0 * ZONE_BLOCK_TIER.get(zone, 1)

    return bonus


def _move_strategic_tier(
    *,
    zone: str,
    zone_payload: dict,
    card: dict,
    placements: dict,
    computer_seat: int,
    opponent_seat: int,
    winner: int | None,
    computer_score: int,
    victory_score: int,
) -> int:
    if zone == "gate" and winner == computer_seat:
        tier, _ = _best_gate_debuff_outcome(
            placements=placements,
            actor_seat=computer_seat,
            target_seat=opponent_seat,
            computer_score=computer_score,
            victory_score=victory_score,
        )
        return tier
    if winner == computer_seat:
        return ZONE_WIN_TIER.get(zone, 0)
    before_winner = _zone_winner_seat(zone_payload)
    after_winner = _hypothetical_winner(card=card, zone_payload=zone_payload, computer_seat=computer_seat)
    if before_winner == opponent_seat and after_winner is None:
        return ZONE_BLOCK_TIER.get(zone, 0)
    return 0


def _spurn_contested_win_penalty(
    *,
    move_zone: str,
    card: dict,
    placements: dict,
    computer_seat: int,
    opponent_seat: int,
    zone_empty: bool,
    winner: int | None,
    computer_score: int,
    victory_score: int,
) -> float:
    """Do not spend a card on a low-tier empty zone when a higher-tier win/block is available."""
    if not zone_empty or winner != computer_seat:
        return 0.0
    move_payload = placements.get(move_zone) or {"1": None, "2": None}
    move_tier = _move_strategic_tier(
        zone=move_zone,
        zone_payload=move_payload,
        card=card,
        placements=placements,
        computer_seat=computer_seat,
        opponent_seat=opponent_seat,
        winner=winner,
        computer_score=computer_score,
        victory_score=victory_score,
    )
    suit = normalize_card_suit(card)
    penalty = 0.0
    opp_key = str(opponent_seat)
    for other_zone in ZONE_NAMES_IN_SCORING_ORDER:
        if other_zone == move_zone:
            continue
        other_payload = placements.get(other_zone) or {"1": None, "2": None}
        if not _computer_slot_open(other_payload, computer_seat=computer_seat):
            continue
        if not is_suit_allowed_in_zone(zone=other_zone, suit=suit):
            continue
        other_tier = _opportunity_tier_for_move(
            zone=other_zone,
            zone_payload=other_payload,
            card=card,
            placements=placements,
            computer_seat=computer_seat,
            opponent_seat=opponent_seat,
            computer_score=computer_score,
            victory_score=victory_score,
        )
        if other_tier <= move_tier:
            continue
        opp_card = _confirmed_card(other_payload, opp_key)
        if opp_card is None and other_tier == 0:
            continue
        beat_penalty = (other_tier - move_tier) * TIER_POINTS + card_total_value(card) * 2.0
        penalty = max(penalty, beat_penalty)
    return penalty


CardSignature = tuple[str, int, int]


@dataclass(frozen=True)
class OpponentCardPool:
    """Remaining cards in the opponent's own 30-card deck (not seen in hand)."""

    counter: Counter[CardSignature]
    opponent_pool_size: int
    total_remaining: int


def _card_signature(card: dict) -> CardSignature:
    return (
        normalize_card_suit(card),
        int(card.get("rank") or 0),
        int(card.get("permanent_value_bonus") or 0),
    )


def _pool_tracking_signature(card: dict) -> CardSignature:
    """Map a played/spent card to its slot in the 30-card deck template (always perm=0).

    Farm/Road upgrades change effective value but not how many copies exist; when the
    AI sees an upgraded card on the board or in the spent pile, it removes one base
    (suit, rank, 0) from the opponent pool. Board pressure still uses the real card
    (including bonus) via card_total_value().
    """
    suit, rank, _perm = _card_signature(card)
    return (suit, rank, 0)


def _card_from_signature(suit: str, rank: int, permanent_bonus: int) -> dict:
    return {
        "suit": suit,
        "rank": rank,
        "permanent_value_bonus": permanent_bonus,
        "temporary_value_modifier": 0,
    }


def _build_full_deck_counter() -> Counter[CardSignature]:
    counter: Counter[CardSignature] = Counter()
    for suit, _, _ in SUIT_CARD_CONFIG:
        for rank in range(1, 6):
            for _ in range(2):
                counter[(suit, rank, 0)] += 1
    return counter


def _remove_card_from_counter(counter: Counter[CardSignature], card: dict) -> None:
    sig = _pool_tracking_signature(card)
    if counter[sig] > 0:
        counter[sig] -= 1


def build_opponent_card_pool(
    *,
    opponent_discard: list[dict],
    placements: dict,
    opponent_seat: int,
    opponent_hand_count: int,
    opponent_deck_count: int,
) -> OpponentCardPool:
    """Each player has their own 30-card deck; count only cards still in the opponent's."""
    counter = _build_full_deck_counter()
    for card in list(opponent_discard or []):
        if isinstance(card, dict):
            _remove_card_from_counter(counter, card)
    opp_key = str(opponent_seat)
    for zone_name in ZONE_NAMES_IN_SCORING_ORDER:
        zone_payload = placements.get(zone_name) or {"1": None, "2": None}
        if not isinstance(zone_payload, dict):
            continue
        placed = _confirmed_card(zone_payload, opp_key)
        if placed is not None:
            _remove_card_from_counter(counter, placed)
    total_remaining = sum(counter.values())
    opponent_pool = max(0, int(opponent_hand_count or 0) + int(opponent_deck_count or 0))
    return OpponentCardPool(
        counter=counter,
        opponent_pool_size=min(opponent_pool, total_remaining),
        total_remaining=total_remaining,
    )


def _prob_at_least_one_in_opponent_pool(
    pool: OpponentCardPool,
    *,
    matching_count: int,
) -> float:
    """Hypergeometric: P(>=1 matching card in opponent hand+deck)."""
    total = pool.total_remaining
    draws = pool.opponent_pool_size
    successes = matching_count
    if draws <= 0 or successes <= 0 or total <= 0:
        return 0.0
    if successes >= total:
        return 1.0
    draws = min(draws, total)
    failures = total - successes
    if failures < draws:
        return 1.0
    return 1.0 - comb(failures, draws) / comb(total, draws)


def _count_cards_matching(
    pool: OpponentCardPool,
    predicate: Callable[[CardSignature], bool],
) -> int:
    return sum(cnt for sig, cnt in pool.counter.items() if cnt > 0 and predicate(sig))


def _opponent_card_would_beat(
    opp_card: dict,
    *,
    our_card: dict,
    zone_payload: dict,
    opponent_seat: int,
    computer_seat: int,
) -> bool:
    hypo = {
        "1": zone_payload.get("1"),
        "2": zone_payload.get("2"),
    }
    hypo[str(computer_seat)] = {"card": dict(our_card), "confirmed": True}
    hypo[str(opponent_seat)] = {"card": dict(opp_card), "confirmed": True}
    return _zone_winner_seat(hypo) == opponent_seat


def _prob_opponent_beats_card_in_zone(
    pool: OpponentCardPool,
    *,
    zone: str,
    our_card: dict,
    zone_payload: dict,
    opponent_seat: int,
    computer_seat: int,
) -> float:
    matching = 0
    for sig, cnt in pool.counter.items():
        if cnt <= 0:
            continue
        suit, rank, perm = sig
        if not is_suit_allowed_in_zone(zone=zone, suit=suit):
            continue
        opp_card = _card_from_signature(suit, rank, perm)
        if _opponent_card_would_beat(
            opp_card,
            our_card=our_card,
            zone_payload=zone_payload,
            opponent_seat=opponent_seat,
            computer_seat=computer_seat,
        ):
            matching += cnt
    return _prob_at_least_one_in_opponent_pool(pool, matching_count=matching)


def _expected_rank_in_zone_from_pool(pool: OpponentCardPool, *, zone: str) -> float:
    """Average effective rank opponent could still play into an open zone."""
    total = 0
    weighted = 0.0
    for sig, cnt in pool.counter.items():
        if cnt <= 0:
            continue
        suit, rank, perm = sig
        if not is_suit_allowed_in_zone(zone=zone, suit=suit):
            continue
        total += cnt
        weighted += (rank + perm) * cnt
    if total <= 0:
        return 1.5
    avg = weighted / total
    share = pool.opponent_pool_size / max(pool.total_remaining, 1)
    return min(5.0, max(1.5, 1.5 + (avg - 1.5) * share))


def _count_spent_by_suit(discard: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {"peasant": 0, "noble": 0, "royal": 0}
    for card in discard:
        if not isinstance(card, dict):
            continue
        suit = normalize_card_suit(card)
        counts[suit] = counts.get(suit, 0) + 1
    return counts


def _remaining_deck_strength_by_suit(*, opponent_discard: list[dict]) -> dict[str, float]:
    spent = _count_spent_by_suit(opponent_discard)
    remaining: dict[str, float] = {}
    for suit in ("peasant", "noble", "royal"):
        total_cards = 10
        spent_count = spent.get(suit, 0)
        remaining_count = max(total_cards - spent_count, 1)
        remaining[suit] = 3.0 * (remaining_count / total_cards) + 1.5 * (1.0 - spent_count / total_cards)
    return remaining


def _opponent_zone_pressure(
    *,
    opponent_discard: list[dict],
    placements: dict,
    opponent_seat: int,
    card_pool: OpponentCardPool | None = None,
) -> dict[str, float]:
    """Higher = opponent likely strong in this zone (from board + inference)."""
    opp_key = str(opponent_seat)
    suit_remaining = _remaining_deck_strength_by_suit(opponent_discard=opponent_discard)
    pressure: dict[str, float] = {zone: 0.0 for zone in ZONE_NAMES_IN_SCORING_ORDER}
    for zone in ZONE_NAMES_IN_SCORING_ORDER:
        zone_payload = placements.get(zone) or {"1": None, "2": None}
        opp_card = _confirmed_card(zone_payload, opp_key)
        if opp_card is not None:
            pressure[zone] = float(card_total_value(opp_card))
            continue
        if card_pool is not None:
            pressure[zone] = _expected_rank_in_zone_from_pool(card_pool, zone=zone)
            continue
        if zone == "road":
            pressure[zone] = max(suit_remaining.get("peasant", 3.0), suit_remaining.get("noble", 3.0)) * 0.5
        elif zone == "gate":
            pressure[zone] = sum(suit_remaining.values()) / 3.0
        elif zone == "farm":
            pressure[zone] = suit_remaining.get("peasant", 3.0)
        elif zone == "tower":
            pressure[zone] = suit_remaining.get("noble", 3.0)
        elif zone == "throne":
            pressure[zone] = suit_remaining.get("royal", 3.0)
    return pressure


def _expected_opponent_rank(
    *,
    zone: str,
    opponent_discard: list[dict],
    placements: dict,
    opponent_seat: int,
    use_spent_inference: bool,
    card_pool: OpponentCardPool | None = None,
) -> float:
    if not use_spent_inference:
        return 3.5
    if card_pool is not None:
        return _expected_rank_in_zone_from_pool(card_pool, zone=zone)
    pressure = _opponent_zone_pressure(
        opponent_discard=opponent_discard,
        placements=placements,
        opponent_seat=opponent_seat,
        card_pool=None,
    )
    return min(max(pressure.get(zone, 3.5), 1.5), 5.0)


def _enumerate_placement_moves(
    *,
    computer_hand: list[dict],
    placements: dict,
    computer_seat: int,
) -> list[PlacementMove]:
    seat_key = str(computer_seat)
    moves: list[PlacementMove] = []
    for card in computer_hand:
        card_id = str(card.get("card_id") or "")
        if not card_id:
            continue
        suit = normalize_card_suit(card)
        for zone in ZONE_NAMES_IN_SCORING_ORDER:
            zone_payload = placements.get(zone) or {"1": None, "2": None}
            if isinstance(zone_payload.get(seat_key), dict) and zone_payload[seat_key].get("confirmed"):
                continue
            if is_suit_allowed_in_zone(zone=zone, suit=suit):
                moves.append(PlacementMove(card_id=card_id, zone=zone))
    return moves


def _score_placement_move(
    *,
    move: PlacementMove,
    card: dict,
    placements: dict,
    computer_seat: int,
    opponent_seat: int,
    computer_score: int,
    opponent_score: int,
    victory_score: int,
    zone_personas: ZonePersonas,
    difficulty: str,
    opponent_discard: list[dict],
    plays_this_round: int,
    card_pool: OpponentCardPool | None = None,
    computer_is_starting_player: bool = False,
    opponent_plays_this_round: int = 0,
) -> float:
    zone = move.zone
    weight = _zone_weight(zone, zone_personas)
    zone_payload = placements.get(zone) or {"1": None, "2": None}
    hypo = _hypothetical_zone_payload(zone_payload, seat=computer_seat, card=card)
    winner = _zone_winner_seat(hypo)
    before_winner = _zone_winner_seat(zone_payload)
    value = card_total_value(card)
    opp_card = _confirmed_card(zone_payload, str(opponent_seat))
    zone_empty = _zone_is_empty_for_both(
        zone_payload, computer_seat=computer_seat, opponent_seat=opponent_seat
    )

    score = _strategic_goal_bonus(
        zone=zone,
        zone_payload=zone_payload,
        card=card,
        placements=placements,
        computer_seat=computer_seat,
        opponent_seat=opponent_seat,
        computer_score=computer_score,
        victory_score=victory_score,
        opp_card=opp_card,
    )

    if winner == computer_seat:
        score += 2.0 * weight
    elif winner is None:
        score += 0.5
    else:
        score -= 4.0

    if winner == computer_seat:
        score += _winning_card_efficiency_adjustment(
            card=card,
            opp_card=opp_card,
            winner=winner,
            computer_seat=computer_seat,
            placements=placements,
            opponent_seat=opponent_seat,
            plays_this_round=plays_this_round,
            difficulty=difficulty,
            zone=zone,
            zone_payload=zone_payload,
            card_pool=card_pool,
        )

    if difficulty == "hard" and opp_card is not None:
        if winner == computer_seat:
            score += ZONE_WIN_TIER.get(zone, 0) * 2.0
        elif before_winner == opponent_seat and winner is None:
            score += ZONE_BLOCK_TIER.get(zone, 0) * 2.0

    if (
        difficulty == "hard"
        and computer_is_starting_player
        and opponent_plays_this_round == 0
        and zone == "tower"
        and zone_empty
        and winner == computer_seat
    ):
        score += 10.0

    if (
        difficulty == "hard"
        and computer_is_starting_player
        and opponent_plays_this_round == 0
        and zone_empty
        and winner == computer_seat
        and zone in HARD_CONTESTED_ZONES
    ):
        prob_beat = _prob_opponent_beats_stake(
            card=card,
            zone=zone,
            zone_payload=zone_payload,
            opponent_seat=opponent_seat,
            computer_seat=computer_seat,
            card_pool=card_pool,
        )
        score -= prob_beat * 12.0 * weight

    if (
        difficulty == "hard"
        and (not computer_is_starting_player or opponent_plays_this_round > 0)
        and zone_empty
        and winner == computer_seat
        and zone in HARD_CONTESTED_ZONES
    ):
        prob_beat = _prob_opponent_beats_stake(
            card=card,
            zone=zone,
            zone_payload=zone_payload,
            opponent_seat=opponent_seat,
            computer_seat=computer_seat,
            card_pool=card_pool,
        )
        score -= prob_beat * 6.0 * weight

    if zone_empty and winner == computer_seat:
        if difficulty in ("normal", "hard"):
            score -= _spurn_contested_win_penalty(
                move_zone=zone,
                card=card,
                placements=placements,
                computer_seat=computer_seat,
                opponent_seat=opponent_seat,
                zone_empty=zone_empty,
                winner=winner,
                computer_score=computer_score,
                victory_score=victory_score,
            )
    elif winner != computer_seat:
        score += value * 0.1 * weight

    suit = normalize_card_suit(card)
    if zone == "farm" and suit == "peasant":
        score += 1.5
    if zone == "throne" and suit == "royal":
        score += 2.0
    if zone == "tower" and suit in {"noble", "royal"}:
        score += 1.0

    if difficulty in ("normal", "hard"):
        reply_penalty = _estimate_opponent_reply_penalty(
            move=move,
            placements=placements,
            computer_seat=computer_seat,
            opponent_seat=opponent_seat,
            zone_personas=zone_personas,
            opponent_discard=opponent_discard,
            use_spent_inference=difficulty in ("normal", "hard"),
            card_pool=card_pool,
        )
        penalty_scale = 0.45 if difficulty == "hard" else 0.3
        score -= reply_penalty * penalty_scale
        if zone_empty and winner == computer_seat:
            score -= _zone_reply_risk_penalty(
                zone=zone,
                card=card,
                zone_payload=zone_payload,
                computer_seat=computer_seat,
                opponent_seat=opponent_seat,
                zone_personas=zone_personas,
                card_pool=card_pool,
            ) * (0.45 if difficulty == "hard" else 0.3)

    return score


def _estimate_opponent_reply_penalty(
    *,
    move: PlacementMove,
    placements: dict,
    computer_seat: int,
    opponent_seat: int,
    zone_personas: ZonePersonas,
    opponent_discard: list[dict],
    use_spent_inference: bool,
    card_pool: OpponentCardPool | None = None,
) -> float:
    """Fair-info: opponent hand unknown; hard mode counts cards from spent pile + board."""
    penalty = 0.0
    opp_key = str(opponent_seat)
    for zone in ZONE_NAMES_IN_SCORING_ORDER:
        if zone == move.zone:
            continue
        zone_payload = placements.get(zone) or {"1": None, "2": None}
        if _confirmed_card(zone_payload, opp_key) is not None:
            continue
        if _confirmed_card(zone_payload, str(computer_seat)) is not None:
            continue
        expected_rank = _expected_opponent_rank(
            zone=zone,
            opponent_discard=opponent_discard,
            placements=placements,
            opponent_seat=opponent_seat,
            use_spent_inference=use_spent_inference,
            card_pool=card_pool,
        )
        if card_pool is not None:
            legal_count = _count_cards_matching(
                card_pool,
                lambda sig, z=zone: is_suit_allowed_in_zone(zone=z, suit=sig[0]),
            )
            reply_prob = _prob_at_least_one_in_opponent_pool(card_pool, matching_count=legal_count)
            penalty += reply_prob * expected_rank * _zone_weight(zone, zone_personas) * 0.5
        else:
            penalty += expected_rank * _zone_weight(zone, zone_personas) * 0.5
    return penalty


def _computer_plays_this_round(placements: dict, *, computer_seat: int) -> int:
    return sum(
        1
        for zone in ZONE_NAMES_IN_SCORING_ORDER
        if _confirmed_card(placements.get(zone) or {"1": None, "2": None}, str(computer_seat)) is not None
    )


def _opponent_plays_this_round(placements: dict, *, opponent_seat: int) -> int:
    return sum(
        1
        for zone in ZONE_NAMES_IN_SCORING_ORDER
        if _confirmed_card(placements.get(zone) or {"1": None, "2": None}, str(opponent_seat)) is not None
    )


def _contested_zones_for_difficulty(difficulty: str) -> frozenset[str]:
    if difficulty == "hard":
        return HARD_CONTESTED_ZONES
    if difficulty == "normal":
        return NORMAL_CONTESTED_ZONES
    return frozenset()


def _prob_opponent_beats_stake(
    *,
    card: dict,
    zone: str,
    zone_payload: dict,
    opponent_seat: int,
    computer_seat: int,
    card_pool: OpponentCardPool | None,
) -> float:
    if card_pool is None:
        return 0.35
    return _prob_opponent_beats_card_in_zone(
        card_pool,
        zone=zone,
        our_card=card,
        zone_payload=zone_payload,
        opponent_seat=opponent_seat,
        computer_seat=computer_seat,
    )


def _zone_reply_risk_penalty(
    *,
    zone: str,
    card: dict,
    zone_payload: dict,
    computer_seat: int,
    opponent_seat: int,
    zone_personas: ZonePersonas,
    card_pool: OpponentCardPool | None,
) -> float:
    """Penalty when opponent can still play into this zone and beat our stake."""
    if _confirmed_card(zone_payload, str(opponent_seat)) is not None:
        return 0.0
    prob_beat = _prob_opponent_beats_stake(
        card=card,
        zone=zone,
        zone_payload=zone_payload,
        opponent_seat=opponent_seat,
        computer_seat=computer_seat,
        card_pool=card_pool,
    )
    return prob_beat * 15.0 * _zone_weight(zone, zone_personas)


def _card_timing_tiebreak(
    *,
    card: dict,
    difficulty: str,
    plays_this_round: int,
    zone: str = "",
) -> float:
    """Tie-breaker only—never outweighs zone win/block priority in the primary score."""
    value = card_total_value(card)
    remaining = CARDS_PER_PLAYER_PER_ROUND - plays_this_round

    if difficulty == "easy":
        return value * max(remaining, 0)

    if difficulty == "hard":
        if zone in HARD_CONTESTED_ZONES:
            if value >= 5 and plays_this_round >= 2:
                return 5.0
            return 0.0
        if value >= 5:
            if plays_this_round <= 0:
                return -5.0
            if plays_this_round == 1:
                return -2.0
            return 5.0
        return (4.0 - min(value, 4.0)) * max(remaining, 0)

    return 0.0


def _computer_has_gate_locked(placements: dict, *, computer_seat: int, opponent_seat: int) -> bool:
    """Computer has won Gate or tied there—Gate -1 will not undermine our other zones."""
    gate_payload = placements.get("gate") or {"1": None, "2": None}
    winner = _zone_winner_seat(gate_payload)
    if winner == computer_seat:
        return True
    comp = _confirmed_card(gate_payload, str(computer_seat))
    opp = _confirmed_card(gate_payload, str(opponent_seat))
    return comp is not None and opp is not None and winner is None


def _preferred_beat_margin(
    *,
    placements: dict,
    computer_seat: int,
    opponent_seat: int,
    plays_this_round: int,
) -> int:
    """Win by 2 when Gate is still at risk or early in the round; win by 1 once Gate is ours."""
    if _computer_has_gate_locked(placements, computer_seat=computer_seat, opponent_seat=opponent_seat):
        return 1
    if plays_this_round <= 1:
        return 2
    return 2


def _value_margin_over_opponent(card: dict, opp_card: dict) -> int:
    return max(0, card_total_value(card) - card_total_value(opp_card))


def _winning_card_efficiency_adjustment(
    *,
    card: dict,
    opp_card: dict | None,
    winner: int | None,
    computer_seat: int,
    placements: dict,
    opponent_seat: int,
    plays_this_round: int,
    difficulty: str,
    zone: str,
    zone_payload: dict,
    card_pool: OpponentCardPool | None = None,
) -> float:
    """Pad wins when Gate is exposed; conserve cards once Gate is locked."""
    if winner != computer_seat:
        return 0.0
    value = card_total_value(card)
    if opp_card is None:
        if difficulty == "easy":
            return -value * 2.5
        contested = _contested_zones_for_difficulty(difficulty)
        if zone in contested:
            prob_beat = _prob_opponent_beats_stake(
                card=card,
                zone=zone,
                zone_payload=zone_payload,
                opponent_seat=opponent_seat,
                computer_seat=computer_seat,
                card_pool=card_pool,
            )
            tier_scale = ZONE_WIN_TIER.get(zone, 1) / 8.0
            return -(prob_beat * 25.0 * tier_scale + max(0.0, 3.5 - value) * 3.0)
        if difficulty == "hard":
            return -value * 0.6
        return -value * 1.5

    preferred = _preferred_beat_margin(
        placements=placements,
        computer_seat=computer_seat,
        opponent_seat=opponent_seat,
        plays_this_round=plays_this_round,
    )
    actual = _value_margin_over_opponent(card, opp_card)
    if actual == 0:
        if preferred == 1:
            return -value * 1.0
        return -value * 0.5

    diff = actual - preferred
    if diff == 0:
        return 4.0
    if diff > 0:
        return -diff * 5.0
    return diff * 6.0


def _weak_placement_score(card: dict, zone: str) -> float:
    return card_total_value(card) * 10.0 + EASY_ZONE_TIEBREAK.get(zone, 0)


def rank_placement_moves(
    *,
    computer_hand: list[dict],
    placements: dict,
    computer_seat: int,
    opponent_seat: int,
    computer_score: int,
    opponent_score: int,
    victory_score: int,
    zone_personas: ZonePersonas,
    difficulty: str,
    opponent_discard: list[dict] | None = None,
    opponent_hand_count: int = 0,
    opponent_deck_count: int = 0,
    computer_is_starting_player: bool = False,
) -> list[PlacementMove]:
    moves = _enumerate_placement_moves(
        computer_hand=computer_hand,
        placements=placements,
        computer_seat=computer_seat,
    )
    if not moves:
        return []

    discard = list(opponent_discard or [])
    plays_this_round = _computer_plays_this_round(placements, computer_seat=computer_seat)
    opponent_plays_this_round = _opponent_plays_this_round(placements, opponent_seat=opponent_seat)
    card_pool: OpponentCardPool | None = None
    if difficulty in ("normal", "hard"):
        card_pool = build_opponent_card_pool(
            opponent_discard=discard,
            placements=placements,
            opponent_seat=opponent_seat,
            opponent_hand_count=opponent_hand_count,
            opponent_deck_count=opponent_deck_count,
        )

    if difficulty == "easy" and random.random() < 0.4:
        random.shuffle(moves)
        return moves

    by_id = {str(c.get("card_id") or ""): c for c in computer_hand}

    if difficulty == "easy":
        scored = []
        for move in moves:
            card = by_id.get(move.card_id)
            if card is None:
                continue
            scored.append(
                (
                    _weak_placement_score(card, move.zone),
                    _card_timing_tiebreak(
                        card=card,
                        difficulty="easy",
                        plays_this_round=plays_this_round,
                    ),
                    -card_total_value(card),
                    move,
                )
            )
        scored.sort(key=lambda row: (row[0], row[1], row[2]), reverse=True)
        return [m for _, _, _, m in scored]

    scored = []
    for move in moves:
        card = by_id.get(move.card_id)
        if card is None:
            continue
        primary = _score_placement_move(
            move=move,
            card=card,
            placements=placements,
            computer_seat=computer_seat,
            opponent_seat=opponent_seat,
            computer_score=computer_score,
            opponent_score=opponent_score,
            victory_score=victory_score,
            zone_personas=zone_personas,
            difficulty=difficulty,
            opponent_discard=discard,
            plays_this_round=plays_this_round,
            card_pool=card_pool,
            computer_is_starting_player=computer_is_starting_player,
            opponent_plays_this_round=opponent_plays_this_round,
        )
        tiebreak = 0.0
        if difficulty == "hard":
            tiebreak = _card_timing_tiebreak(
                card=card,
                difficulty="hard",
                plays_this_round=plays_this_round,
                zone=move.zone,
            )
        scored.append((primary, tiebreak, -card_total_value(card), move))
    scored.sort(key=lambda row: (row[0], row[1], row[2]), reverse=True)
    return [m for _, _, _, m in scored]


def _gate_targets(placements: dict, *, actor_seat: int, target_seat: int) -> list[tuple[str, str, dict]]:
    targets: list[tuple[str, str, dict]] = []
    for zone_name, zone_payload in placements.items():
        if zone_name == "gate" or not isinstance(zone_payload, dict):
            continue
        seat_payload = zone_payload.get(str(target_seat))
        if not isinstance(seat_payload, dict):
            continue
        card = seat_payload.get("card")
        if not isinstance(card, dict) or not seat_payload.get("confirmed"):
            continue
        card_id = str(card.get("card_id") or "")
        if card_id:
            targets.append((zone_name, card_id, card))
    return targets


def _gate_debuff_outcome(
    zone_payload: dict,
    *,
    card: dict,
    target_seat: int,
) -> tuple[int | None, int | None]:
    before = _zone_winner_seat(zone_payload)
    debuffed = dict(card)
    debuffed["temporary_value_modifier"] = int(debuffed.get("temporary_value_modifier") or 0) - 1
    hypo = {
        "1": zone_payload.get("1"),
        "2": zone_payload.get("2"),
    }
    seat_payload = dict(hypo.get(str(target_seat)) or {})
    seat_payload["card"] = debuffed
    seat_payload["confirmed"] = True
    hypo[str(target_seat)] = seat_payload
    after = _zone_winner_seat(hypo)
    return before, after


def _gate_only_target_card_in_zone(zone_payload: dict, *, target_seat: int, actor_seat: int) -> bool:
    return _confirmed_card(zone_payload, str(target_seat)) is not None and _confirmed_card(
        zone_payload, str(actor_seat)
    ) is None


def _gate_needs_strategic_debuff(
    *,
    before: int | None,
    after: int | None,
    target_seat: int,
    actor_seat: int,
) -> bool:
    if before == actor_seat:
        return False
    if after == actor_seat and before != actor_seat:
        return True
    if before == target_seat and after != target_seat:
        return True
    return False


def _gate_target_score(
    *,
    placements: dict,
    zone_name: str,
    card: dict,
    target_seat: int,
    actor_seat: int,
    computer_score: int = 0,
    victory_score: int = 7,
    zone_personas: ZonePersonas | None = None,
) -> float:
    tier, bonus = _gate_debuff_goal_for_target(
        placements=placements,
        zone_name=zone_name,
        card=card,
        target_seat=target_seat,
        actor_seat=actor_seat,
        computer_score=computer_score,
        victory_score=victory_score,
    )
    if tier > 0:
        return bonus + card_total_value(card) * 0.2

    value = card_total_value(card)
    zone_payload = placements.get(zone_name) or {}
    solo_target = _gate_only_target_card_in_zone(zone_payload, target_seat=target_seat, actor_seat=actor_seat)
    rank_one = value == 1
    if solo_target and rank_one:
        return 8.0
    if solo_target:
        return 4.0 + max(0.0, 4.0 - float(value))
    if rank_one:
        return 2.0
    return float(value) * 0.2


def rank_gate_moves(
    *,
    placements: dict,
    actor_seat: int,
    target_seat: int,
    difficulty: str,
    zone_personas: ZonePersonas | None = None,
) -> list[EffectMove]:
    targets = _gate_targets(placements, actor_seat=actor_seat, target_seat=target_seat)
    if not targets:
        return []
    if difficulty == "easy":
        random.shuffle(targets)
        return [
            EffectMove(effect_type="gate_debuff", target_zone=z, target_card_id=cid)
            for z, cid, _ in targets
        ]
    scored = [
        (
            _gate_target_score(
                placements=placements,
                zone_name=z,
                card=card,
                target_seat=target_seat,
                actor_seat=actor_seat,
                zone_personas=zone_personas,
            ),
            z,
            cid,
        )
        for z, cid, card in targets
    ]
    scored.sort(key=lambda row: row[0], reverse=True)
    return [
        EffectMove(effect_type="gate_debuff", target_zone=z, target_card_id=cid)
        for _, z, cid in scored
    ]


def rank_farm_moves(*, computer_hand: list[dict], difficulty: str) -> list[EffectMove]:
    if not computer_hand:
        return []
    if difficulty == "easy":
        shuffled = list(computer_hand)
        random.shuffle(shuffled)
        return [
            EffectMove(effect_type="farm_upgrade", target_card_id=str(c.get("card_id") or ""))
            for c in shuffled
            if c.get("card_id")
        ]
    ranked = sorted(
        computer_hand,
        key=lambda c: (card_total_value(c), suit_strength(normalize_card_suit(c))),
        reverse=True,
    )
    return [
        EffectMove(effect_type="farm_upgrade", target_card_id=str(c.get("card_id") or ""))
        for c in ranked
        if c.get("card_id")
    ]


def _tower_discard_preserve_solo_suit(cards: list[dict], suit_counts: dict[str, int]) -> bool:
    if not any(n == 1 for n in suit_counts.values()) or not any(n >= 2 for n in suit_counts.values()):
        return False
    solo_values = [
        card_total_value(c)
        for c in cards
        if suit_counts.get(normalize_card_suit(c), 0) == 1
    ]
    duplicate_values = [
        card_total_value(c)
        for c in cards
        if suit_counts.get(normalize_card_suit(c), 0) >= 2
    ]
    if any(v == 1 for v in solo_values) and any(v >= 3 for v in duplicate_values):
        return False
    return True


def _tower_discard_sort_key(
    card: dict,
    suit_counts: dict[str, int],
    *,
    preserve_solo_suit: bool,
) -> tuple[int, float, int]:
    """Lowest value first; only discard a 5 when no lower card exists in hand."""
    suit = normalize_card_suit(card)
    count = suit_counts.get(suit, 0)
    value = float(card_total_value(card))
    if preserve_solo_suit and count == 1:
        return (1, value, suit_strength(suit))
    return (0, value, suit_strength(suit))


def rank_tower_moves(*, computer_hand: list[dict], difficulty: str) -> list[EffectMove]:
    cards = [c for c in computer_hand if c.get("card_id")]
    if not cards:
        return []
    suit_counts: dict[str, int] = {}
    for card in cards:
        suit = normalize_card_suit(card)
        suit_counts[suit] = suit_counts.get(suit, 0) + 1

    preserve_solo = _tower_discard_preserve_solo_suit(cards, suit_counts)

    pool = list(cards)
    if difficulty == "easy":
        random.shuffle(pool)

    ranked = sorted(
        pool,
        key=lambda c: _tower_discard_sort_key(c, suit_counts, preserve_solo_suit=preserve_solo),
    )
    return [
        EffectMove(
            effect_type="tower_discard",
            target_card_id=str(c.get("card_id") or ""),
            target_card_ids=(str(c.get("card_id") or ""),),
        )
        for c in ranked
    ]


def rank_computer_moves(
    *,
    phase: str,
    pending_action: str,
    awaiting_choice: dict | None,
    computer_hand: list[dict],
    placements: dict,
    computer_seat: int,
    opponent_seat: int,
    computer_score: int,
    opponent_score: int,
    victory_score: int,
    zone_personas: ZonePersonas,
    difficulty: str,
    opponent_discard: list[dict] | None = None,
    opponent_hand_count: int = 0,
    opponent_deck_count: int = 0,
    computer_is_starting_player: bool = False,
    persona: str | None = None,
) -> list[ComputerMove]:
    if persona and not zone_personas:
        zone_personas = normalize_zone_personas(persona)

    if phase == "placement" and pending_action == "play_card":
        return rank_placement_moves(
            computer_hand=computer_hand,
            placements=placements,
            computer_seat=computer_seat,
            opponent_seat=opponent_seat,
            computer_score=computer_score,
            opponent_score=opponent_score,
            victory_score=victory_score,
            zone_personas=zone_personas,
            difficulty=difficulty,
            opponent_discard=opponent_discard,
            opponent_hand_count=opponent_hand_count,
            opponent_deck_count=opponent_deck_count,
            computer_is_starting_player=computer_is_starting_player,
        )

    if phase != "scoring" or pending_action != "choose_effect_target" or not awaiting_choice:
        return []

    effect_type = str(awaiting_choice.get("type") or "")
    actor_seat = int(awaiting_choice.get("actor_seat") or 0)
    if actor_seat != computer_seat:
        return []

    if effect_type == "gate_debuff":
        target_seat = int(awaiting_choice.get("target_seat") or 0)
        return rank_gate_moves(
            placements=placements,
            actor_seat=actor_seat,
            target_seat=target_seat,
            difficulty=difficulty,
            zone_personas=zone_personas,
        )
    if effect_type == "farm_upgrade":
        return rank_farm_moves(computer_hand=computer_hand, difficulty=difficulty)
    if effect_type == "tower_discard":
        return rank_tower_moves(computer_hand=computer_hand, difficulty=difficulty)
    return []
