"""Circular subject seat board: interleaved players/NPCs + Challenge (3+ humans), die roll."""

from __future__ import annotations

import random
from typing import Literal, Optional

from whatif import constants

RingSlot = tuple[Literal["player", "npc"], int]


def build_ring_layout(player_ids: list[int], npc_ids: list[int]) -> list[RingSlot]:
    """Players in join order; NPCs distributed evenly in gaps between consecutive humans."""
    p = len(player_ids)
    n = len(npc_ids)
    if n == 0:
        return [("player", pid) for pid in player_ids]
    if p == 0:
        return []
    if n <= p:
        gap_counts = [0] * p
        for k in range(n):
            gap_idx = min(p - 1, int((k + 0.5) * p / n))
            gap_counts[gap_idx] += 1
    else:
        gap_counts = [(n * (i + 1)) // p - (n * i) // p for i in range(p)]
    layout: list[RingSlot] = []
    npc_i = 0
    for i in range(p):
        layout.append(("player", player_ids[i]))
        for _ in range(gap_counts[i]):
            layout.append(("npc", npc_ids[npc_i]))
            npc_i += 1
    return layout


def ring_entity_count(num_players: int, num_npcs: int) -> int:
    return num_players + num_npcs


def subject_board_seat_count(num_players: int, num_ring_entities: int | None = None) -> int:
    """L = ring slots E, or E+1 when P>=3 (Challenge at L-1)."""
    e = num_ring_entities if num_ring_entities is not None else num_players
    if e <= 0:
        return 0
    if e == 2 and num_players == 2:
        return 2
    if num_players >= 3:
        return e + 1
    return e


def default_marker_index(num_players: int, num_ring_entities: int | None = None) -> int:
    """Challenge wedge when the board has one; else first ring slot (join-order player)."""
    e = num_ring_entities if num_ring_entities is not None else num_players
    ch = challenge_seat_index(num_players, e)
    if ch is not None:
        return ch
    return 0


def challenge_seat_index(num_players: int, num_ring_entities: int) -> int | None:
    """Physical index of Challenge wedge, or None when absent."""
    l_seats = subject_board_seat_count(num_players, num_ring_entities)
    e = num_ring_entities
    if num_players >= 3 and l_seats == e + 1:
        return l_seats - 1
    return None


def is_challenge_seat(
    seat_index: int,
    seat_count: int,
    num_players: int,
    num_ring_entities: int | None = None,
) -> bool:
    e = num_ring_entities if num_ring_entities is not None else num_players
    return num_players >= 3 and seat_count == e + 1 and seat_index == seat_count - 1


def candidate_seats(marker: int, step: int, seat_count: int) -> tuple[int, int]:
    """Two landing seats: (marker - step) % L and (marker + step) % L."""
    l_seats = seat_count
    a = (marker - step) % l_seats
    b = (marker + step) % l_seats
    return a, b


def subject_pick_is_degenerate(seat_a: int, seat_b: int) -> bool:
    return seat_a == seat_b


def seat_occupant_at(
    layout: list[RingSlot],
    physical_index: int,
    seat_count: int,
    num_players: int,
) -> RingSlot | None:
    """Occupant at physical ring index; None for Challenge or out of range."""
    e = len(layout)
    if physical_index < 0 or physical_index >= seat_count:
        return None
    if is_challenge_seat(physical_index, seat_count, num_players, e):
        return None
    if physical_index >= e:
        return None
    return layout[physical_index]


def roll_subject_die(
    marker: int,
    forbidden_seat: Optional[int],
    seat_count: int,
    num_players: int,
    *,
    max_attempts: int = 96,
    exclude_seats: frozenset[int] | None = None,
) -> tuple[int, int, int]:
    """
    Roll step N in 1..6 until at least one candidate seat is not forbidden/excluded.
    num_players is used for validation and challenge geometry only.
    """
    die_faces = constants.SUBJECT_DIE_FACES
    l_seats = seat_count
    if num_players < 1 or l_seats < 1:
        raise ValueError("invalid board size")
    excluded = exclude_seats or frozenset()

    for _ in range(max_attempts):
        n = random.randint(1, die_faces)
        a, b = candidate_seats(marker, n, l_seats)

        def seat_ok(seat: int) -> bool:
            if seat in excluded:
                return False
            if forbidden_seat is not None and seat == forbidden_seat:
                return False
            return True

        if a == b:
            if seat_ok(a):
                return n, a, b
        elif seat_ok(a) or seat_ok(b):
            return n, a, b
    n = 1
    a, b = candidate_seats(marker, n, l_seats)
    return n, a, b


def player_id_at_seat(
    ordered_player_ids: list[int],
    seat_index: int,
    seat_count: int,
    npc_ids: list[int] | None = None,
) -> int | None:
    """Legacy helper; returns player id at physical seat or None."""
    npc_ids = npc_ids or []
    layout = build_ring_layout(ordered_player_ids, npc_ids)
    p = len(ordered_player_ids)
    occ = seat_occupant_at(layout, seat_index, seat_count, p)
    if occ is not None and occ[0] == "player":
        return occ[1]
    return None


# --- Legacy duel walk (kept for unit tests; duel subject uses roll_subject_die) ---


def advance_one_player_step(from_seat: int, delta: int, seat_count: int, num_players: int) -> int:
    """Move one step along the physical ring; Challenge is not a stopping place (slide through)."""
    l_seats = seat_count
    p = num_players
    pos = (from_seat + delta) % l_seats
    while is_challenge_seat(pos, l_seats, p):
        pos = (pos + delta) % l_seats
    return pos


def duel_subject_candidate_seats(marker: int, step: int, seat_count: int, num_players: int) -> tuple[int, int]:
    l_seats = seat_count
    p = num_players
    if step < 0:
        raise ValueError("step must be non-negative")

    def walk(delta_sign: int) -> int:
        pos = marker
        for _ in range(step):
            pos = advance_one_player_step(pos, delta_sign, l_seats, p)
        return pos

    return walk(-1), walk(+1)


def roll_subject_die_duel_subject(
    marker: int,
    forbidden_seat: Optional[int],
    seat_count: int,
    num_players: int,
    *,
    max_attempts: int = 96,
) -> tuple[int, int, int]:
    """Legacy: player-only walk. Production duel-subject uses roll_subject_die."""
    die_faces = constants.SUBJECT_DIE_FACES
    l_seats = seat_count
    p = num_players
    if p < 1 or l_seats < 1:
        raise ValueError("invalid board size")

    for _ in range(max_attempts):
        n = random.randint(1, die_faces)
        a, b = duel_subject_candidate_seats(marker, n, l_seats, p)
        if forbidden_seat is None:
            return n, a, b
        if a != b:
            if a != forbidden_seat or b != forbidden_seat:
                return n, a, b
        else:
            if a != forbidden_seat:
                return n, a, b
    n = 1
    a, b = duel_subject_candidate_seats(marker, n, l_seats, p)
    return n, a, b
