import random
import re
import string
from datetime import datetime, timedelta

from django.db import transaction
from django.db.models import F, Prefetch, Q
from django.core.exceptions import ObjectDoesNotExist
from django.shortcuts import get_object_or_404
from django.utils import timezone
from achievements.services import (
    evaluate_after_whatif_session_ended,
    evaluate_whatif_dece_proposer_for_user,
)
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsApprovedUser

from whatif import constants
from whatif.db_utils import retry_on_db_locked
from whatif.endgame import (
    carry_tallies_from_prev,
    current_round_number,
    endgame_stats,
    enrich_final_scores_with_lifetime_lines,
    lifetime_stats_for_user,
    record_challenge_started,
    record_question_vetoed,
    stamp_endgame_stats,
)
from whatif.gameplay import (
    apply_host_complete_game,
    apply_reveal_from_voting_state,
    can_reveal_now,
    final_scores,
    is_voting_deadline_elapsed,
    is_voting_deadline_passed,
    mark_whatif_completion_for_session_users,
    declare_pending_winner_if_due,
    maybe_declare_pending_winner,
    parse_iso_datetime,
    pause_blocked_for_duel,
    votes_complete_for_round,
)
from whatif.models import (
    WhatIfNpc,
    WhatIfPlayer,
    WhatIfQuestion,
    WhatIfQuestionSession,
    WhatIfSession,
)
from whatif.rules import vote_breakdown
from whatif.subject_board import (
    build_ring_layout,
    challenge_seat_index,
    default_marker_index,
    is_challenge_seat,
    roll_subject_die,
    roll_subject_die_duel_subject,  # re-exported for tests that patch views.roll_subject_die_duel_subject
    seat_occupant_at,
    subject_board_seat_count,
    subject_pick_is_degenerate,
)
from whatif.realtime import notify_whatif_session
from whatif.session_queries import (
    display_name_taken as _display_name_taken,
    entity_count as _whatif_entity_count,
    find_npc_by_id as _find_npc_by_id,
    find_player_by_id as _find_player_by_id,
    find_player_by_token as _find_player_by_token,
    load_session_locked as _load_session_locked,
    load_session_read as _load_session,
    npcs_ordered as _npcs_ordered,
    players_ordered as _players_ordered,
    reload_session_with_prefetch as _reload_session_with_prefetch,
)
from whatif.serializers import (
    JoinSessionSerializer,
    SessionActionSerializer,
    WhatIfNpcSerializer,
    WhatIfQuestionAdminSerializer,
    WhatIfQuestionProposeSerializer,
    WhatIfPlayerSerializer,
    WhatIfQuestionPublicSerializer,
    WhatIfSessionPublicSerializer,
    whatif_players_serializer_context,
)
from whatif.validators import validate_display_name

AVATAR_EMOJIS = [
    "🦊",
    "🐻",
    "🐼",
    "🐸",
    "🦉",
    "🐧",
    "🐙",
    "🦁",
    "🐯",
    "🐢",
    "🐠",
    "🐟",
    "🦈",
    "🐍",
    "🦦",
    "🐌",
    "🐹",
    "🦀",
    "🐞",
    "🐝",
    "🦆",
    "🦢",
    "🦩",
    "🦜",
    "🐷",
    "🐴",
    "🐺",
    "🐮",
]


def _pick_avatar_emoji(session: WhatIfSession) -> str:
    """Pick an emoji not yet used in this session (players + NPCs; unique while pool allows)."""
    used = {p.avatar_emoji for p in _players_ordered(session)}
    used.update(n.avatar_emoji for n in _npcs_ordered(session))
    available = [e for e in AVATAR_EMOJIS if e not in used]
    if available:
        return random.choice(available)
    return random.choice(AVATAR_EMOJIS)


def _session_ring_context(session: WhatIfSession) -> tuple[list[int], list[int], list, int, int, int]:
    """player_ids, npc_ids, layout, P, E, L"""
    rows = _players_ordered(session)
    npc_rows = _npcs_ordered(session)
    player_ids = [p.id for p in rows]
    npc_ids = [n.id for n in npc_rows]
    layout = build_ring_layout(player_ids, npc_ids)
    p = len(player_ids)
    e = len(layout)
    l_seats = subject_board_seat_count(p, e)
    return player_ids, npc_ids, layout, p, e, l_seats


def _has_challenge_target(state: dict) -> bool:
    return state.get("challenge_target_player_id") is not None or state.get(
        "challenge_target_npc_id"
    ) is not None


def _subject_die_state_for_session(session: WhatIfSession, prev: dict, *, duel_pick_subject: bool) -> dict:
    player_ids, _npc_ids, _layout, p_count, e_count, l_seats = _session_ring_context(session)
    if p_count == 0:
        return {
            "subject_candidate_ids": [],
            "subject_options": [],
        }
    marker_raw = prev.get("marker_index")
    if marker_raw is None:
        marker = default_marker_index(p_count, e_count)
    else:
        marker = max(0, min(int(marker_raw), l_seats - 1))
    forbidden = prev.get("last_subject_seat_index")
    forbidden_i = int(forbidden) if forbidden is not None else None
    exclude: frozenset[int] = frozenset()
    if duel_pick_subject:
        ch = challenge_seat_index(p_count, e_count)
        if ch is not None:
            exclude = frozenset({ch})
    n, a, b = 1, 0, 0
    for _ in range(96):
        n, a, b = roll_subject_die(
            marker, forbidden_i, l_seats, p_count, exclude_seats=exclude
        )
        if not subject_pick_is_degenerate(a, b):
            break
    return {
        "marker_index": marker,
        "last_subject_seat_index": prev.get("last_subject_seat_index"),
        "subject_die_value": n,
        "subject_candidate_seat_a": a,
        "subject_candidate_seat_b": b,
        "subject_pick_degenerate": subject_pick_is_degenerate(a, b),
        "subject_candidate_ids": [],
        "subject_options": [],
    }


def _generate_short_code() -> str:
    alphabet = string.ascii_uppercase
    for _ in range(40):
        code = "".join(random.choice(alphabet) for _ in range(4))
        if not WhatIfSession.objects.filter(short_code=code).exists():
            return code
    raise RuntimeError("Unable to generate unique room code.")


def _find_player_for_request(session: WhatIfSession, request) -> WhatIfPlayer | None:
    return _find_player_by_token(
        session, request.headers.get("X-Whatif-Player-Token", "")
    )


def _question_for_round(state: dict) -> WhatIfQuestion | None:
    question_id = state.get("question_id")
    if not question_id:
        return None
    return WhatIfQuestion.objects.filter(id=question_id).first()


def _draw_question(session: WhatIfSession) -> WhatIfQuestion | None:
    used_ids = session.question_usages.values_list("question_id", flat=True)
    pool = (
        WhatIfQuestion.objects.filter(
            is_active=True,
            review_status=WhatIfQuestion.ReviewStatus.APPROVED,
            deleted_at__isnull=True,
        )
        .exclude(id__in=used_ids)
    )
    min_used = pool.order_by("sessions_used_count").values_list("sessions_used_count", flat=True).first()
    if min_used is None:
        return None
    question = pool.filter(sessions_used_count=min_used).order_by("?").first()
    if question is None:
        return None
    WhatIfQuestionSession.objects.create(question=question, session=session)
    WhatIfQuestion.objects.filter(id=question.id).update(sessions_used_count=F("sessions_used_count") + 1)
    return question


