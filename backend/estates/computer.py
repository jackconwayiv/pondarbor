from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Any, Literal

from .constants import COMPUTER_PERSONAS
from .game_setup import (
    ZONE_NAMES_IN_SCORING_ORDER,
    card_total_value,
    is_suit_allowed_in_zone,
    normalize_card_suit,
    suit_strength,
)

ZoneName = Literal["gate", "farm", "road", "tower", "throne"]
EffectType = Literal["gate_debuff", "farm_upgrade", "tower_discard"]

PERSONA_ZONE_WEIGHTS: dict[str, dict[str, float]] = {
    "throne_rush": {"throne": 1.6, "farm": 1.0, "road": 0.9, "gate": 0.85, "tower": 1.0},
    "farm_builder": {"throne": 1.1, "farm": 1.6, "road": 1.0, "gate": 0.9, "tower": 0.95},
    "road_runner": {"throne": 1.0, "farm": 0.95, "road": 1.5, "gate": 0.9, "tower": 1.05},
    "gate_slasher": {"throne": 1.0, "farm": 0.9, "road": 0.95, "gate": 1.5, "tower": 1.0},
}

BASE_ZONE_WEIGHTS = {"throne": 1.4, "farm": 1.2, "road": 1.0, "gate": 0.85, "tower": 0.9}


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
    go_first: bool | None = None


ComputerMove = PlacementMove | EffectMove


def pick_random_persona() -> str:
    return random.choice(COMPUTER_PERSONAS)


def _zone_weights(persona: str) -> dict[str, float]:
    tweaks = PERSONA_ZONE_WEIGHTS.get(persona, PERSONA_ZONE_WEIGHTS["throne_rush"])
    return {zone: BASE_ZONE_WEIGHTS[zone] * tweaks.get(zone, 1.0) for zone in BASE_ZONE_WEIGHTS}


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
    persona: str,
    difficulty: str,
) -> float:
    zone = move.zone
    weights = _zone_weights(persona)
    zone_payload = placements.get(zone) or {"1": None, "2": None}
    hypo = _hypothetical_zone_payload(zone_payload, seat=computer_seat, card=card)
    winner = _zone_winner_seat(hypo)

    score = 0.0
    if winner == computer_seat:
        score += 10.0 * weights.get(zone, 1.0)
        if zone == "throne":
            if computer_score + 1 >= victory_score:
                score += 25.0
            elif opponent_score >= computer_score:
                score += 8.0
        elif zone == "farm":
            score += 6.0
        elif zone == "road":
            score += 5.0
    elif winner is None:
        score += 1.0
    else:
        score -= 3.0

    opp_card = _confirmed_card(zone_payload, str(opponent_seat))
    if opp_card is not None and winner == computer_seat:
        score += card_total_value(card) * 0.2

    suit = normalize_card_suit(card)
    if zone == "farm" and suit == "peasant":
        score += 1.5
    if zone == "throne" and suit == "royal":
        score += 2.0
    if zone == "tower" and suit in {"noble", "royal"}:
        score += 1.0

    score += card_total_value(card) * 0.15 * weights.get(zone, 1.0)

    if difficulty == "hard":
        reply_penalty = _estimate_opponent_reply_penalty(
            move=move,
            card=card,
            placements=placements,
            computer_seat=computer_seat,
            opponent_seat=opponent_seat,
            persona=persona,
        )
        score -= reply_penalty * 0.35

    return score


def _estimate_opponent_reply_penalty(
    *,
    move: PlacementMove,
    card: dict,
    placements: dict,
    computer_seat: int,
    opponent_seat: int,
    persona: str,
) -> float:
    """Fair-info: opponent hand unknown; assume they could answer in zones they have not filled."""
    penalty = 0.0
    opp_key = str(opponent_seat)
    expected_rank = 3.5
    for zone in ZONE_NAMES_IN_SCORING_ORDER:
        if zone == move.zone:
            continue
        zone_payload = placements.get(zone) or {"1": None, "2": None}
        if _confirmed_card(zone_payload, opp_key) is not None:
            continue
        if _confirmed_card(zone_payload, str(computer_seat)) is not None:
            continue
        weights = _zone_weights(persona)
        penalty += expected_rank * weights.get(zone, 1.0) * 0.5
    return penalty


