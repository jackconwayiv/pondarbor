"""Circular subject seat board: join-order player seats + Challenge (3+), die roll, candidates."""

from __future__ import annotations

import random
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    pass


def subject_board_seat_count(num_players: int) -> int:
    """L = P (2 players) or P + 1 (3+ includes Challenge at index L-1)."""
    if num_players <= 0:
        return 0
    if num_players == 2:
        return 2
    return num_players + 1


def default_marker_index(num_players: int) -> int:
    """Round-1 marker: Challenge seat for 3+, else first player seat (2p)."""
    if num_players >= 3:
        return subject_board_seat_count(num_players) - 1
    return 0


def candidate_seats(marker: int, step: int, seat_count: int) -> tuple[int, int]:
    """Two landing seats: (marker - step) % L and (marker + step) % L."""
    L = seat_count
    a = (marker - step) % L
    b = (marker + step) % L
    return a, b


def subject_pick_is_degenerate(seat_a: int, seat_b: int) -> bool:
    return seat_a == seat_b


def advance_one_player_step(from_seat: int, delta: int, seat_count: int, num_players: int) -> int:
    """Move one step along the physical ring; Challenge is not a stopping place (slide through)."""
    L = seat_count
    P = num_players
    pos = (from_seat + delta) % L
    while is_challenge_seat(pos, L, P):
        pos = (pos + delta) % L
    return pos


def duel_subject_candidate_seats(marker: int, step: int, seat_count: int, num_players: int) -> tuple[int, int]:
    """
    Duel subject phase: N steps counterclockwise and clockwise from marker, skipping Challenge
    as a landing seat (same geometry as candidate_seats but Challenge is traversed, never chosen).
    Matches legacy directions: seat_a toward (marker - step) on the full ring, seat_b toward (marker + step).
    """
    L = seat_count
    P = num_players
    if step < 0:
        raise ValueError("step must be non-negative")

    def walk(delta_sign: int) -> int:
        pos = marker
        for _ in range(step):
            pos = advance_one_player_step(pos, delta_sign, L, P)
        return pos

    seat_a = walk(-1)
    seat_b = walk(+1)
    return seat_a, seat_b


def roll_subject_die_duel_subject(
    marker: int,
    forbidden_seat: Optional[int],
    seat_count: int,
    num_players: int,
    *,
    max_attempts: int = 96,
) -> tuple[int, int, int]:
    """
    Roll N then compute duel subject endpoints (player seats only; Challenge skipped while stepping).
    Same forbidden-seat contract as roll_subject_die.
    """
    P = num_players
    die_faces = min(P, 6)
    L = seat_count
    if P < 1 or L < 1:
        raise ValueError("invalid board size")

    for _ in range(max_attempts):
        n = random.randint(1, die_faces)
        a, b = duel_subject_candidate_seats(marker, n, L, P)
        if forbidden_seat is None:
            return n, a, b
        if a != b:
            if a != forbidden_seat or b != forbidden_seat:
                return n, a, b
        else:
            if a != forbidden_seat:
                return n, a, b
    n = 1
    a, b = duel_subject_candidate_seats(marker, n, L, P)
    return n, a, b


def roll_subject_die(
    marker: int,
    forbidden_seat: Optional[int],
    seat_count: int,
    num_players: int,
    *,
    max_attempts: int = 96,
) -> tuple[int, int, int]:
    """
    Roll step N in 1..min(P, 6) until at least one candidate seat is not the forbidden seat
    (when forbidden is set). If degenerate (a==b) and that seat is forbidden, re-roll.

    Returns (N, seat_a, seat_b).
    """
    P = num_players
    die_faces = min(P, 6)
    L = seat_count
    if P < 1 or L < 1:
        raise ValueError("invalid board size")

    for _ in range(max_attempts):
        n = random.randint(1, die_faces)
        a, b = candidate_seats(marker, n, L)
        if forbidden_seat is None:
            return n, a, b
        if a != b:
            if a != forbidden_seat or b != forbidden_seat:
                return n, a, b
        else:
            if a != forbidden_seat:
                return n, a, b
    # Extremely unlikely; deterministic fallback
    n = 1
    a, b = candidate_seats(marker, n, L)
    return n, a, b


def player_id_at_seat(ordered_player_ids: list[int], seat_index: int, seat_count: int) -> int | None:
    """Seat indices 0..P-1 are players in join order; last seat is Challenge when L = P + 1."""
    p = len(ordered_player_ids)
    if seat_index < 0 or seat_index >= seat_count or p == 0:
        return None
    if seat_count == p:
        return ordered_player_ids[seat_index]
    if seat_count == p + 1 and seat_index == seat_count - 1:
        return None
    if seat_index < p:
        return ordered_player_ids[seat_index]
    return None


def is_challenge_seat(seat_index: int, seat_count: int, num_players: int) -> bool:
    return num_players >= 3 and seat_count == num_players + 1 and seat_index == seat_count - 1