def _player_ids_in_turn_order(session: WhatIfSession) -> list[int]:
    return [p.id for p in _players_ordered(session)]


def _next_turn_player_id(session: WhatIfSession, state: dict) -> int | None:
    """Next player in join order who is not paused; None if every player is paused."""
    ordered = _player_ids_in_turn_order(session)
    if not ordered:
        return None
    pause_map = {p.id: p.paused for p in _players_ordered(session)}
    current_id = state.get("active_player_id")
    if current_id not in ordered:
        start_idx = 0
    else:
        start_idx = (ordered.index(current_id) + 1) % len(ordered)
    for step in range(len(ordered)):
        idx = (start_idx + step) % len(ordered)
        pid = ordered[idx]
        if not pause_map.get(pid, False):
            return pid
    return None


def _render_question_prompt(question: WhatIfQuestion, *, subject_name: str) -> str:
    if "{subject}" not in question.prompt:
        # Backward-compatible fallback for legacy prompts without token.
        # Recommended format remains: "What if {subject} ..."
        return f"What if {subject_name}: {question.prompt.strip()}"
    return question.prompt.replace("{subject}", subject_name)


def _strip_subject_die_keys(state: dict) -> None:
    for k in (
        "subject_die_value",
        "subject_candidate_seat_a",
        "subject_candidate_seat_b",
        "subject_pick_degenerate",
    ):
        state.pop(k, None)


def _subject_die_state_for_turn(session: WhatIfSession, prev: dict) -> dict:
    """Fresh die roll + markers for a new TURN (subject not yet chosen)."""
    return _subject_die_state_for_session(session, prev, duel_pick_subject=False)


def _subject_die_state_for_duel_subject_turn(session: WhatIfSession, prev: dict) -> dict:
    """Fresh die roll for duel-subject pick (same geometry as normal; excludes Challenge wedge)."""
    return _subject_die_state_for_session(session, prev, duel_pick_subject=True)


def _maybe_auto_reveal_voting(session: WhatIfSession) -> WhatIfSession:
    """Apply reveal when the voting deadline passed (idempotent). Caller does not hold a lock."""
    version_before = session.state_version
    status_before = session.status
    if session.status != WhatIfSession.Status.VOTING:
        return session
    st = dict(session.state or {})
    if not is_voting_deadline_passed(st):
        return session
    with transaction.atomic():
        locked = WhatIfSession.objects.select_for_update().get(id=session.id)
        if locked.status != WhatIfSession.Status.VOTING:
            return locked
        st2 = dict(locked.state or {})
        if not is_voting_deadline_passed(st2):
            return locked
        if not can_reveal_now(locked, st2):
            return locked
        apply_reveal_from_voting_state(locked, st2)
    locked.refresh_from_db()
    if locked.state_version != version_before or locked.status != status_before:
        notify_whatif_session(locked.short_code, state_version=locked.state_version)
    return locked


def _setup_turn(session: WhatIfSession, *, next_player_id: int) -> bool:
    prev = dict(session.state or {})
    subject_times = dict(prev.get("subject_times") or {})

    question = _draw_question(session)
    if question is None:
        session.status = WhatIfSession.Status.ENDED
        session.state = stamp_endgame_stats(
            session,
            {
                **prev,
                "ended_reason": "no_more_questions",
            },
        )
        session.state_version = F("state_version") + 1
        session.save(update_fields=["status", "state", "state_version", "updated_at"])
        session.refresh_from_db()
        mark_whatif_completion_for_session_users(session.id)
        evaluate_after_whatif_session_ended(session.id)
        return False

    session.status = WhatIfSession.Status.TURN
    player_ids = [p.id for p in _players_ordered(session)]
    die_block: dict = {"subject_candidate_ids": [], "subject_options": []}
    if session.challenge_mode:
        die_block = _subject_die_state_for_turn(session, prev)

    session_tallies, player_tallies = carry_tallies_from_prev(prev)
    session_tallies["round_number"] = int(session_tallies.get("rounds_completed") or 0) + 1
    session.state = {
        "active_player_id": next_player_id,
        "question_id": question.id,
        "question_prompt": None,
        "votes": {},
        "vote_counts": {},
        "voted_player_ids": [],
        "last_votes": {},
        "round_scores": {},
        "reveal_flairs": [],
        "challenge_target_player_id": None,
        "challenge_target_npc_id": None,
        "subject_times": subject_times,
        "session_tallies": session_tallies,
        "player_tallies": player_tallies,
        **die_block,
        "duel": None,
        "voting_deadline_at": None,
        "voting_paused": False,
        "voting_pause_remaining_seconds": None,
        "pending_question_skip_by_player_id": None,
        "skip_ui_suppressed_for_question_id": None,
        "revealed_at": None,
        "next_turn_not_before": None,
        "final_scores": [],
    }
    session.state_version = F("state_version") + 1
    session.save(update_fields=["status", "state", "state_version", "updated_at"])
    session.refresh_from_db()
    return True


def _public_round_state(session: WhatIfSession) -> dict:
    state = dict(session.state or {})
    question = _question_for_round(state)
    if question:
        q = WhatIfQuestionPublicSerializer(question).data
        rendered_prompt = state.get("question_prompt")
        if isinstance(rendered_prompt, str) and rendered_prompt.strip():
            q["prompt"] = rendered_prompt
        if session.status == WhatIfSession.Status.TURN and not _has_challenge_target(state):
            state["question"] = None
        else:
            state["question"] = q
    else:
        state["question"] = None

    if session.status == WhatIfSession.Status.TURN:
        state["votes"] = {}
        state["vote_counts"] = {}
        state["voted_player_ids"] = []
    elif session.status == WhatIfSession.Status.VOTING:
        voted_ids = [int(pid) for pid in (session.state or {}).get("votes", {}).keys()]
        state["votes"] = {}
        state["vote_counts"] = {}
        state["voted_player_ids"] = voted_ids
    elif session.status == WhatIfSession.Status.ENDED:
        if not state.get("endgame_stats"):
            state["endgame_stats"] = endgame_stats(session)
        if not state.get("endgame_awards"):
            from whatif.endgame import compute_endgame_awards

            state["endgame_awards"] = compute_endgame_awards(session, dict(session.state or {}))
        if state.get("final_scores"):
            state["final_scores"] = enrich_final_scores_with_lifetime_lines(
                session,
                list(state["final_scores"]),
                dict(session.state or {}),
            )
    round_number = current_round_number(state)
    if round_number is not None:
        state["round_number"] = round_number
    return state


def _hand_state(session: WhatIfSession, player: WhatIfPlayer) -> dict:
    base = _public_round_state(session)
    base["you"] = WhatIfPlayerSerializer(
        player,
        context=whatif_players_serializer_context([player]),
    ).data
    votes = (session.state or {}).get("votes", {})
    base["your_vote"] = votes.get(str(player.id)) or votes.get(player.id)
    last_votes = (session.state or {}).get("last_votes", {})
    base["your_last_vote"] = last_votes.get(str(player.id)) or last_votes.get(player.id)
    if session.status == WhatIfSession.Status.ENDED and player.user_id:
        base["your_lifetime"] = lifetime_stats_for_user(
            int(player.user_id),
            current_session_score=player.score,
        )
    return base


