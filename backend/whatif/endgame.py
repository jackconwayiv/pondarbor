"""Endgame stats, running session tallies, awards, and lifetime placement."""

from __future__ import annotations

from django.db.models import Max, Sum

from whatif.models import WhatIfGameResult, WhatIfPlayer, WhatIfSession, WhatIfSessionPlacement

FLAIR_LABELS = ("Obviously!", "Selfless!", "Splitskies!", "Whiff!")


def empty_session_tallies() -> dict:
    return {
        "rounds_completed": 0,
        "challenges_started": 0,
        "questions_vetoed": 0,
        "flairs": {label: 0 for label in FLAIR_LABELS},
    }


def empty_player_tally() -> dict:
    return {
        "rounds_scored": 0,
        "challenges_issued": 0,
        "times_challenged": 0,
        "duel_points": 0,
        "duel_rounds": 0,
    }


def current_round_number(state: dict) -> int | None:
    """1-based index of the current play round (subject pick through reveal)."""
    st = state.get("session_tallies")
    if not isinstance(st, dict):
        return None
    explicit = st.get("round_number")
    if isinstance(explicit, int) and explicit >= 1:
        return explicit
    completed = int(st.get("rounds_completed") or 0)
    if completed > 0 or state.get("question_id"):
        return completed + 1
    return None


def carry_tallies_from_prev(prev: dict) -> tuple[dict, dict]:
    """Preserve running tallies when round state is reset for a new turn."""
    st = dict(prev.get("session_tallies") or empty_session_tallies())
    flairs = dict(empty_session_tallies()["flairs"])
    flairs.update(st.get("flairs") or {})
    st["flairs"] = flairs
    pt: dict[str, dict] = {}
    for pid, tally in (prev.get("player_tallies") or {}).items():
        merged = empty_player_tally()
        if isinstance(tally, dict):
            merged.update(tally)
        pt[str(pid)] = merged
    return st, pt


def _get_player_tally(state: dict, player_id: int) -> dict:
    pt = state.setdefault("player_tallies", {})
    key = str(player_id)
    if key not in pt or not isinstance(pt[key], dict):
        pt[key] = empty_player_tally()
    return pt[key]


def record_challenge_started(state: dict, *, issuer_id: int, challenged_id: int) -> None:
    state.setdefault("session_tallies", empty_session_tallies())
    st = state["session_tallies"]
    st["challenges_started"] = int(st.get("challenges_started") or 0) + 1
    _get_player_tally(state, issuer_id)["challenges_issued"] += 1
    _get_player_tally(state, challenged_id)["times_challenged"] += 1


def record_question_vetoed(state: dict) -> None:
    state.setdefault("session_tallies", empty_session_tallies())
    st = state["session_tallies"]
    st["questions_vetoed"] = int(st.get("questions_vetoed") or 0) + 1


def record_reveal_tallies(
    state: dict,
    *,
    round_scores: dict[int, int],
    flairs: list[str],
    is_duel: bool,
) -> None:
    state.setdefault("session_tallies", empty_session_tallies())
    st = state["session_tallies"]
    st["rounds_completed"] = int(st.get("rounds_completed") or 0) + 1
    flair_counts = st.setdefault("flairs", dict(empty_session_tallies()["flairs"]))
    for flair in flairs:
        if flair in flair_counts:
            flair_counts[flair] = int(flair_counts.get(flair) or 0) + 1
    for pid, pts in round_scores.items():
        pid_int = int(pid)
        tally = _get_player_tally(state, pid_int)
        if pts > 0:
            tally["rounds_scored"] += 1
        if is_duel:
            tally["duel_rounds"] += 1
            tally["duel_points"] += int(pts)


def _players_by_id(session: WhatIfSession) -> dict[int, WhatIfPlayer]:
    return {p.id: p for p in session.players.all()}


def _award_winners(
    player_tallies: dict,
    players: dict[int, WhatIfPlayer],
    *,
    key: str,
    label: str,
    metric,
    min_value: int | float = 1,
) -> dict | None:
    entries: list[tuple[int, float, WhatIfPlayer]] = []
    for pid_str, tally in player_tallies.items():
        if not isinstance(tally, dict):
            continue
        try:
            pid = int(pid_str)
        except (TypeError, ValueError):
            continue
        player = players.get(pid)
        if player is None:
            continue
        value = metric(tally)
        if value >= min_value:
            entries.append((pid, float(value), player))
    if not entries:
        return None
    best = max(v for _, v, _ in entries)
    winners = [(pid, pl) for pid, v, pl in entries if v == best]
    return {
        "key": key,
        "label": label,
        "value": best,
        "player_ids": [pid for pid, _ in winners],
        "player_names": [pl.display_name for _, pl in winners],
    }