def _weak_placement_score(card: dict, zone: str) -> float:
    return card_total_value(card) * 10.0 + {"throne": 3, "farm": 2, "road": 1, "tower": 1, "gate": 0}.get(zone, 0)


def rank_placement_moves(
    *,
    computer_hand: list[dict],
    placements: dict,
    computer_seat: int,
    opponent_seat: int,
    computer_score: int,
    opponent_score: int,
    victory_score: int,
    persona: str,
    difficulty: str,
) -> list[PlacementMove]:
    moves = _enumerate_placement_moves(
        computer_hand=computer_hand,
        placements=placements,
        computer_seat=computer_seat,
    )
    if not moves:
        return []

    if difficulty == "easy" and random.random() < 0.4:
        random.shuffle(moves)
        return moves

    by_id = {str(c.get("card_id") or ""): c for c in computer_hand}

    if difficulty == "easy":
        scored = [
            (_weak_placement_score(by_id[m.card_id], m.zone), m)
            for m in moves
            if m.card_id in by_id
        ]
        scored.sort(key=lambda row: row[0], reverse=True)
        return [m for _, m in scored]

    scored = []
    for move in moves:
        card = by_id.get(move.card_id)
        if card is None:
            continue
        scored.append(
            (
                _score_placement_move(
                    move=move,
                    card=card,
                    placements=placements,
                    computer_seat=computer_seat,
                    opponent_seat=opponent_seat,
                    computer_score=computer_score,
                    opponent_score=opponent_score,
                    victory_score=victory_score,
                    persona=persona,
                    difficulty=difficulty,
                ),
                move,
            )
        )
    scored.sort(key=lambda row: row[0], reverse=True)
    return [m for _, m in scored]


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
) -> float:
    zone_payload = placements.get(zone_name) or {}
    before, after = _gate_debuff_outcome(zone_payload, card=card, target_seat=target_seat)
    if before == actor_seat:
        return 0.0

    value = card_total_value(card)
    solo_target = _gate_only_target_card_in_zone(zone_payload, target_seat=target_seat, actor_seat=actor_seat)
    rank_one = value == 1

    if _gate_needs_strategic_debuff(
        before=before,
        after=after,
        target_seat=target_seat,
        actor_seat=actor_seat,
    ):
        if after == actor_seat:
            return 100.0 + value
        if before == target_seat:
            return 85.0 + value
        return 60.0 + value * 0.5

    if solo_target and rank_one:
        return 35.0
    if solo_target:
        return 18.0 + max(0.0, 4.0 - float(value))
    if rank_one:
        return 12.0
    return float(value) * 0.35


def rank_gate_moves(
    *,
    placements: dict,
    actor_seat: int,
    target_seat: int,
    difficulty: str,
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
    """Keep a lone-suit card when shedding a duplicate—unless solo is 1 and dupes are 3+."""
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
    suit = normalize_card_suit(card)
    count = suit_counts.get(suit, 0)
    if preserve_solo_suit:
        tier = 0 if count >= 2 else 1
    else:
        tier = 0
    return (tier, float(card_total_value(card)), suit_strength(suit))


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
    persona: str,
    difficulty: str,
) -> list[ComputerMove]:
    if phase == "placement" and pending_action == "play_card":
        return rank_placement_moves(
            computer_hand=computer_hand,
            placements=placements,
            computer_seat=computer_seat,
            opponent_seat=opponent_seat,
            computer_score=computer_score,
            opponent_score=opponent_score,
            victory_score=victory_score,
            persona=persona,
            difficulty=difficulty,
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
        )
    if effect_type == "farm_upgrade":
        return rank_farm_moves(computer_hand=computer_hand, difficulty=difficulty)
    if effect_type == "tower_discard":
        return rank_tower_moves(computer_hand=computer_hand, difficulty=difficulty)
    return []
