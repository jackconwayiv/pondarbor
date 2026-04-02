import os
import random
from collections import Counter


WIN_SCORE = int(os.getenv("WHATIF_WIN_SCORE", "25"))


def two_subject_candidate_ids(
    *,
    player_ids: list[int],
    active_player_id: int,
    subject_times: dict[str, int],
) -> list[int]:
    """
    Pick two players the active player may choose between as round subject.

    With exactly two players in the game, both participants are always the two options
    (the active player may pick either person, including themself).

    With three or more players, choose two distinct non-active players, preferring those
    who have been subject the fewest times this session (subject_times); the active player
    is excluded from that fairness pool.
    """
    if len(player_ids) == 2:
        return sorted(player_ids)

    pool = [pid for pid in player_ids if pid != active_player_id]
    if len(pool) == 0:
        return []
    counts = {pid: int(subject_times.get(str(pid), 0)) for pid in pool}
    min_c = min(counts.values())
    eligible = [pid for pid in pool if counts[pid] == min_c]
    if len(eligible) >= 2:
        return random.sample(eligible, 2)
    # One player in the lowest tier — take second from the rest of the pool (next-lowest tier).
    first = eligible[0]
    rest = [pid for pid in pool if pid != first]
    if not rest:
        return [first]
    min_rest = min(counts[pid] for pid in rest)
    tier2 = [pid for pid in rest if counts[pid] == min_rest]
    second = random.choice(tier2)
    return [first, second]


def evaluate_vote_scores(
    *,
    active_player_id: int,
    votes: dict[int, int],
) -> dict[int, int]:
    """
    Plurality scoring with ties:
    - Every voter who picked a top-vote option gets +1.
    - If the active player is among scorers, they get +1 extra.
    """
    if not votes:
        return {}
    breakdown = vote_breakdown(votes)
    top_votes = max(breakdown.values()) if breakdown else 0
    # New rule: a lone vote cannot score, even if it's in the top tier.
    if top_votes < 2:
        return {}
    winning_options = {opt for opt, count in breakdown.items() if count == top_votes}
    scores: dict[int, int] = {}
    for player_id, choice in votes.items():
        if choice not in winning_options:
            continue
        scores[player_id] = scores.get(player_id, 0) + 1
    if scores.get(active_player_id):
        scores[active_player_id] = scores.get(active_player_id, 0) + 1
    return scores


def vote_breakdown(votes: dict[int, int]) -> dict[int, int]:
    counts: Counter[int] = Counter(votes.values())
    return dict(counts)


def pick_winner_at_or_above_threshold(score_by_player: dict[int, int]) -> int | None:
    """Return winner id only when exactly one top score exists among >= WIN_SCORE."""
    eligible = {pid: score for pid, score in score_by_player.items() if score >= WIN_SCORE}
    if not eligible:
        return None
    top_score = max(eligible.values())
    top_players = [pid for pid, score in eligible.items() if score == top_score]
    return top_players[0] if len(top_players) == 1 else None

