import random
import re
import string
from datetime import datetime, timedelta

from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from achievements.services import evaluate_after_whatif_session_ended
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsApprovedUser

from whatif import constants
from whatif.gameplay import (
    apply_reveal_from_voting_state,
    can_reveal_now,
    final_scores,
    is_voting_deadline_passed,
    mark_whatif_completion_for_session_users,
    parse_iso_datetime,
    pause_blocked_for_duel,
    votes_complete_for_round,
)
from whatif.models import (
    WhatIfPlayer,
    WhatIfQuestion,
    WhatIfQuestionSession,
    WhatIfSession,
)
from whatif.rules import (
    two_subject_candidate_ids,
    two_subject_candidate_ids_duel,
    vote_breakdown,
)
from whatif.serializers import (
    JoinSessionSerializer,
    SessionActionSerializer,
    WhatIfQuestionAdminSerializer,
    WhatIfQuestionProposeSerializer,
    WhatIfPlayerSerializer,
    WhatIfQuestionPublicSerializer,
    WhatIfSessionPublicSerializer,
    whatif_players_serializer_context,
)

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
    """Pick an emoji not yet used by another player in this session (unique while pool allows)."""
    used = set(session.players.values_list("avatar_emoji", flat=True))
    available = [e for e in AVATAR_EMOJIS if e not in used]
    if available:
        return random.choice(available)
    return random.choice(AVATAR_EMOJIS)


def _generate_short_code() -> str:
    alphabet = string.ascii_uppercase
    for _ in range(40):
        code = "".join(random.choice(alphabet) for _ in range(4))
        if not WhatIfSession.objects.filter(short_code=code).exists():
            return code
    raise RuntimeError("Unable to generate unique room code.")


def _load_session(code: str) -> WhatIfSession:
    return get_object_or_404(
        WhatIfSession.objects.prefetch_related("players"),
        short_code=code.upper(),
    )


def _find_player_for_request(session: WhatIfSession, request) -> WhatIfPlayer | None:
    token = request.headers.get("X-Whatif-Player-Token", "").strip()
    if not token:
        return None
    return session.players.filter(player_secret=token).first()


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
    return [p.id for p in session.players.all().order_by("created_at", "id")]


def _next_turn_player_id(session: WhatIfSession, state: dict) -> int | None:
    """Next player in join order who is not paused; None if every player is paused."""
    ordered = _player_ids_in_turn_order(session)
    if not ordered:
        return None
    pause_map = {p.id: p.paused for p in session.players.all()}
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


def _build_subject_options(
    session: WhatIfSession, *, active_player_id: int, subject_times: dict[str, int]
) -> list[dict]:
    rows = list(session.players.all().order_by("created_at", "id"))
    player_ids = [p.id for p in rows]
    non_paused_ids = [p.id for p in rows if not p.paused]
    subject_pool = non_paused_ids if len(non_paused_ids) >= 2 else player_ids
    cands = two_subject_candidate_ids(
        player_ids=subject_pool,
        active_player_id=active_player_id,
        subject_times=subject_times,
    )
    if len(cands) < 2:
        return [{"kind": "player", "player_id": cands[0]}]
    options = [
        {"kind": "player", "player_id": cands[0]},
        {"kind": "player", "player_id": cands[1]},
    ]
    n = len(player_ids)
    if n >= 3 and random.random() < 1.0 / (1 + n):
        idx = random.randint(0, 1)
        options[idx] = {"kind": "challenge"}
    return options


def _maybe_auto_reveal_voting(session: WhatIfSession) -> WhatIfSession:
    """Apply reveal when the voting deadline passed (idempotent). Caller does not hold a lock."""
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
    return locked