def compute_endgame_awards(session: WhatIfSession, state: dict) -> list[dict]:
    players = _players_by_id(session)
    pt = state.get("player_tallies") or {}
    awards: list[dict] = []

    for spec in (
        ("most_rounds_scored", "Scored in the most rounds", lambda t: int(t.get("rounds_scored") or 0)),
        ("most_challenges_issued", "Issued the most challenges", lambda t: int(t.get("challenges_issued") or 0)),
        ("most_times_challenged", "Challenged the most by others", lambda t: int(t.get("times_challenged") or 0)),
        ("most_duel_points", "Won the most points through challenges", lambda t: int(t.get("duel_points") or 0)),
    ):
        row = _award_winners(pt, players, key=spec[0], label=spec[1], metric=spec[2])
        if row:
            awards.append(row)

    conversion_entries: list[tuple[int, float, int, WhatIfPlayer]] = []
    for pid_str, tally in pt.items():
        if not isinstance(tally, dict):
            continue
        try:
            pid = int(pid_str)
        except (TypeError, ValueError):
            continue
        player = players.get(pid)
        if player is None:
            continue
        duel_rounds = int(tally.get("duel_rounds") or 0)
        duel_points = int(tally.get("duel_points") or 0)
        if duel_rounds < 1:
            continue
        conversion_entries.append((pid, duel_points / duel_rounds, duel_points, player))
    if conversion_entries:
        best_rate = max(e[1] for e in conversion_entries)
        rate_winners = [e for e in conversion_entries if e[1] == best_rate]
        top_points = max(e[2] for e in rate_winners)
        winners = [e for e in rate_winners if e[2] == top_points]
        awards.append(
            {
                "key": "best_challenge_conversion",
                "label": "Best conversion rate on challenges",
                "value": best_rate,
                "player_ids": [e[0] for e in winners],
                "player_names": [e[3].display_name for e in winners],
            }
        )

    return awards


def _collect_past_lifetime_metrics(user_id: int, exclude_session_id: int | None = None) -> dict:
    """Aggregate per-game bests and point totals from ended sessions."""
    metrics = {
        "best_score": 0,
        "best_duel_points": 0,
        "best_rounds_scored": 0,
        "best_challenges_issued": 0,
        "best_times_challenged": 0,
        "best_conversion": None,
        "total_points": 0,
        "total_rounds_scored": 0,
        "total_duel_points": 0,
        "total_challenges_issued": 0,
        "total_times_challenged": 0,
        "games_completed": 0,
    }
    past_players = WhatIfPlayer.objects.filter(
        user_id=user_id,
        session__status=WhatIfSession.Status.ENDED,
    ).select_related("session")
    if exclude_session_id is not None:
        past_players = past_players.exclude(session_id=exclude_session_id)
    for pp in past_players:
        score = int(pp.score or 0)
        metrics["games_completed"] += 1
        metrics["total_points"] += score
        metrics["best_score"] = max(metrics["best_score"], score)
        st = pp.session.state or {}
        tally = (st.get("player_tallies") or {}).get(str(pp.id)) or {}
        if not isinstance(tally, dict):
            continue
        duel_points = int(tally.get("duel_points") or 0)
        rounds_scored = int(tally.get("rounds_scored") or 0)
        challenges_issued = int(tally.get("challenges_issued") or 0)
        times_challenged = int(tally.get("times_challenged") or 0)
        metrics["total_duel_points"] += duel_points
        metrics["total_rounds_scored"] += rounds_scored
        metrics["total_challenges_issued"] += challenges_issued
        metrics["total_times_challenged"] += times_challenged
        metrics["best_duel_points"] = max(metrics["best_duel_points"], duel_points)
        metrics["best_rounds_scored"] = max(metrics["best_rounds_scored"], rounds_scored)
        metrics["best_challenges_issued"] = max(
            metrics["best_challenges_issued"],
            challenges_issued,
        )
        metrics["best_times_challenged"] = max(
            metrics["best_times_challenged"],
            times_challenged,
        )
        duel_rounds = int(tally.get("duel_rounds") or 0)
        if duel_rounds >= 1:
            rate = duel_points / duel_rounds
            prev = metrics["best_conversion"]
            if prev is None or rate > prev:
                metrics["best_conversion"] = rate
    return metrics


def _current_player_tally(state: dict, player_id: int) -> dict:
    tally = (state.get("player_tallies") or {}).get(str(player_id)) or {}
    merged = empty_player_tally()
    if isinstance(tally, dict):
        merged.update(tally)
    return merged


