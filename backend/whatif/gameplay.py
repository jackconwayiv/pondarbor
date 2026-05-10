"""WhatIf session rules shared by views (reveal, deadlines, duel quorum)."""

from __future__ import annotations

from datetime import datetime, timedelta

from django.db.models import F
from django.utils import timezone

from achievements.services import evaluate_after_whatif_session_ended
from whatif import constants
from whatif.models import WhatIfGameResult, WhatIfPlayer, WhatIfQuestion, WhatIfSession
from whatif.rules import (
    evaluate_duel_scores,
    evaluate_vote_scores,
    pick_winner_at_or_above_threshold,
    reveal_flairs,
)


def parse_iso_datetime(raw: str | None):
    if not raw or not isinstance(raw, str):
        return None
    try:
        dt = datetime.fromisoformat(raw)
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt)
        return dt
    except ValueError:
        return None


def is_voting_deadline_passed(state: dict) -> bool:
    """True only after the deadline + the configured "Time's up!" grace period.

    Returns False while the round is paused or while no deadline has been set yet
    (the deadline is only stamped once the first vote is cast).
    """
    if state.get("voting_paused"):
        return False
    dt = parse_iso_datetime(state.get("voting_deadline_at"))
    if dt is None:
        return False
    return timezone.now() >= dt + timedelta(seconds=constants.VOTING_TIME_UP_GRACE_SECONDS)


def votes_complete_for_round(session: WhatIfSession, state: dict) -> bool:
    votes = state.get("votes", {})
    voted = {int(k) for k in votes.keys()}
    duel = state.get("duel") or {}
    if duel.get("step") == "voting" and duel.get("challenged_player_id"):
        ap = state.get("active_player_id")
        ch = duel.get("challenged_player_id")
        for pid in (ap, ch):
            if pid is None:
                continue
            pl = session.players.filter(id=int(pid)).first()
            if pl and not pl.paused and int(pid) not in voted:
                return False
        return True
    eligible = [p.id for p in session.players.all() if not p.paused]
    if not eligible:
        return True
    return all(pid in voted for pid in eligible)


def can_reveal_now(session: WhatIfSession, state: dict) -> bool:
    if session.status != WhatIfSession.Status.VOTING:
        return False
    if votes_complete_for_round(session, state):
        return True
    return is_voting_deadline_passed(state)


def pause_blocked_for_duel(session: WhatIfSession, state: dict, target_id: int) -> bool:
    duel = state.get("duel") or {}
    ch = duel.get("challenged_player_id")
    ap = state.get("active_player_id")
    if ap is None:
        return False
    tid = int(target_id)
    st = session.status
    step = duel.get("step")
    if ch and step in ("pick_subject", "voting"):
        if tid in (int(ap), int(ch)):
            return st in (
                WhatIfSession.Status.TURN,
                WhatIfSession.Status.VOTING,
            )
    if ch and st == WhatIfSession.Status.POST_RESULTS:
        return tid in (int(ap), int(ch))
    return False


def final_scores(session: WhatIfSession) -> list[dict]:
    from users.models import Profile

    players = list(
        WhatIfPlayer.objects.filter(session_id=session.id).order_by("-score", "created_at", "id")
    )
    user_ids = sorted({p.user_id for p in players if p.user_id})
    avatar_by_uid: dict[int, str] = {}
    if user_ids:
        for row in Profile.objects.filter(user_id__in=user_ids).values("user_id", "avatar_url"):
            url = (row.get("avatar_url") or "").strip()
            if url:
                avatar_by_uid[int(row["user_id"])] = url
    # Competition ranking: tied scores share the same rank; next rank skips (e.g. 1,2,2,4,4,6).
    rows: list[dict] = []
    for i, p in enumerate(players):
        if i == 0:
            rank = 1
        elif p.score == players[i - 1].score:
            rank = rows[-1]["rank"]
        else:
            rank = i + 1
        rows.append(
            {
                "player_id": p.id,
                "display_name": p.display_name,
                "avatar_emoji": p.avatar_emoji,
                "avatar_url": avatar_by_uid.get(int(p.user_id), "") if p.user_id else "",
                "score": p.score,
                "rank": rank,
            }
        )
    return rows


def mark_whatif_completion_for_session_users(session_id: int) -> None:
    from users.models import Profile

    user_ids = list(
        WhatIfPlayer.objects.filter(session_id=session_id, user_id__isnull=False).values_list(
            "user_id", flat=True
        )
    )
    if user_ids:
        Profile.objects.filter(user_id__in=user_ids).update(whatif_completed_session=True)