def _setup_turn(session: WhatIfSession, *, next_player_id: int) -> bool:
    prev = dict(session.state or {})
    subject_times = dict(prev.get("subject_times") or {})

    question = _draw_question(session)
    if question is None:
        session.status = WhatIfSession.Status.ENDED
        session.state = {
            **prev,
            "ended_reason": "no_more_questions",
        }
        session.state_version = F("state_version") + 1
        session.save(update_fields=["status", "state", "state_version", "updated_at"])
        session.refresh_from_db()
        mark_whatif_completion_for_session_users(session.id)
        evaluate_after_whatif_session_ended(session.id)
        return False

    session.status = WhatIfSession.Status.TURN
    rows = list(session.players.all().order_by("created_at", "id"))
    player_ids = [p.id for p in rows]
    non_paused_ids = [p.id for p in rows if not p.paused]
    # Prefer subject pool = non-paused only when at least two are in play (baton target is never paused).
    subject_pool = non_paused_ids if len(non_paused_ids) >= 2 else player_ids
    subject_options: list[dict] = []
    subject_candidate_ids: list[int] = []
    if session.challenge_mode:
        subject_options = _build_subject_options(
            session, active_player_id=next_player_id, subject_times=subject_times
        )
        subject_candidate_ids = [o["player_id"] for o in subject_options if o.get("kind") == "player"]

    session.state = {
        "active_player_id": next_player_id,
        "question_id": question.id,
        "question_prompt": None,
        "votes": {},
        "vote_counts": {},
        "voted_player_ids": [],
        "round_scores": {},
        "reveal_flairs": [],
        "challenge_target_player_id": None,
        "subject_times": subject_times,
        "subject_candidate_ids": subject_candidate_ids,
        "subject_options": subject_options,
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
        if session.status == WhatIfSession.Status.TURN and not state.get("challenge_target_player_id"):
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
    return state


def _hand_state(session: WhatIfSession, player: WhatIfPlayer) -> dict:
    base = _public_round_state(session)
    base["you"] = WhatIfPlayerSerializer(
        player,
        context=whatif_players_serializer_context([player]),
    ).data
    votes = (session.state or {}).get("votes", {})
    base["your_vote"] = votes.get(str(player.id)) or votes.get(player.id)
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
    body = WhatIfSessionPublicSerializer(session).data
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


@api_view(["POST"])
@permission_classes([AllowAny])
def join_session(request, code: str):
    serializer = JoinSessionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    display_name = serializer.validated_data["display_name"]
    user = request.user if getattr(request.user, "is_authenticated", False) else None

    with transaction.atomic():
        session = get_object_or_404(
            WhatIfSession.objects.select_for_update(),
            short_code=code.upper(),
        )
        if (
            WhatIfPlayer.objects.filter(session=session)
            .filter(display_name__iexact=display_name)
            .exists()
        ):
            return Response(
                {"detail": "A player with this name is already in the room."},
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
    session.refresh_from_db()

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
    not_modified = _version_not_modified_response(session, request)
    if not_modified is not None:
        return not_modified

    payload = WhatIfSessionPublicSerializer(session).data
    payload["state"] = _public_round_state(session)
    resp = Response(payload, status=status.HTTP_200_OK)
    resp["ETag"] = f'"{session.state_version}"'
    return resp


@api_view(["GET"])
@permission_classes([AllowAny])
def hand_state(request, code: str):
    session = _load_session(code)
    session = _maybe_auto_reveal_voting(session)
    player = _find_player_for_request(session, request)
    if player is None:
        return Response({"detail": "Missing or invalid player token."}, status=status.HTTP_403_FORBIDDEN)

    not_modified = _version_not_modified_response(session, request)
    if not_modified is not None:
        return not_modified

    players_ordered = list(session.players.order_by("created_at", "id"))
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
    }
    resp = Response(payload, status=status.HTTP_200_OK)
    resp["ETag"] = f'"{session.state_version}"'
    return resp


def _require_player(session: WhatIfSession, request) -> WhatIfPlayer | Response:
    player = _find_player_for_request(session, request)
    if player is None:
        return Response({"detail": "Missing or invalid player token."}, status=status.HTTP_403_FORBIDDEN)
    return player


def _resolve_actor_for_action(
    session: WhatIfSession, request, action_type: str
) -> tuple[WhatIfPlayer | None, Response | None]:
    """Returns (player_or_none, error_response). Host-only: start_game, set_player_paused. Others need player token."""
    player = _find_player_for_request(session, request)
    host_hdr = request.headers.get("X-Whatif-Host-Token", "").strip()
    host_ok = bool(host_hdr and str(session.host_secret) == host_hdr)

    if action_type == "start_game":
        if not host_ok:
            return None, Response(
                {"detail": "Only the host can start the game from the lobby."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None, None

    if action_type == "set_player_paused":
        if not host_ok:
            return None, Response(
                {"detail": "Only the host can pause or resume players."},
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
    ap = state.get("active_player_id")
    target_id = state.get("challenge_target_player_id")
    if ap is None or target_id is None:
        ordered = _player_ids_in_turn_order(session)
        fallback_id = int(ap) if ap is not None else (ordered[0] if ordered else None)
        if fallback_id is None:
            return
        _setup_turn(session, next_player_id=fallback_id)
        return

    target = session.players.filter(id=int(target_id)).first()
    if target is None:
        _setup_turn(session, next_player_id=int(ap))
        return

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
        session.state = {
            **prev,
            "ended_reason": "no_more_questions",
        }
        session.state_version = F("state_version") + 1
        session.save(update_fields=["status", "state", "state_version", "updated_at"])
        session.refresh_from_db()
        mark_whatif_completion_for_session_users(session.id)
        evaluate_after_whatif_session_ended(session.id)
        return

    rendered_prompt = _render_question_prompt(question, subject_name=target.display_name)
    new_state = {
        "active_player_id": int(ap),
        "question_id": question.id,
        "question_prompt": rendered_prompt,
        "votes": {},
        "vote_counts": {},
        "voted_player_ids": [],
        "round_scores": {},
        "reveal_flairs": [],
        "challenge_target_player_id": int(target_id),
        "subject_times": dict(state.get("subject_times") or {}),
        "subject_candidate_ids": [],
        "subject_options": [],
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
    session = _load_session(code)

    serializer = SessionActionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    action_type = serializer.validated_data["type"]

    actor, actor_err = _resolve_actor_for_action(session, request, action_type)
    if actor_err is not None:
        return actor_err

    with transaction.atomic():
        session = WhatIfSession.objects.select_for_update().get(id=session.id)
        state = dict(session.state or {})

        if action_type == "start_game":
            if session.status not in [WhatIfSession.Status.OPEN, WhatIfSession.Status.PRE_LOBBY]:
                return Response({"detail": "Game already started."}, status=status.HTTP_400_BAD_REQUEST)
            players_ordered = list(session.players.all().order_by("created_at", "id"))
            if len(players_ordered) < 2:
                return Response({"detail": "At least two players are required."}, status=status.HTTP_400_BAD_REQUEST)
            session.challenge_mode = len(players_ordered) >= 2
            session.save(update_fields=["challenge_mode", "updated_at"])
            first_non_paused = next((p.id for p in players_ordered if not p.paused), None)
            first_player_id = first_non_paused if first_non_paused is not None else players_ordered[0].id
            _setup_turn(session, next_player_id=first_player_id)

        elif action_type == "pick_duel_opponent":
            if session.status != WhatIfSession.Status.TURN:
                return Response({"detail": "Choosing who to challenge is only allowed during turn state."}, status=400)
            pick_actor = WhatIfPlayer.objects.select_for_update().filter(id=actor.id, session_id=session.id).first()
            if pick_actor is None:
                return Response({"detail": "Player not found in this session."}, status=400)
            if pick_actor.paused:
                return Response(
                    {"detail": "You are paused by the host. Ask them to resume you."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
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
            opp = session.players.filter(id=target_id).first()
            if opp is None:
                return Response({"detail": "Player does not exist in this session."}, status=400)
            if opp.paused:
                return Response({"detail": "That player is paused."}, status=400)
            rows = list(session.players.all().order_by("created_at", "id"))
            all_ids = [p.id for p in rows]
            st_t = dict(state.get("subject_times") or {})
            cand = two_subject_candidate_ids_duel(player_ids=all_ids, subject_times=st_t)
            state["duel"] = {"step": "pick_subject", "challenged_player_id": int(target_id)}
            state["subject_candidate_ids"] = cand
            state["subject_options"] = [
                {"kind": "player", "player_id": cand[0]},
                {"kind": "player", "player_id": cand[1]},
            ]
            session.state = state
            session.state_version = F("state_version") + 1
            session.save(update_fields=["state", "state_version", "updated_at"])

        elif action_type == "pick_subject":
            if session.status != WhatIfSession.Status.TURN:
                return Response({"detail": "Subject pick is only allowed during turn state."}, status=400)
            pick_actor = WhatIfPlayer.objects.select_for_update().filter(id=actor.id, session_id=session.id).first()
            if pick_actor is None:
                return Response({"detail": "Player not found in this session."}, status=400)
            if pick_actor.paused:
                return Response(
                    {"detail": "You are paused by the host. Ask them to resume you."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not session.challenge_mode:
                return Response({"detail": "Subject pick is not active for this session."}, status=400)
            if state.get("active_player_id") != actor.id:
                return Response({"detail": "Only the active player can pick the round subject."}, status=403)
            duel = state.get("duel") or {}
            if duel.get("step") == "pick_opponent":
                return Response({"detail": "Choose who to challenge first."}, status=400)
            if duel.get("step") != "pick_subject" and state.get("challenge_target_player_id"):
                return Response({"detail": "Subject is already chosen for this round."}, status=400)

            challenge_req = bool(serializer.validated_data.get("challenge"))
            opts = state.get("subject_options") or []

            if challenge_req:
                if not any(o.get("kind") == "challenge" for o in opts):
                    return Response({"detail": "Challenge is not an option this round."}, status=400)
                state["duel"] = {"step": "pick_opponent", "challenged_player_id": None}
                state["subject_candidate_ids"] = []
                state["subject_options"] = []
                session.state = state
                session.state_version = F("state_version") + 1
                session.save(update_fields=["state", "state_version", "updated_at"])
            else:
                target_id = serializer.validated_data.get("target_player_id")
                if not target_id:
                    return Response({"detail": "target_player_id is required."}, status=400)
                allowed = [o.get("player_id") for o in opts if o.get("kind") == "player"]
                legacy = list(state.get("subject_candidate_ids") or [])
                if int(target_id) not in allowed and int(target_id) not in legacy:
                    return Response(
                        {"detail": "Choose one of the subject candidates for this round."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                target = session.players.filter(id=target_id).first()
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
                state["question_prompt"] = rendered_prompt
                state["subject_candidate_ids"] = []
                state["subject_options"] = []
                state["votes"] = {}
                state["vote_counts"] = {}
                state["voted_player_ids"] = []
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
            vote_pl = WhatIfPlayer.objects.select_for_update().filter(id=actor.id, session_id=session.id).first()
            if vote_pl is None:
                return Response({"detail": "Player not found in this session."}, status=400)
            if vote_pl.paused:
                return Response(
                    {"detail": "You are paused by the host. Ask them to resume you."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
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
            state["vote_counts"] = vote_breakdown(
                {int(pid): int(choice) for pid, choice in votes.items()}
            )
            state["voted_player_ids"] = sorted(int(pid) for pid in votes.keys())
            # Start the round timer the first time any vote lands; never reset thereafter,
            # even if voters subsequently unvote.
            if state.get("voting_deadline_at") is None and len(votes) >= 1:
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
            uv_pl = WhatIfPlayer.objects.select_for_update().filter(id=actor.id, session_id=session.id).first()
            if uv_pl is None:
                return Response({"detail": "Player not found in this session."}, status=400)
            if uv_pl.paused:
                return Response(
                    {"detail": "You are paused by the host. Ask them to resume you."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            votes = state.get("votes", {})
            if str(actor.id) not in votes:
                return Response({"detail": "You have no vote to clear."}, status=400)
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
            tp_pl = WhatIfPlayer.objects.select_for_update().filter(id=actor.id, session_id=session.id).first()
            if tp_pl is None:
                return Response({"detail": "Player not found in this session."}, status=400)
            if tp_pl.paused:
                return Response(
                    {"detail": "You are paused by the host. Ask them to resume you."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
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
            reveal_pl = WhatIfPlayer.objects.select_for_update().filter(id=actor.id, session_id=session.id).first()
            if reveal_pl is None:
                return Response({"detail": "Player not found in this session."}, status=400)
            if reveal_pl.paused:
                return Response(
                    {"detail": "You are paused by the host. Ask them to resume you."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if state.get("active_player_id") != actor.id:
                return Response({"detail": "Only the active player can reveal votes."}, status=403)
            if not can_reveal_now(session, state):
                return Response({"detail": "Cannot reveal yet."}, status=400)
            st = dict(session.state or {})
            apply_reveal_from_voting_state(session, st)

        elif action_type == "next_turn":
            if session.status != WhatIfSession.Status.POST_RESULTS:
                return Response({"detail": "Not ready for next turn."}, status=400)
            next_pl = WhatIfPlayer.objects.select_for_update().filter(id=actor.id, session_id=session.id).first()
            if next_pl is None:
                return Response({"detail": "Player not found in this session."}, status=400)
            if next_pl.paused:
                return Response(
                    {"detail": "You are paused by the host. Ask them to resume you."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if state.get("active_player_id") != actor.id:
                return Response({"detail": "Only the active player can advance to next turn."}, status=403)
            not_before = state.get("next_turn_not_before")
            if isinstance(not_before, str):
                try:
                    nb = datetime.fromisoformat(not_before)
                    if timezone.is_naive(nb):
                        nb = timezone.make_aware(nb)
                    if timezone.now() < nb:
                        return Response({"detail": "Please wait before starting the next turn."}, status=400)
                except ValueError:
                    pass
            next_player_id = _next_turn_player_id(session, state)
            if next_player_id is None:
                return Response(
                    {"detail": "All players are paused; resume someone on the TV scoreboard before the next turn."},
                    status=400,
                )
            _setup_turn(session, next_player_id=next_player_id)

        elif action_type == "skip":
            if session.status != WhatIfSession.Status.TURN:
                return Response({"detail": "Skip is only allowed during turn state."}, status=400)
            skip_pl = WhatIfPlayer.objects.select_for_update().filter(id=actor.id, session_id=session.id).first()
            if skip_pl is None:
                return Response({"detail": "Player not found in this session."}, status=400)
            if skip_pl.paused:
                return Response(
                    {"detail": "You are paused by the host. Ask them to resume you."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if state.get("active_player_id") != actor.id:
                return Response({"detail": "Only the active player can skip."}, status=403)
            question_id = state.get("question_id")
            if question_id:
                WhatIfQuestion.objects.filter(id=question_id).update(total_skips=F("total_skips") + 1)
            _setup_turn(session, next_player_id=actor.id)

        elif action_type == "request_question_skip":
            if session.status != WhatIfSession.Status.VOTING:
                return Response({"detail": "Skip is only available during voting."}, status=400)
            skip_pl = WhatIfPlayer.objects.select_for_update().filter(id=actor.id, session_id=session.id).first()
            if skip_pl is None:
                return Response({"detail": "Player not found in this session."}, status=400)
            if skip_pl.paused:
                return Response(
                    {"detail": "You are paused by the host. Ask them to resume you."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
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

        elif action_type == "set_player_paused":
            target_id = serializer.validated_data.get("target_player_id")
            paused_flag = serializer.validated_data.get("paused")
            if target_id is None:
                return Response({"detail": "target_player_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            if paused_flag is None:
                return Response({"detail": "paused (boolean) is required."}, status=status.HTTP_400_BAD_REQUEST)
            target = (
                WhatIfPlayer.objects.select_for_update()
                .filter(id=target_id, session_id=session.id)
                .first()
            )
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

    session.refresh_from_db()
    session = _maybe_auto_reveal_voting(session)
    payload = WhatIfSessionPublicSerializer(session).data
    player_for_hand = _find_player_for_request(session, request)
    if player_for_hand is not None:
        payload["state"] = _hand_state(session, player_for_hand)
    else:
        payload["state"] = _public_round_state(session)
    return Response(payload, status=status.HTTP_200_OK)


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
    updated = serializer.save()
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

