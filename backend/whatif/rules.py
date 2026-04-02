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


def two_subject_candidate_ids_duel(
    *,
    player_ids: list[int],
    subject_times: dict[str, int],
) -> list[int]:
    """Pick two distinct subjects for the challenge round; active may be included."""
    if len(player_ids) < 2:
        return player_ids[:]
    pool = list(player_ids)
    counts = {pid: int(subject_times.get(str(pid), 0)) for pid in pool}
    min_c = min(counts.values())
    tier1 = [pid for pid in pool if counts[pid] == min_c]
    if len(tier1) >= 2:
        return sorted(random.sample(tier1, 2))
    first = tier1[0]
    rest = [pid for pid in pool if pid != first]
    min_rest = min(counts[pid] for pid in rest)
    tier2 = [pid for pid in rest if counts[pid] == min_rest]
    second = random.choice(tier2)
    return sorted([first, second])


def evaluate_duel_scores(
    *,
    votes: dict[int, int],
    active_player_id: int,
    challenged_player_id: int,
) -> dict[int, int]:
    """Challenge round: same option +4 each; different -2 each (caller applies floor at DB)."""
    a = votes.get(active_player_id)
    b = votes.get(challenged_player_id)
    if a is None or b is None:
        return {}
    if a == b:
        return {active_player_id: 4, challenged_player_id: 4}
    return {active_player_id: -2, challenged_player_id: -2}


def reveal_flairs(
    *,
    total_players_in_room: int,
    votes: dict[int, int],
    round_scores: dict[int, int],
    subject_player_id: int | None,
) -> list[str]:
    """
    Return flair labels in display order: Obviously, Selfless, Splitskies, Whiff.
    Conditions use cast votes only (partial rounds after deadline).
    """
    if not votes:
        return []
    n_players = total_players_in_room
    breakdown = vote_breakdown(votes)
    values = list(votes.values())
    n_votes = len(votes)

    obviously = False
    selfless = False
    splitskies = False
    whiff = False

    if n_players >= 3 and n_votes >= 3 and len(set(values)) == 1:
        obviously = True

    if n_players >= 3 and n_votes >= 3 and len(breakdown) == n_votes:
        whiff = True

    if n_players >= 4 and len(breakdown) >= 2:
        top = max(breakdown.values()) if breakdown else 0
        if top >= 2:
            winners = [opt for opt, c in breakdown.items() if c == top]
            if len(winners) >= 2:
                splitskies = True

    if (
        n_players >= 3
        and subject_player_id is not None
        and round_scores
        and subject_player_id in round_scores
        and round_scores.get(subject_player_id, 0) <= 0
    ):
        if any(pid != subject_player_id and round_scores.get(pid, 0) > 0 for pid in round_scores):
            selfless = True
    elif (
        n_players >= 3
        and subject_player_id is not None
        and round_scores
        and subject_player_id not in round_scores
    ):
        if any(round_scores.get(pid, 0) > 0 for pid in round_scores):
            selfless = True

    out: list[str] = []
    if obviously:
        out.append("Obviously!")
    if selfless:
        out.append("Selfless!")
    if splitskies:
        out.append("Splitskies!")
    if whiff:
        out.append("Whiff!")
    return out