def apply_reveal_from_voting_state(
    session: WhatIfSession,
    state: dict,
) -> None:
    """Mutate `state` and DB; caller holds row lock on session."""
    state.pop("pending_question_skip_by_player_id", None)
    state.pop("skip_ui_suppressed_for_question_id", None)

    votes = {int(pid): int(choice) for pid, choice in state.get("votes", {}).items()}
    active_player_id = int(state["active_player_id"])
    duel = state.get("duel") or {}
    subject_id = state.get("challenge_target_player_id")

    if duel.get("step") == "voting" and duel.get("challenged_player_id"):
        challenged_id = int(duel["challenged_player_id"])
        round_scores = evaluate_duel_scores(
            votes=votes,
            active_player_id=active_player_id,
            challenged_player_id=challenged_id,
        )
        for pid, delta in round_scores.items():
            pl = WhatIfPlayer.objects.select_for_update().get(id=pid)
            pl.score = max(0, pl.score + delta)
            pl.save(update_fields=["score", "updated_at"])
    else:
        round_scores = evaluate_vote_scores(
            active_player_id=active_player_id,
            votes=votes,
        )
        if round_scores:
            for player_id, points in round_scores.items():
                WhatIfPlayer.objects.filter(id=player_id).update(score=F("score") + points)

    question_id = state.get("question_id")
    if question_id:
        WhatIfQuestion.objects.filter(id=question_id).update(
            total_scores=F("total_scores") + len(round_scores)
        )

    session.refresh_from_db()
    score_map = dict(
        WhatIfPlayer.objects.filter(session_id=session.id).values_list("id", "score")
    )
    winner_player_id = pick_winner_at_or_above_threshold(score_map)

    rs_for_flair = {int(k): v for k, v in round_scores.items()}
    total_players = session.players.count()
    flairs = reveal_flairs(
        total_players_in_room=total_players,
        votes=votes,
        round_scores=rs_for_flair,
        subject_player_id=int(subject_id) if subject_id is not None else None,
    )

    state["round_scores"] = {str(pid): points for pid, points in round_scores.items()}
    state["reveal_flairs"] = flairs
    state["revealed_at"] = timezone.now().isoformat()
    state["next_turn_not_before"] = (
        timezone.now() + timedelta(seconds=constants.ROUND_TRANSITION_SECONDS)
    ).isoformat()
    state["final_scores"] = final_scores(session)

    session.status = WhatIfSession.Status.POST_RESULTS
    if winner_player_id is not None:
        session.status = WhatIfSession.Status.ENDED
        winner = session.players.filter(id=winner_player_id).first()
        if winner is not None:
            WhatIfGameResult.objects.update_or_create(
                session=session,
                defaults={
                    "winner_player": winner,
                    "winner_user": winner.user,
                    "winner_display_name": winner.display_name,
                },
            )
            state["winner_player_id"] = winner.id
        mark_whatif_completion_for_session_users(session.id)

    session.state = state
    session.state_version = F("state_version") + 1
    session.save(update_fields=["status", "state", "state_version", "updated_at"])

    if session.status == WhatIfSession.Status.ENDED:
        evaluate_after_whatif_session_ended(session.id)


def apply_host_complete_game(session: WhatIfSession) -> None:
    """Host ends the session early; placements from current DB scores. Caller holds row lock."""
    prev = dict(session.state or {})
    fs = final_scores(session)
    leaders = [row["player_id"] for row in fs if row["rank"] == 1]
    winner_id = leaders[0] if len(leaders) == 1 else None

    state = {
        **prev,
        "final_scores": fs,
        "ended_reason": "host_ended",
        "winner_player_id": winner_id,
        "votes": {},
        "vote_counts": {},
        "voted_player_ids": [],
        "duel": None,
        "voting_deadline_at": None,
        "voting_paused": False,
        "voting_pause_remaining_seconds": None,
        "reveal_flairs": [],
        "round_scores": {},
    }

    session.status = WhatIfSession.Status.ENDED
    session.state = state
    session.state_version = F("state_version") + 1
    session.save(update_fields=["status", "state", "state_version", "updated_at"])
    session.refresh_from_db()

    if winner_id is not None:
        winner = session.players.filter(id=winner_id).first()
        if winner is not None:
            WhatIfGameResult.objects.update_or_create(
                session=session,
                defaults={
                    "winner_player": winner,
                    "winner_user": winner.user,
                    "winner_display_name": winner.display_name,
                },
            )

    mark_whatif_completion_for_session_users(session.id)
    evaluate_after_whatif_session_ended(session.id)