def _version_not_modified_response(session: WhatIfSession, request):
    since_value = request.GET.get("since")
    etag = request.headers.get("If-None-Match", "").strip().strip('"')
    try:
        since = int(since_value) if since_value else None
    except ValueError:
        since = None
    try:
        etag_version = int(etag) if etag else None
    except ValueError:
        etag_version = None

    if (since is not None and since >= session.state_version) or (
        etag_version is not None and etag_version >= session.state_version
    ):
        resp = Response(status=status.HTTP_304_NOT_MODIFIED)
        resp["ETag"] = f'"{session.state_version}"'
        # Explicit length helps some HTTP proxies (e.g. Vite dev server) handle 304 without turning it into 502.
        resp["Content-Length"] = "0"
        return resp
    return None


def _require_staff(request) -> Response | None:
    if not getattr(request.user, "is_authenticated", False):
        return Response({"detail": "Authentication credentials were not provided."}, status=401)
    if not getattr(request.user, "is_staff", False):
        return Response({"detail": "Staff access required."}, status=403)
    return None


def _parse_bulk_question_blocks(text: str) -> tuple[list[dict], list[dict]]:
    blocks = [b.strip() for b in re.split(r"\n\s*\n+", text.strip()) if b.strip()]
    rows: list[dict] = []
    errors: list[dict] = []
    # Accept: "1 - answer", "1. answer", "1) answer", and "1 answer"
    answer_re = re.compile(r"^\s*([1-6])(?:\s*[-.)])?\s+(.+)\s*$")

    for i, block in enumerate(blocks, start=1):
        lines = [ln.rstrip() for ln in block.splitlines() if ln.strip()]
        if len(lines) < 7:
            errors.append(
                {
                    "block": i,
                    "error": "Each block must contain 1 prompt line and 6 numbered answers.",
                }
            )
            continue
        prompt = lines[0].strip()
        answers: dict[int, str] = {}
        block_ok = True
        for expected_idx, line in enumerate(lines[1:7], start=1):
            m = answer_re.match(line)
            if not m:
                errors.append(
                    {
                        "block": i,
                        "line": expected_idx + 1,
                        "error": f'Invalid answer format: "{line}"',
                    }
                )
                block_ok = False
                continue
            idx = int(m.group(1))
            text_value = m.group(2).strip()
            if idx != expected_idx:
                errors.append(
                    {
                        "block": i,
                        "line": expected_idx + 1,
                        "error": f"Answers must be in order 1 through 6 (found {idx}).",
                    }
                )
                block_ok = False
            answers[idx] = text_value
        if not block_ok:
            continue
        rows.append(
            {
                "prompt": prompt,
                "answer_1": answers[1],
                "answer_2": answers[2],
                "answer_3": answers[3],
                "answer_4": answers[4],
                "answer_5": answers[5],
                "answer_6": answers[6],
            }
        )

    return rows, errors


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def create_session(request):
    session = WhatIfSession.objects.create(
        short_code=_generate_short_code(),
        status=WhatIfSession.Status.OPEN,
        owner=request.user,
    )
    body = WhatIfSessionPublicSerializer(
        session,
        context={"players_ordered": [], "npcs_ordered": [], "whatif_player_avatar_urls": {}},
    ).data
    body["host_secret"] = str(session.host_secret)
    return Response(body, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def resume_host_session(request, code: str):
    """Re-issue host_secret for the session owner (e.g. after browser crash lost sessionStorage)."""
    session = get_object_or_404(WhatIfSession, short_code=code.upper())
    if session.owner_id is None:
        return Response(
            {"detail": "This room has no host on file; it cannot be resumed."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if session.owner_id != request.user.id:
        return Response(
            {"detail": "You are not the host of this room."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return Response(
        {
            "short_code": session.short_code,
            "host_secret": str(session.host_secret),
            "status": session.status,
        },
        status=status.HTTP_200_OK,
    )


_WHATIF_MY_SESSIONS_LIMIT = 100
_WHATIF_LOBBY_STATUSES = frozenset(
    (WhatIfSession.Status.OPEN, WhatIfSession.Status.PRE_LOBBY),
)
_WHATIF_IN_PROGRESS_STATUSES = frozenset(
    (
        WhatIfSession.Status.TURN,
        WhatIfSession.Status.VOTING,
        WhatIfSession.Status.REVEAL,
        WhatIfSession.Status.POST_RESULTS,
    ),
)


def _serialize_whatif_my_session_row(session: WhatIfSession, user_id: int) -> dict:
    players = list(session.players.all())
    winner_display_name: str | None = None
    try:
        res = session.result
        if res is not None:
            w = (res.winner_display_name or "").strip()
            winner_display_name = w or None
    except ObjectDoesNotExist:
        pass
    my_player = next((p for p in players if p.user_id == user_id), None)
    player_secret = str(my_player.player_secret) if my_player is not None else None
    return {
        "short_code": session.short_code,
        "status": session.status,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "is_owner": session.owner_id == user_id,
        "player_names": [p.display_name for p in players],
        "winner_display_name": winner_display_name,
        "player_secret": player_secret,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def list_my_sessions(request):
    """Sessions the user hosts or joined while logged in; grouped for the Resume tab."""
    uid = int(request.user.id)
    qs = (
        WhatIfSession.objects.filter(Q(owner_id=uid) | Q(players__user_id=uid))
        .distinct()
        .select_related("result")
        .prefetch_related(
            Prefetch(
                "players",
                queryset=WhatIfPlayer.objects.order_by("created_at", "id"),
            )
        )
        .order_by("-updated_at")[:_WHATIF_MY_SESSIONS_LIMIT]
    )
    sessions = list(qs)

    def by_updated_desc(slist: list[WhatIfSession]) -> list[WhatIfSession]:
        return sorted(slist, key=lambda s: s.updated_at, reverse=True)

    lobby = by_updated_desc([s for s in sessions if s.status in _WHATIF_LOBBY_STATUSES])
    in_progress = by_updated_desc([s for s in sessions if s.status in _WHATIF_IN_PROGRESS_STATUSES])
    completed = by_updated_desc([s for s in sessions if s.status == WhatIfSession.Status.ENDED])
    known = _WHATIF_LOBBY_STATUSES | _WHATIF_IN_PROGRESS_STATUSES | frozenset((WhatIfSession.Status.ENDED,))
    unknown = [s for s in sessions if s.status not in known]
    if unknown:
        in_progress = by_updated_desc(in_progress + unknown)

    return Response(
        {
            "open_lobby": [_serialize_whatif_my_session_row(s, uid) for s in lobby],
            "in_progress": [_serialize_whatif_my_session_row(s, uid) for s in in_progress],
            "completed": [_serialize_whatif_my_session_row(s, uid) for s in completed],
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def join_session(request, code: str):
    serializer = JoinSessionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    display_name = serializer.validated_data["display_name"]
    user = request.user if getattr(request.user, "is_authenticated", False) else None

    with transaction.atomic():
        session = _load_session_locked(code)
        if session.status not in _WHATIF_LOBBY_STATUSES:
            return Response(
                {"detail": "This game has already started. New players cannot join."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if _whatif_entity_count(session) >= constants.WHATIF_MAX_ENTITIES:
            return Response(
                {"detail": "This room is full (8 players and NPCs)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if _display_name_taken(session, display_name):
            return Response(
                {"detail": "That name is already in the room."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        avatar = _pick_avatar_emoji(session)
        player = WhatIfPlayer.objects.create(
            session=session,
            user=user,
            display_name=display_name,
            avatar_emoji=avatar,
        )
        session.state_version = F("state_version") + 1
        session.save(update_fields=["state_version", "updated_at"])
    session = _reload_session_with_prefetch(session.id)
    notify_whatif_session(session.short_code, state_version=session.state_version)

    return Response(
        {
            "player": WhatIfPlayerSerializer(
                player,
                context=whatif_players_serializer_context([player]),
            ).data,
            "player_secret": str(player.player_secret),
            "session_code": session.short_code,
            "state_version": session.state_version,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def session_state(request, code: str):
    session = _load_session(code)
    session = _maybe_auto_reveal_voting(session)
    session = maybe_declare_pending_winner(session)
    not_modified = _version_not_modified_response(session, request)
    if not_modified is not None:
        return not_modified

    payload = WhatIfSessionPublicSerializer(
        session,
        context={
            "players_ordered": _players_ordered(session),
            "npcs_ordered": _npcs_ordered(session),
        },
    ).data
    payload["state"] = _public_round_state(session)
    resp = Response(payload, status=status.HTTP_200_OK)
    resp["ETag"] = f'"{session.state_version}"'
    return resp


def _session_serializer_context(session: WhatIfSession) -> dict:
    players = _players_ordered(session)
    return {
        "players_ordered": players,
        "npcs_ordered": _npcs_ordered(session),
        **whatif_players_serializer_context(players),
    }


def _build_session_action_response(session: WhatIfSession, request) -> dict:
    payload = WhatIfSessionPublicSerializer(
        session, context=_session_serializer_context(session)
    ).data
    player_for_hand = _find_player_for_request(session, request)
    if player_for_hand is not None:
        payload["state"] = _hand_state(session, player_for_hand)
    else:
        payload["state"] = _public_round_state(session)
    return payload


@api_view(["GET"])
@permission_classes([AllowAny])
@retry_on_db_locked(max_attempts=8, initial_delay_s=0.05, backoff=0.25)
def hand_state(request, code: str):
    session = _load_session(code)
    session = _maybe_auto_reveal_voting(session)
    session = maybe_declare_pending_winner(session)
    player = _find_player_for_request(session, request)
    if player is None:
        return Response({"detail": "Missing or invalid player token."}, status=status.HTTP_403_FORBIDDEN)

    not_modified = _version_not_modified_response(session, request)
    if not_modified is not None:
        return not_modified

    players_ordered = _players_ordered(session)
    npcs_ordered = _npcs_ordered(session)
    payload = {
        "short_code": session.short_code,
        "status": session.status,
        "challenge_mode": session.challenge_mode,
        "state_version": session.state_version,
        "state": _hand_state(session, player),
        "players": WhatIfPlayerSerializer(
            players_ordered,
            many=True,
            context=whatif_players_serializer_context(players_ordered),
        ).data,
        "npcs": WhatIfNpcSerializer(npcs_ordered, many=True).data,
    }
    resp = Response(payload, status=status.HTTP_200_OK)
    resp["ETag"] = f'"{session.state_version}"'
    return resp


def _require_player(session: WhatIfSession, request) -> WhatIfPlayer | Response:
    player = _find_player_for_request(session, request)
    if player is None:
        return Response({"detail": "Missing or invalid player token."}, status=status.HTTP_403_FORBIDDEN)
    return player


def _actor_paused_response(actor: WhatIfPlayer | None) -> Response | None:
    if actor is None:
        return Response({"detail": "Player not found in this session."}, status=400)
    if actor.paused:
        return Response(
            {"detail": "You are paused by the host. Ask them to resume you."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return None


def _resolve_actor_for_action(
    session: WhatIfSession, request, action_type: str
) -> tuple[WhatIfPlayer | None, Response | None]:
    """Returns (player_or_none, error_response). Host-only: start_game, set_player_paused. Others need player token."""
    player = _find_player_for_request(session, request)
    host_hdr = request.headers.get("X-Whatif-Host-Token", "").strip()
    host_ok = bool(host_hdr and str(session.host_secret) == host_hdr)

    if action_type in ("start_game", "add_npc", "remove_npc"):
        if not host_ok:
            detail = "Only the host can perform this action."
            if action_type == "start_game":
                detail = "Only the host can start the game from the lobby."
            return None, Response({"detail": detail}, status=status.HTTP_403_FORBIDDEN)
        return None, None

    if action_type == "set_player_paused":
        if not host_ok:
            return None, Response(
                {"detail": "Only the host can pause or resume players."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None, None

    if action_type == "complete_game":
        if not host_ok:
            return None, Response(
                {"detail": "Only the host can complete the game."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None, None

    if player is None:
        return None, Response(
            {"detail": "Missing or invalid player token."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return player, None


def _pause_blocked_for_active_player(session: WhatIfSession, state: dict, target_id: int) -> bool:
    """Cannot pause the active player while they must drive the TV (subject, reveal, next turn)."""
    ap = state.get("active_player_id")
    if ap is None or int(ap) != int(target_id):
        return False
    return session.status in (
        WhatIfSession.Status.TURN,
        WhatIfSession.Status.VOTING,
        WhatIfSession.Status.POST_RESULTS,
    )


def _set_voting_deadline(state: dict) -> None:
    state["voting_deadline_at"] = (
        timezone.now() + timedelta(seconds=constants.VOTING_DEADLINE_SECONDS)
    ).isoformat()


def _apply_question_skip_locked(session: WhatIfSession, state: dict, *, requester_id: int) -> None:
    question_id = state.get("question_id")
    votes = state.get("votes") or {}
    n_votes = len(votes)
    if question_id and n_votes:
        WhatIfQuestion.objects.filter(id=question_id).update(
            total_responses=F("total_responses") - n_votes
        )
    if question_id:
        WhatIfQuestion.objects.filter(id=question_id).update(total_skips=F("total_skips") + 1)
        WhatIfQuestionSession.objects.filter(question_id=question_id, session_id=session.id).update(
            skipped_at=timezone.now()
        )
        record_question_vetoed(state)
    ap = state.get("active_player_id")
    target_id = state.get("challenge_target_player_id")
    target_npc_id = state.get("challenge_target_npc_id")
    if ap is None or (target_id is None and target_npc_id is None):
        ordered = _player_ids_in_turn_order(session)
        fallback_id = int(ap) if ap is not None else (ordered[0] if ordered else None)
        if fallback_id is None:
            return
        _setup_turn(session, next_player_id=fallback_id)
        return

    if target_npc_id is not None:
        target_npc = _find_npc_by_id(session, int(target_npc_id))
        if target_npc is None:
            _setup_turn(session, next_player_id=int(ap))
            return
        subject_name = target_npc.display_name
        challenge_player_id = None
        challenge_npc_id = int(target_npc_id)
    else:
        target = _find_player_by_id(session, int(target_id))
        if target is None:
            _setup_turn(session, next_player_id=int(ap))
            return
        subject_name = target.display_name
        challenge_player_id = int(target_id)
        challenge_npc_id = None

    duel = state.get("duel") or {}
    if duel.get("step") == "voting" and duel.get("challenged_player_id") is not None:
        next_duel = {
            "step": "voting",
            "challenged_player_id": int(duel["challenged_player_id"]),
        }
    else:
        next_duel = None

    question = _draw_question(session)
    if question is None:
        prev = dict(session.state or {})
        session.status = WhatIfSession.Status.ENDED
        session.state = stamp_endgame_stats(
            session,
            {
                **prev,
                "ended_reason": "no_more_questions",
            },
        )
        session.state_version = F("state_version") + 1
        session.save(update_fields=["status", "state", "state_version", "updated_at"])
        session.refresh_from_db()
        mark_whatif_completion_for_session_users(session.id)
        evaluate_after_whatif_session_ended(session.id)
        return

    rendered_prompt = _render_question_prompt(question, subject_name=subject_name)
    session_tallies, player_tallies = carry_tallies_from_prev(state)
    new_state = {
        "active_player_id": int(ap),
        "question_id": question.id,
        "question_prompt": rendered_prompt,
        "votes": {},
        "vote_counts": {},
        "voted_player_ids": [],
        "last_votes": {},
        "round_scores": {},
        "reveal_flairs": [],
        "challenge_target_player_id": challenge_player_id,
        "challenge_target_npc_id": challenge_npc_id,
        "subject_times": dict(state.get("subject_times") or {}),
        "session_tallies": session_tallies,
        "player_tallies": player_tallies,
        "subject_candidate_ids": [],
        "subject_options": [],
        "marker_index": state.get("marker_index"),
        "last_subject_seat_index": state.get("last_subject_seat_index"),
        "duel": next_duel,
        "voting_deadline_at": None,
        "voting_paused": False,
        "voting_pause_remaining_seconds": None,
        "pending_question_skip_by_player_id": None,
        "skip_ui_suppressed_for_question_id": None,
        "revealed_at": None,
        "next_turn_not_before": None,
        "final_scores": [],
    }
    session.status = WhatIfSession.Status.VOTING
    session.state = new_state
    session.state_version = F("state_version") + 1
    session.save(update_fields=["status", "state", "state_version", "updated_at"])


@api_view(["POST"])
@permission_classes([AllowAny])
def session_action(request, code: str):
    serializer = SessionActionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    action_type = serializer.validated_data["type"]

    session_id: int | None = None
    with transaction.atomic():
        session = _load_session_locked(code)
        session_id = session.id
        actor, actor_err = _resolve_actor_for_action(session, request, action_type)
        if actor_err is not None:
            return actor_err
        state = dict(session.state or {})

        if action_type == "start_game":
            if session.status not in [WhatIfSession.Status.OPEN, WhatIfSession.Status.PRE_LOBBY]:
                return Response({"detail": "Game already started."}, status=status.HTTP_400_BAD_REQUEST)
            players_ordered = _players_ordered(session)
            if len(players_ordered) < 2:
                return Response({"detail": "At least two players are required."}, status=status.HTTP_400_BAD_REQUEST)
            session.challenge_mode = len(players_ordered) >= 2
            session.save(update_fields=["challenge_mode", "updated_at"])
            first_non_paused = next((p.id for p in players_ordered if not p.paused), None)
            first_player_id = first_non_paused if first_non_paused is not None else players_ordered[0].id
            _setup_turn(session, next_player_id=first_player_id)

        elif action_type == "add_npc":
            if session.status not in _WHATIF_LOBBY_STATUSES:
                return Response(
                    {"detail": "NPCs can only be added before the game starts."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            raw_name = serializer.validated_data.get("display_name")
            if not raw_name:
                return Response({"detail": "display_name is required."}, status=400)
            try:
                display_name = validate_display_name(str(raw_name))
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            if _whatif_entity_count(session) >= constants.WHATIF_MAX_ENTITIES:
                return Response(
                    {"detail": "This room is full (8 players and NPCs)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if _display_name_taken(session, display_name):
                return Response(
                    {"detail": "That name is already in the room."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            npc = WhatIfNpc.objects.create(
                session=session,
                display_name=display_name,
                avatar_emoji=_pick_avatar_emoji(session),
            )
            session.state_version = F("state_version") + 1
            session.save(update_fields=["state_version", "updated_at"])

        elif action_type == "remove_npc":
            if session.status not in _WHATIF_LOBBY_STATUSES:
                return Response(
                    {"detail": "NPCs can only be removed before the game starts."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            npc_id = serializer.validated_data.get("npc_id")
            if not npc_id:
                return Response({"detail": "npc_id is required."}, status=400)
            deleted, _ = WhatIfNpc.objects.filter(session=session, id=int(npc_id)).delete()
            if not deleted:
                return Response({"detail": "NPC not found in this session."}, status=404)
            session.state_version = F("state_version") + 1
            session.save(update_fields=["state_version", "updated_at"])

        elif action_type == "complete_game":
            if session.status == WhatIfSession.Status.ENDED:
                return Response({"detail": "Game already ended."}, status=status.HTTP_400_BAD_REQUEST)
            if session.status in _WHATIF_LOBBY_STATUSES:
                return Response({"detail": "Game has not started."}, status=status.HTTP_400_BAD_REQUEST)
            if session.status not in _WHATIF_IN_PROGRESS_STATUSES:
                return Response({"detail": "Cannot complete game in this state."}, status=status.HTTP_400_BAD_REQUEST)
            apply_host_complete_game(session)

        elif action_type == "pick_duel_opponent":
            if session.status != WhatIfSession.Status.TURN:
                return Response({"detail": "Choosing who to challenge is only allowed during turn state."}, status=400)
            paused_err = _actor_paused_response(actor)
            if paused_err is not None:
                return paused_err
            if state.get("active_player_id") != actor.id:
                return Response({"detail": "Only the active player can choose who to challenge."}, status=403)
            duel = state.get("duel") or {}
            if duel.get("step") != "pick_opponent":
                return Response({"detail": "Choosing who to challenge is not available right now."}, status=400)
            target_id = serializer.validated_data.get("target_player_id")
            if not target_id:
                return Response({"detail": "target_player_id is required."}, status=400)
            if int(target_id) == int(actor.id):
                return Response({"detail": "You cannot challenge yourself."}, status=400)
            opp = _find_player_by_id(session, int(target_id))
            if opp is None:
                return Response({"detail": "Player does not exist in this session."}, status=400)
            if opp.paused:
                return Response({"detail": "That player is paused."}, status=400)
            state["duel"] = {"step": "pick_subject", "challenged_player_id": int(target_id)}
            record_challenge_started(state, issuer_id=int(actor.id), challenged_id=int(target_id))
            state.update(_subject_die_state_for_duel_subject_turn(session, state))
            session.state = state
            session.state_version = F("state_version") + 1
            session.save(update_fields=["state", "state_version", "updated_at"])

        elif action_type == "pick_subject":
            if session.status != WhatIfSession.Status.TURN:
                return Response({"detail": "Subject pick is only allowed during turn state."}, status=400)
            paused_err = _actor_paused_response(actor)
            if paused_err is not None:
                return paused_err
            if not session.challenge_mode:
                return Response({"detail": "Subject pick is not active for this session."}, status=400)
            if state.get("active_player_id") != actor.id:
                return Response({"detail": "Only the active player can pick the round subject."}, status=403)
            duel = state.get("duel") or {}
            if duel.get("step") == "pick_opponent":
                return Response({"detail": "Choose who to challenge first."}, status=400)
            if duel.get("step") != "pick_subject" and _has_challenge_target(state):
                return Response({"detail": "Subject is already chosen for this round."}, status=400)

            challenge_req = bool(serializer.validated_data.get("challenge"))
            opts = state.get("subject_options") or []
            if duel.get("step") == "pick_subject":
                return Response(
                    {"detail": "Use pick_subject_die_choice for the challenge subject roll."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if challenge_req:
                if not any(o.get("kind") == "challenge" for o in opts):
                    return Response({"detail": "Challenge is not an option this round."}, status=400)
                state["duel"] = {"step": "pick_opponent", "challenged_player_id": None}
                state["subject_candidate_ids"] = []
                state["subject_options"] = []
                _pids, _nids, _layout, p_m, e_m, l_m = _session_ring_context(session)
                if p_m >= 3:
                    ch = challenge_seat_index(p_m, e_m)
                    if ch is not None:
                        state["marker_index"] = ch
                        state["last_subject_seat_index"] = ch
                _strip_subject_die_keys(state)
                session.state = state
                session.state_version = F("state_version") + 1
                session.save(update_fields=["state", "state_version", "updated_at"])
            else:
                target_id = serializer.validated_data.get("target_player_id")
                if not target_id:
                    return Response({"detail": "target_player_id is required."}, status=400)
                if state.get("subject_die_value") is not None:
                    return Response(
                        {"detail": "Use pick_subject_die_choice for this subject round."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                allowed = [o.get("player_id") for o in opts if o.get("kind") == "player"]
                legacy = list(state.get("subject_candidate_ids") or [])
                if int(target_id) not in allowed and int(target_id) not in legacy:
                    return Response(
                        {"detail": "Choose one of the subject candidates for this round."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                target = _find_player_by_id(session, int(target_id))
                if target is None:
                    return Response({"detail": "Player does not exist in this session."}, status=400)
                question = _question_for_round(state)
                if question is None:
                    replacement = _draw_question(session)
                    if replacement is None:
                        return Response({"detail": "No available questions for this round."}, status=400)
                    question = replacement
                    state["question_id"] = question.id
                try:
                    rendered_prompt = _render_question_prompt(question, subject_name=target.display_name)
                except ValueError as exc:
                    return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
                st = dict(state.get("subject_times") or {})
                st[str(target_id)] = st.get(str(target_id), 0) + 1
                state["subject_times"] = st
                state["challenge_target_player_id"] = target_id
                state["challenge_target_npc_id"] = None
                state["question_prompt"] = rendered_prompt
                state["subject_candidate_ids"] = []
                state["subject_options"] = []
                state["votes"] = {}
                state["vote_counts"] = {}
                state["voted_player_ids"] = []
                state["last_votes"] = {}
                state["round_scores"] = {}
                if duel.get("step") == "pick_subject" and duel.get("challenged_player_id") is not None:
                    state["duel"] = {
                        "step": "voting",
                        "challenged_player_id": int(duel["challenged_player_id"]),
                    }
                else:
                    state["duel"] = None
                state["voting_deadline_at"] = None
                state["voting_paused"] = False
                state["voting_pause_remaining_seconds"] = None
                rows_ids = [p.id for p in _players_ordered(session)]
                try:
                    seat_idx = rows_ids.index(int(target_id))
                except ValueError:
                    seat_idx = int(state.get("marker_index") or 0)
                state["marker_index"] = seat_idx
                state["last_subject_seat_index"] = seat_idx
                _strip_subject_die_keys(state)
                session.state = state
                session.status = WhatIfSession.Status.VOTING
                session.state_version = F("state_version") + 1
                session.save(update_fields=["status", "state", "state_version", "updated_at"])

        elif action_type == "pick_subject_die_choice":
            if session.status != WhatIfSession.Status.TURN:
                return Response({"detail": "Subject die choice is only allowed during turn state."}, status=400)
            if not session.challenge_mode:
                return Response({"detail": "Subject die is not active for this session."}, status=400)
            paused_err = _actor_paused_response(actor)
            if paused_err is not None:
                return paused_err
            if state.get("active_player_id") != actor.id:
                return Response({"detail": "Only the active player can pick the subject."}, status=403)
            duel = state.get("duel") or {}
            if duel.get("step") == "pick_opponent":
                return Response({"detail": "Choose who to challenge first."}, status=400)
            if _has_challenge_target(state):
                return Response({"detail": "Subject is already chosen for this round."}, status=400)
            if state.get("subject_die_value") is None:
                return Response({"detail": "No subject die roll is pending."}, status=400)
            choice = serializer.validated_data.get("choice")
            if choice not in ("a", "b"):
                return Response({"detail": "choice must be 'a' or 'b'."}, status=400)
            a = int(state["subject_candidate_seat_a"])
            b = int(state["subject_candidate_seat_b"])
            degenerate = bool(state.get("subject_pick_degenerate"))
            if degenerate and choice != "a":
                return Response({"detail": "Only choice 'a' is valid for this roll."}, status=400)
            chosen = a if choice == "a" else b
            player_ids, npc_ids, layout, p_ct, e_ct, l_seats = _session_ring_context(session)
            if is_challenge_seat(chosen, l_seats, p_ct, e_ct):
                if duel.get("step") == "pick_subject":
                    return Response(
                        {"detail": "Challenge is not a valid subject during this challenge round."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                state["duel"] = {"step": "pick_opponent", "challenged_player_id": None}
                state["subject_candidate_ids"] = []
                state["subject_options"] = []
                state["marker_index"] = chosen
                state["last_subject_seat_index"] = chosen
                _strip_subject_die_keys(state)
                session.state = state
                session.state_version = F("state_version") + 1
                session.save(update_fields=["state", "state_version", "updated_at"])
            else:
                occ = seat_occupant_at(layout, chosen, l_seats, p_ct)
                if occ is None:
                    return Response({"detail": "Invalid subject seat."}, status=500)
                kind, entity_id = occ
                if kind == "player":
                    target = _find_player_by_id(session, int(entity_id))
                    if target is None:
                        return Response({"detail": "Player does not exist in this session."}, status=400)
                    if target.paused:
                        return Response(
                            {"detail": "That player is paused and cannot be the subject."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    subject_name = target.display_name
                    state["challenge_target_player_id"] = int(entity_id)
                    state["challenge_target_npc_id"] = None
                else:
                    npc = _find_npc_by_id(session, int(entity_id))
                    if npc is None:
                        return Response({"detail": "NPC does not exist in this session."}, status=400)
                    subject_name = npc.display_name
                    state["challenge_target_player_id"] = None
                    state["challenge_target_npc_id"] = int(entity_id)
                question = _question_for_round(state)
                if question is None:
                    replacement = _draw_question(session)
                    if replacement is None:
                        return Response({"detail": "No available questions for this round."}, status=400)
                    question = replacement
                    state["question_id"] = question.id
                try:
                    rendered_prompt = _render_question_prompt(question, subject_name=subject_name)
                except ValueError as exc:
                    return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
                st = dict(state.get("subject_times") or {})
                st[str(entity_id)] = st.get(str(entity_id), 0) + 1
                state["subject_times"] = st
                state["question_prompt"] = rendered_prompt
                state["subject_candidate_ids"] = []
                state["subject_options"] = []
                state["votes"] = {}
                state["vote_counts"] = {}
                state["voted_player_ids"] = []
                state["last_votes"] = {}
                state["round_scores"] = {}
                if duel.get("step") == "pick_subject" and duel.get("challenged_player_id") is not None:
                    state["duel"] = {
                        "step": "voting",
                        "challenged_player_id": int(duel["challenged_player_id"]),
                    }
                else:
                    state["duel"] = None
                state["voting_deadline_at"] = None
                state["voting_paused"] = False
                state["voting_pause_remaining_seconds"] = None
                state["marker_index"] = chosen
                state["last_subject_seat_index"] = chosen
                _strip_subject_die_keys(state)
                session.state = state
                session.status = WhatIfSession.Status.VOTING
                session.state_version = F("state_version") + 1
                session.save(update_fields=["status", "state", "state_version", "updated_at"])

        elif action_type == "vote":
            if session.status != WhatIfSession.Status.VOTING:
                return Response({"detail": "Not in voting state."}, status=400)
            if state.get("voting_paused"):
                return Response(
                    {"detail": "Voting is paused. Wait for the active player to resume."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            paused_err = _actor_paused_response(actor)
            if paused_err is not None:
                return paused_err
            option_index = serializer.validated_data.get("option_index")
            if option_index is None or option_index not in [1, 2, 3, 4, 5, 6]:
                return Response({"detail": "option_index must be an integer from 1 to 6."}, status=400)
            question = _question_for_round(state)
            if question is None:
                return Response({"detail": "Question is missing for this round."}, status=400)
            if option_index not in question.answers_map():
                return Response({"detail": "Option does not exist for this question."}, status=400)
            votes = state.get("votes", {})
            is_new_vote = str(actor.id) not in votes
            votes[str(actor.id)] = option_index
            state["votes"] = votes
            last_votes = dict(state.get("last_votes") or {})
            last_votes[str(actor.id)] = option_index
            state["last_votes"] = last_votes
            state["vote_counts"] = vote_breakdown(
                {int(pid): int(choice) for pid, choice in votes.items()}
            )
            state["voted_player_ids"] = sorted(int(pid) for pid in votes.keys())
            if votes_complete_for_round(session, state):
                state["voting_deadline_at"] = timezone.now().isoformat()
            elif state.get("voting_deadline_at") is None and len(votes) >= 1:
                # Start the round timer the first time any vote lands; never reset thereafter,
                # even if voters subsequently unvote (unless all votes in snaps deadline below).
                _set_voting_deadline(state)
            session.state = state
            session.state_version = F("state_version") + 1
            session.save(update_fields=["state", "state_version", "updated_at"])

            question_id = state.get("question_id")
            if question_id and is_new_vote:
                WhatIfQuestion.objects.filter(id=question_id).update(total_responses=F("total_responses") + 1)

        elif action_type == "unvote":
            if session.status != WhatIfSession.Status.VOTING:
                return Response({"detail": "Not in voting state."}, status=400)
            if state.get("voting_paused"):
                return Response(
                    {"detail": "Voting is paused. Wait for the active player to resume."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if is_voting_deadline_elapsed(state):
                return Response(
                    {"detail": "Time's up — you can no longer change your vote."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            paused_err = _actor_paused_response(actor)
            if paused_err is not None:
                return paused_err
            votes = state.get("votes", {})
            if str(actor.id) not in votes:
                return Response({"detail": "You have no vote to clear."}, status=400)
            last_votes = dict(state.get("last_votes") or {})
            last_votes[str(actor.id)] = votes[str(actor.id)]
            state["last_votes"] = last_votes
            votes.pop(str(actor.id), None)
            state["votes"] = votes
            state["vote_counts"] = vote_breakdown(
                {int(pid): int(choice) for pid, choice in votes.items()}
            )
            state["voted_player_ids"] = sorted(int(pid) for pid in votes.keys())
            # NOTE: voting_deadline_at is intentionally NOT cleared, even if votes is now empty.
            session.state = state
            session.state_version = F("state_version") + 1
            session.save(update_fields=["state", "state_version", "updated_at"])

            question_id = state.get("question_id")
            if question_id:
                WhatIfQuestion.objects.filter(id=question_id).update(
                    total_responses=F("total_responses") - 1
                )

        elif action_type == "toggle_voting_pause":
            if session.status != WhatIfSession.Status.VOTING:
                return Response({"detail": "Pause is only available during voting."}, status=400)
            paused_err = _actor_paused_response(actor)
            if paused_err is not None:
                return paused_err
            if state.get("active_player_id") != actor.id:
                return Response(
                    {"detail": "Only the active player can pause the round."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            now = timezone.now()
            if state.get("voting_paused"):
                remaining = state.get("voting_pause_remaining_seconds")
                if isinstance(remaining, (int, float)) and remaining > 0:
                    state["voting_deadline_at"] = (
                        now + timedelta(seconds=float(remaining))
                    ).isoformat()
                state["voting_paused"] = False
                state["voting_pause_remaining_seconds"] = None
            else:
                deadline = parse_iso_datetime(state.get("voting_deadline_at"))
                if deadline is not None:
                    state["voting_pause_remaining_seconds"] = max(
                        0.0, (deadline - now).total_seconds()
                    )
                    state["voting_deadline_at"] = None
                else:
                    state["voting_pause_remaining_seconds"] = None
                state["voting_paused"] = True
            session.state = state
            session.state_version = F("state_version") + 1
            session.save(update_fields=["state", "state_version", "updated_at"])

        elif action_type == "reveal":
            if session.status != WhatIfSession.Status.VOTING:
                return Response({"detail": "Reveal is only allowed during voting."}, status=400)
            paused_err = _actor_paused_response(actor)
            if paused_err is not None:
                return paused_err
            if state.get("active_player_id") != actor.id:
                return Response({"detail": "Only the active player can reveal votes."}, status=403)
            if not can_reveal_now(session, state):
                return Response({"detail": "Cannot reveal yet."}, status=400)
            st = dict(session.state or {})
            apply_reveal_from_voting_state(session, st)

        elif action_type == "next_turn":
            status_before_next_turn = session.status
            declare_pending_winner_if_due(session)
            session.refresh_from_db()
            state = dict(session.state or {})
            if session.status == WhatIfSession.Status.ENDED:
                if status_before_next_turn == WhatIfSession.Status.ENDED:
                    return Response({"detail": "Game already ended."}, status=status.HTTP_400_BAD_REQUEST)
            elif session.status != WhatIfSession.Status.POST_RESULTS:
                return Response({"detail": "Not ready for next turn."}, status=400)
            else:
                if state.get("pending_winner_player_id") is not None:
                    return Response(
                        {"detail": "Winner will be declared after the score reveal."},
                        status=400,
                    )
                paused_err = _actor_paused_response(actor)
                if paused_err is not None:
                    return paused_err
                if state.get("active_player_id") != actor.id:
                    return Response(
                        {"detail": "Only the active player can advance to next turn."},
                        status=403,
                    )
                not_before = state.get("next_turn_not_before")
                if isinstance(not_before, str):
                    try:
                        nb = datetime.fromisoformat(not_before)
                        if timezone.is_naive(nb):
                            nb = timezone.make_aware(nb)
                        if timezone.now() < nb:
                            return Response(
                                {"detail": "Please wait before starting the next turn."},
                                status=400,
                            )
                    except ValueError:
                        pass
                next_player_id = _next_turn_player_id(session, state)
                if next_player_id is None:
                    return Response(
                        {
                            "detail": (
                                "All players are paused; resume someone on the TV scoreboard "
                                "before the next turn."
                            )
                        },
                        status=400,
                    )
                _setup_turn(session, next_player_id=next_player_id)

        elif action_type == "skip":
            if session.status != WhatIfSession.Status.TURN:
                return Response({"detail": "Skip is only allowed during turn state."}, status=400)
            paused_err = _actor_paused_response(actor)
            if paused_err is not None:
                return paused_err
            if state.get("active_player_id") != actor.id:
                return Response({"detail": "Only the active player can skip."}, status=403)
            question_id = state.get("question_id")
            if question_id:
                WhatIfQuestion.objects.filter(id=question_id).update(total_skips=F("total_skips") + 1)
            _setup_turn(session, next_player_id=actor.id)

        elif action_type == "request_question_skip":
            if session.status != WhatIfSession.Status.VOTING:
                return Response({"detail": "Skip is only available during voting."}, status=400)
            paused_err = _actor_paused_response(actor)
            if paused_err is not None:
                return paused_err
            qid = state.get("question_id")
            if state.get("skip_ui_suppressed_for_question_id") == qid:
                return Response({"detail": "Skip is not available for this question."}, status=400)
            if state.get("pending_question_skip_by_player_id"):
                return Response({"detail": "A skip request is already pending."}, status=400)
            if state.get("active_player_id") == actor.id:
                _apply_question_skip_locked(session, state, requester_id=actor.id)
            else:
                state["pending_question_skip_by_player_id"] = actor.id
                session.state = state
                session.state_version = F("state_version") + 1
                session.save(update_fields=["state", "state_version", "updated_at"])

        elif action_type == "resolve_question_skip":
            if session.status != WhatIfSession.Status.VOTING:
                return Response({"detail": "Not in voting state."}, status=400)
            if state.get("active_player_id") != actor.id:
                return Response({"detail": "Only the active player can resolve a skip request."}, status=403)
            pending = state.get("pending_question_skip_by_player_id")
            if not pending:
                return Response({"detail": "No skip request to resolve."}, status=400)
            approve = serializer.validated_data.get("approve")
            if approve is None:
                return Response({"detail": "approve (boolean) is required."}, status=400)
            qid = state.get("question_id")
            if not approve:
                state["pending_question_skip_by_player_id"] = None
                state["skip_ui_suppressed_for_question_id"] = qid
                session.state = state
                session.state_version = F("state_version") + 1
                session.save(update_fields=["state", "state_version", "updated_at"])
            else:
                _apply_question_skip_locked(session, state, requester_id=int(pending))

        elif action_type == "leave_game":
            if session.status not in _WHATIF_LOBBY_STATUSES:
                return Response(
                    {"detail": "You can only leave before the game starts."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            actor.delete()
            session.state_version = F("state_version") + 1
            session.save(update_fields=["state_version", "updated_at"])

        elif action_type == "set_player_paused":
            target_id = serializer.validated_data.get("target_player_id")
            paused_flag = serializer.validated_data.get("paused")
            if target_id is None:
                return Response({"detail": "target_player_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            if paused_flag is None:
                return Response({"detail": "paused (boolean) is required."}, status=status.HTTP_400_BAD_REQUEST)
            target = _find_player_by_id(session, int(target_id))
            if target is None:
                return Response({"detail": "Player not found in this session."}, status=status.HTTP_400_BAD_REQUEST)
            if paused_flag and (
                _pause_blocked_for_active_player(session, state, target.id)
                or pause_blocked_for_duel(session, state, target.id)
            ):
                return Response(
                    {
                        "detail": (
                            "Cannot pause this player right now (they are driving a phase or in an active challenge round). "
                            "Unpause others first or wait."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            target.paused = bool(paused_flag)
            target.save(update_fields=["paused", "updated_at"])
            session.state_version = F("state_version") + 1
            session.save(update_fields=["state_version", "updated_at"])

    session = _reload_session_with_prefetch(session_id)
    session = _maybe_auto_reveal_voting(session)
    session = maybe_declare_pending_winner(session)
    notify_whatif_session(session.short_code, state_version=session.state_version)
    return Response(_build_session_action_response(session, request), status=status.HTTP_200_OK)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def admin_questions(request):
    staff_err = _require_staff(request)
    if staff_err is not None:
        return staff_err

    if request.method == "GET":
        from django.db.models import Case, IntegerField, When

        query = str(request.GET.get("q", "")).strip()
        list_filter = str(request.GET.get("list_filter", "all")).strip().lower()
        valid_filters = {"all", "active", "inactive", "rejected"}
        if list_filter not in valid_filters:
            list_filter = "all"
        qs = WhatIfQuestion.objects.filter(deleted_at__isnull=True)
        if list_filter == "rejected":
            qs = qs.filter(review_status=WhatIfQuestion.ReviewStatus.REJECTED)
        elif list_filter == "active":
            qs = qs.filter(is_active=True)
        elif list_filter == "inactive":
            qs = qs.filter(is_active=False)
        if query:
            qs = qs.filter(prompt__icontains=query)
        qs = qs.annotate(
            _pend=Case(
                When(review_status=WhatIfQuestion.ReviewStatus.PENDING, then=0),
                default=1,
                output_field=IntegerField(),
            )
        ).order_by("_pend", "-updated_at", "-id")
        return Response(WhatIfQuestionAdminSerializer(qs, many=True).data, status=200)

    serializer = WhatIfQuestionAdminSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    question = serializer.save(
        review_status=WhatIfQuestion.ReviewStatus.APPROVED,
        proposed_by=None,
        deleted_at=None,
    )
    return Response(WhatIfQuestionAdminSerializer(question).data, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_questions_pending_count(request):
    staff_err = _require_staff(request)
    if staff_err is not None:
        return staff_err
    n = WhatIfQuestion.objects.filter(
        review_status=WhatIfQuestion.ReviewStatus.PENDING,
        deleted_at__isnull=True,
    ).count()
    return Response({"pending_count": n}, status=200)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def propose_question(request):
    from users.models import Profile

    profile = Profile.objects.filter(user_id=request.user.id).first()
    if profile is None or not profile.whatif_completed_session:
        return Response(
            {"detail": "You must complete at least one WhatIf game before proposing questions."},
            status=status.HTTP_403_FORBIDDEN,
        )
    serializer = WhatIfQuestionProposeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    question = WhatIfQuestion.objects.create(
        **serializer.validated_data,
        review_status=WhatIfQuestion.ReviewStatus.PENDING,
        is_active=False,
        proposed_by=request.user,
    )
    return Response(WhatIfQuestionAdminSerializer(question).data, status=201)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def admin_question_detail(request, question_id: int):
    staff_err = _require_staff(request)
    if staff_err is not None:
        return staff_err

    question = get_object_or_404(WhatIfQuestion, id=question_id)
    if request.method == "DELETE":
        question.deleted_at = timezone.now()
        question.save(update_fields=["deleted_at", "updated_at"])
        return Response(status=204)

    serializer = WhatIfQuestionAdminSerializer(question, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    prev_status = question.review_status
    updated = serializer.save()
    if (
        updated.review_status == WhatIfQuestion.ReviewStatus.APPROVED
        and prev_status != WhatIfQuestion.ReviewStatus.APPROVED
        and updated.proposed_by_id is not None
    ):
        evaluate_whatif_dece_proposer_for_user(int(updated.proposed_by_id))
    return Response(WhatIfQuestionAdminSerializer(updated).data, status=200)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def admin_questions_bulk_import(request):
    staff_err = _require_staff(request)
    if staff_err is not None:
        return staff_err

    text = str(request.data.get("text", "")).strip()
    if not text:
        return Response({"detail": "Missing bulk import text."}, status=400)
    rows, errors = _parse_bulk_question_blocks(text)
    if errors:
        return Response({"detail": "Bulk import parse failed.", "errors": errors}, status=400)

    with transaction.atomic():
        created = [
            WhatIfQuestion.objects.create(
                **row,
                review_status=WhatIfQuestion.ReviewStatus.APPROVED,
                is_active=True,
            )
            for row in rows
        ]
    return Response(
        {
            "created_count": len(created),
            "questions": WhatIfQuestionAdminSerializer(created, many=True).data,
        },
        status=201,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"app": "whatif", "ok": True})

