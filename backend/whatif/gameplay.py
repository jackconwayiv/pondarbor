"""WhatIf session rules shared by views (reveal, deadlines, duel quorum)."""

from __future__ import annotations

from datetime import datetime, timedelta

from django.db import transaction
from django.db.models import F

from whatif import constants
from whatif.db_utils import retry_on_db_locked
from django.utils import timezone

from achievements.services import evaluate_after_whatif_session_ended
from whatif.endgame import record_reveal_tallies, stamp_endgame_stats
from whatif.models import WhatIfGameResult, WhatIfPlayer, WhatIfQuestion, WhatIfSession
from whatif.rules import (
    evaluate_duel_scores,
    evaluate_vote_scores,
    pick_winner_at_or_above_threshold,
    reveal_flairs,
    vote_breakdown,
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


def is_voting_deadline_elapsed(state: dict) -> bool:
    """True once voting_deadline_at has passed (TV shows "Time's up!"; unvote blocked).

    Returns False while the round is paused or while no deadline has been set yet
    (the deadline is only stamped once the first vote is cast).
    """
    if state.get("voting_paused"):
        return False
    dt = parse_iso_datetime(state.get("voting_deadline_at"))
    if dt is None:
        return False
    return timezone.now() >= dt


def is_voting_deadline_passed(state: dict) -> bool:
    """True only after the deadline + the configured "Time's up!" grace period."""
    if state.get("voting_paused"):
        return False
    dt = parse_iso_datetime(state.get("voting_deadline_at"))
    if dt is None:
        return False
    return timezone.now() >= dt + timedelta(seconds=constants.VOTING_TIME_UP_GRACE_SECONDS)


def restore_last_votes_for_timeout_reveal(session: WhatIfSession, state: dict) -> None:
    """Re-count last choices for players who unvoted before time ran out."""
    if votes_complete_for_round(session, state):
        return
    votes = dict(state.get("votes") or {})
    last_votes = state.get("last_votes") or {}
    changed = False
    for pid, choice in last_votes.items():
        key = str(pid)
        if key not in votes:
            votes[key] = int(choice)
            changed = True
    if not changed:
        return
    state["votes"] = votes
    normalized = {int(pid): int(choice) for pid, choice in votes.items()}
    state["vote_counts"] = vote_breakdown(normalized)
    state["voted_player_ids"] = sorted(normalized.keys())


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


def invalidate_session_player_prefetch(session: WhatIfSession) -> None:
    """Score updates use QuerySet.update(); drop cached players so serializers read fresh scores."""
    cache = getattr(session, "_prefetched_objects_cache", None)
    if cache is not None:
        cache.pop("players", None)


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
    restore_last_votes_for_timeout_reveal(session, state)

    votes = {int(pid): int(choice) for pid, choice in state.get("votes", {}).items()}
    active_player_id = int(state["active_player_id"])
    duel = state.get("duel") or {}
    subject_id = state.get("challenge_target_player_id")
    subject_npc_id = state.get("challenge_target_npc_id")

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
    invalidate_session_player_prefetch(session)
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
        subject_player_id=int(subject_id) if subject_id is not None and subject_npc_id is None else None,
    )

    state["round_scores"] = {str(pid): points for pid, points in round_scores.items()}
    state["reveal_flairs"] = flairs
    record_reveal_tallies(
        state,
        round_scores=round_scores,
        flairs=flairs,
        is_duel=duel.get("step") == "voting" and duel.get("challenged_player_id") is not None,
    )
    revealed_now = timezone.now()
    state["revealed_at"] = revealed_now.isoformat()
    state["next_turn_not_before"] = (
        revealed_now + timedelta(milliseconds=constants.SCOREBOARD_REVEAL_TOTAL_MS)
    ).isoformat()
    state["final_scores"] = final_scores(session)

    session.status = WhatIfSession.Status.POST_RESULTS
    if winner_player_id is not None:
        state["pending_winner_player_id"] = int(winner_player_id)
        state["declare_winner_not_before"] = (
            revealed_now
            + timedelta(
                milliseconds=constants.SCOREBOARD_REVEAL_TOTAL_MS
                + constants.DECLARE_WINNER_HOLD_AFTER_SCOREBOARD_MS
            )
        ).isoformat()

    session.state = state
    session.state_version = F("state_version") + 1
    session.save(update_fields=["status", "state", "state_version", "updated_at"])


def declare_pending_winner_if_due(session: WhatIfSession) -> bool:
    """Promote post_results → ended when the hold elapsed. Caller holds row lock on session."""
    if session.status != WhatIfSession.Status.POST_RESULTS:
        return False
    st = dict(session.state or {})
    if st.get("pending_winner_player_id") is None:
        return False
    not_before = parse_iso_datetime(st.get("declare_winner_not_before"))
    if not_before is None or timezone.now() < not_before:
        return False
    apply_declare_pending_winner(session)
    return True


def apply_declare_pending_winner(session: WhatIfSession) -> None:
    """Promote post_results → ended after scoreboard animation. Caller holds row lock."""
    state = dict(session.state or {})
    pending_id = state.pop("pending_winner_player_id", None)
    state.pop("declare_winner_not_before", None)
    if pending_id is None:
        return

    winner_id = int(pending_id)
    state["winner_player_id"] = winner_id
    state = stamp_endgame_stats(session, state)
    session.status = WhatIfSession.Status.ENDED
    session.state = state
    session.state_version = F("state_version") + 1
    session.save(update_fields=["status", "state", "state_version", "updated_at"])

    winner = WhatIfPlayer.objects.filter(id=winner_id, session_id=session.id).first()
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


@retry_on_db_locked(max_attempts=8, initial_delay_s=0.05, backoff=0.25)
def maybe_declare_pending_winner(session: WhatIfSession) -> WhatIfSession:
    """Apply declare-winner when the post-reveal hold elapsed (idempotent). Caller does not hold a lock."""
    version_before = session.state_version
    status_before = session.status
    if session.status != WhatIfSession.Status.POST_RESULTS:
        return session
    st = dict(session.state or {})
    if st.get("pending_winner_player_id") is None:
        return session
    not_before = parse_iso_datetime(st.get("declare_winner_not_before"))
    if not_before is None or timezone.now() < not_before:
        return session
    with transaction.atomic():
        locked = WhatIfSession.objects.select_for_update().get(id=session.id)
        if not declare_pending_winner_if_due(locked):
            return locked
    locked.refresh_from_db()
    if locked.state_version != version_before or locked.status != status_before:
        from whatif.realtime import notify_whatif_session

        notify_whatif_session(locked.short_code, state_version=locked.state_version)
    return locked


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
        "last_votes": {},
        "duel": None,
        "voting_deadline_at": None,
        "voting_paused": False,
        "voting_pause_remaining_seconds": None,
        "reveal_flairs": [],
        "round_scores": {},
    }
    state = stamp_endgame_stats(session, state)

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