def _challenge_conversion_rate(tally: dict) -> float | None:
    duel_rounds = int(tally.get("duel_rounds") or 0)
    duel_points = int(tally.get("duel_points") or 0)
    if duel_rounds < 1:
        return None
    return duel_points / duel_rounds


def _format_medal_line(count: int, metal: str) -> str:
    noun = f"{metal} medal" if count == 1 else f"{metal} medals"
    return f"{count} {noun}"


def _format_conversion_rate(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def gold_medal_count_for_user(user_id: int, *, exclude_session_id: int | None = None) -> int:
    """Wins where the user's linked player row was the declared unique winner."""
    qs = WhatIfGameResult.objects.filter(winner_player__user_id=user_id)
    if exclude_session_id is not None:
        qs = qs.exclude(session_id=exclude_session_id)
    return qs.count()


def _gold_medal_count(user_id: int, *, exclude_session_id: int, is_current_winner: bool) -> int:
    count = gold_medal_count_for_user(user_id, exclude_session_id=exclude_session_id)
    if is_current_winner:
        count += 1
    return count


def _placement_medal_count(
    user_id: int,
    *,
    medal_rank: int,
    exclude_session_id: int,
    current_rank: int,
) -> int:
    count = WhatIfSessionPlacement.objects.filter(user_id=user_id, rank=medal_rank).exclude(
        session_id=exclude_session_id
    ).count()
    if current_rank == medal_rank:
        count += 1
    return count


def pick_scoreboard_lifetime_line(
    *,
    user_id: int,
    rank: int,
    current_score: int,
    current_tally: dict,
    session: WhatIfSession,
    winner_player_id: int | None,
    player_id: int,
) -> str:
    """Pick one prestigious lifetime line for an authenticated player's scoreboard row."""
    if rank == 1:
        is_winner = winner_player_id is not None and int(winner_player_id) == player_id
        return _format_medal_line(
            _gold_medal_count(user_id, exclude_session_id=session.id, is_current_winner=is_winner),
            "gold",
        )
    if rank == 2:
        return _format_medal_line(
            _placement_medal_count(
                user_id,
                medal_rank=2,
                exclude_session_id=session.id,
                current_rank=rank,
            ),
            "silver",
        )
    if rank == 3:
        return _format_medal_line(
            _placement_medal_count(
                user_id,
                medal_rank=3,
                exclude_session_id=session.id,
                current_rank=rank,
            ),
            "bronze",
        )

    past = _collect_past_lifetime_metrics(user_id, session.id)
    current_duel_points = int(current_tally.get("duel_points") or 0)
    current_rounds_scored = int(current_tally.get("rounds_scored") or 0)
    current_challenges_issued = int(current_tally.get("challenges_issued") or 0)
    current_times_challenged = int(current_tally.get("times_challenged") or 0)
    current_conversion = _challenge_conversion_rate(current_tally)

    if current_score > past["best_score"]:
        return f"New high score: {current_score} pts"

    if current_conversion is not None and (
        past["best_conversion"] is None or current_conversion > past["best_conversion"]
    ):
        return f"Best challenge rate: {_format_conversion_rate(current_conversion)} pts/challenge"

    if current_duel_points > past["best_duel_points"]:
        return f"Most challenge points: {current_duel_points}"

    if current_rounds_scored > past["best_rounds_scored"]:
        return f"Most rounds scored: {current_rounds_scored}"

    if current_challenges_issued > past["best_challenges_issued"]:
        return f"Most challenges issued: {current_challenges_issued}"

    if current_times_challenged > past["best_times_challenged"]:
        return f"Most times challenged: {current_times_challenged}"

    total_points = past["total_points"] + current_score
    return f"{total_points:,} lifetime pts"


def enrich_final_scores_with_lifetime_lines(
    session: WhatIfSession,
    rows: list[dict],
    state: dict,
) -> list[dict]:
    players = _players_by_id(session)
    winner_player_id = state.get("winner_player_id")
    winner_id = int(winner_player_id) if winner_player_id is not None else None
    enriched: list[dict] = []
    for row in rows:
        out = dict(row)
        pid = int(out["player_id"])
        player = players.get(pid)
        if player and player.user_id:
            out["lifetime_line"] = pick_scoreboard_lifetime_line(
                user_id=int(player.user_id),
                rank=int(out["rank"]),
                current_score=int(out["score"]),
                current_tally=_current_player_tally(state, pid),
                session=session,
                winner_player_id=winner_id,
                player_id=pid,
            )
        else:
            out["lifetime_line"] = None
        enriched.append(out)
    return enriched


def build_endgame_stats(session: WhatIfSession, state: dict) -> dict:
    st = state.get("session_tallies") or {}
    flairs = dict(empty_session_tallies()["flairs"])
    flairs.update(st.get("flairs") or {})
    vetoed = int(st.get("questions_vetoed") or 0)
    if vetoed == 0:
        vetoed = session.question_usages.filter(skipped_at__isnull=False).count()
    return {
        "questions_drawn": session.question_usages.count(),
        "questions_vetoed": vetoed,
        "rounds_completed": int(st.get("rounds_completed") or 0),
        "challenges_started": int(st.get("challenges_started") or 0),
        "flairs": flairs,
    }


def lifetime_stats_for_user(user_id: int, *, current_session_score: int | None = None) -> dict:
    ended_filter = {"user_id": user_id, "session__status": WhatIfSession.Status.ENDED}
    gold_medals = gold_medal_count_for_user(user_id)
    silver_medals = WhatIfSessionPlacement.objects.filter(user_id=user_id, rank=2).count()
    agg = WhatIfPlayer.objects.filter(**ended_filter).aggregate(
        total_points=Sum("score"),
        personal_best=Max("score"),
    )
    total_points = int(agg["total_points"] or 0)
    personal_best = int(agg["personal_best"] or 0)
    is_personal_best = (
        current_session_score is not None
        and current_session_score > 0
        and current_session_score >= personal_best
    )
    return {
        "gold_medals": gold_medals,
        "silver_medals": silver_medals,
        "total_points": total_points,
        "personal_best_score": personal_best,
        "is_personal_best_this_session": is_personal_best,
    }


def full_lifetime_stats_for_user(user_id: int) -> dict:
    """All lifetime stats for lobby profile (completed games only)."""
    metrics = _collect_past_lifetime_metrics(user_id)
    gold_medals = gold_medal_count_for_user(user_id)
    silver_medals = WhatIfSessionPlacement.objects.filter(user_id=user_id, rank=2).count()
    bronze_medals = WhatIfSessionPlacement.objects.filter(user_id=user_id, rank=3).count()
    out: dict = {
        "gold_medals": gold_medals,
        "silver_medals": silver_medals,
        "bronze_medals": bronze_medals,
        "games_completed": metrics["games_completed"],
        "total_points": metrics["total_points"],
        "personal_best_score": metrics["best_score"],
        "total_rounds_scored": metrics["total_rounds_scored"],
        "total_duel_points": metrics["total_duel_points"],
        "total_challenges_issued": metrics["total_challenges_issued"],
        "total_times_challenged": metrics["total_times_challenged"],
        "best_duel_points_in_game": metrics["best_duel_points"],
        "best_rounds_scored_in_game": metrics["best_rounds_scored"],
        "best_challenges_issued_in_game": metrics["best_challenges_issued"],
        "best_times_challenged_in_game": metrics["best_times_challenged"],
    }
    if metrics["best_conversion"] is not None:
        out["best_challenge_conversion"] = metrics["best_conversion"]
    return out


def record_session_placements(session: WhatIfSession, state: dict) -> None:
    from whatif.gameplay import final_scores

    rows = state.get("final_scores")
    if not rows:
        rows = final_scores(session)
    player_by_id = {p.id: p for p in session.players.all()}
    for row in rows:
        pid = int(row["player_id"])
        player = player_by_id.get(pid)
        WhatIfSessionPlacement.objects.update_or_create(
            session=session,
            player_id=pid,
            defaults={
                "user_id": player.user_id if player else None,
                "display_name": row.get("display_name") or (player.display_name if player else ""),
                "rank": int(row["rank"]),
                "score": int(row["score"]),
            },
        )


def stamp_endgame_stats(session: WhatIfSession, state: dict) -> dict:
    """Attach endgame stats and awards when a game ends."""
    from whatif.gameplay import final_scores

    out = dict(state)
    if not out.get("final_scores"):
        out["final_scores"] = final_scores(session)
    record_session_placements(session, out)
    out["endgame_stats"] = build_endgame_stats(session, out)
    out["endgame_awards"] = compute_endgame_awards(session, out)
    if out.get("final_scores"):
        out["final_scores"] = enrich_final_scores_with_lifetime_lines(
            session,
            out["final_scores"],
            out,
        )
    return out


def endgame_stats(session: WhatIfSession) -> dict:
    """Read-only endgame stats (fallback for ended sessions stamped before awards existed)."""
    state = dict(session.state or {})
    if state.get("endgame_stats"):
        return dict(state["endgame_stats"])
    return build_endgame_stats(session, state)
