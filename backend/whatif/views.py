import random
import re
import string
from datetime import datetime, timedelta

from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from whatif.models import (
    WhatIfGameResult,
    WhatIfPlayer,
    WhatIfQuestion,
    WhatIfQuestionSession,
    WhatIfSession,
)
from whatif.rules import (
    evaluate_vote_scores,
    pick_winner_at_or_above_threshold,
    two_subject_candidate_ids,
    vote_breakdown,
)
from whatif.serializers import (
    JoinSessionSerializer,
    SessionActionSerializer,
    WhatIfQuestionAdminSerializer,
    WhatIfPlayerSerializer,
    WhatIfQuestionPublicSerializer,
    WhatIfSessionPublicSerializer,
)

AVATAR_EMOJIS = ["🦊", "🐻", "🐼", "🐸", "🦉", "🐧", "🐙", "🦁", "🐯", "🦄", "🐢", "🐠"]
ROUND_TRANSITION_SECONDS = 5


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
    pool = WhatIfQuestion.objects.filter(is_active=True).exclude(id__in=used_ids)
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
    ordered = _player_ids_in_turn_order(session)
    if not ordered:
        return None
    current_id = state.get("active_player_id")
    if current_id not in ordered:
        return ordered[0]
    i = ordered.index(current_id)
    return ordered[(i + 1) % len(ordered)]


def _render_question_prompt(question: WhatIfQuestion, *, subject_name: str) -> str:
    if "{subject}" not in question.prompt:
        # Backward-compatible fallback for legacy prompts without token.
        # Recommended format remains: "What if {subject} ..."
        return f"What if {subject_name}: {question.prompt.strip()}"
    return question.prompt.replace("{subject}", subject_name)


def _final_scores(session: WhatIfSession) -> list[dict]:
    # Fresh DB read — player scores may have just been updated with F() and related
    # `session.players` instances can be stale in the same request.
    players = list(
        WhatIfPlayer.objects.filter(session_id=session.id).order_by("-score", "created_at", "id")
    )
    return [
        {
            "player_id": p.id,
            "display_name": p.display_name,
            "avatar_emoji": p.avatar_emoji,
            "score": p.score,
            "rank": i + 1,
        }
        for i, p in enumerate(players)
    ]


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
        return False

    session.status = WhatIfSession.Status.TURN
    player_ids = [p.id for p in session.players.all().order_by("created_at", "id")]
    subject_candidate_ids: list[int] = []
    if session.challenge_mode:
        subject_candidate_ids = two_subject_candidate_ids(
            player_ids=player_ids,
            active_player_id=next_player_id,
            subject_times=subject_times,
        )

    session.state = {
        "active_player_id": next_player_id,
        "question_id": question.id,
        "question_prompt": None,
        "votes": {},
        "vote_counts": {},
        "voted_player_ids": [],
        "round_scores": {},
        "challenge_target_player_id": None,
        "subject_times": subject_times,
        "subject_candidate_ids": subject_candidate_ids,
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
    base["you"] = WhatIfPlayerSerializer(player).data
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
@permission_classes([IsAuthenticated])
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
@permission_classes([IsAuthenticated])
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
    session = _load_session(code)
    serializer = JoinSessionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    display_name = serializer.validated_data["display_name"]
    avatar = random.choice(AVATAR_EMOJIS)
    user = request.user if getattr(request.user, "is_authenticated", False) else None

    with transaction.atomic():
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
            "player": WhatIfPlayerSerializer(player).data,
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
    player = _find_player_for_request(session, request)
    if player is None:
        return Response({"detail": "Missing or invalid player token."}, status=status.HTTP_403_FORBIDDEN)

    not_modified = _version_not_modified_response(session, request)
    if not_modified is not None:
        return not_modified

    payload = {
        "short_code": session.short_code,
        "status": session.status,
        "challenge_mode": session.challenge_mode,
        "state_version": session.state_version,
        "state": _hand_state(session, player),
        "players": WhatIfPlayerSerializer(session.players.all(), many=True).data,
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
    """Returns (player_or_none, error_response). start_game requires host token; other actions require player token."""
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

    if player is None:
        return None, Response(
            {"detail": "Missing or invalid player token."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return player, None


def _all_players_voted(session: WhatIfSession, state: dict) -> bool:
    votes = state.get("votes", {})
    all_ids = [p.id for p in session.players.all()]
    return len(votes.keys()) >= len(all_ids)


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
            players = list(session.players.all())
            if len(players) < 2:
                return Response({"detail": "At least two players are required."}, status=status.HTTP_400_BAD_REQUEST)
            if not all(p.ready_to_start for p in players):
                return Response(
                    {"detail": "Every player must mark ready on their phone before the host can start."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            session.challenge_mode = len(players) >= 2
            session.save(update_fields=["challenge_mode", "updated_at"])
            first_player_id = players[0].id
            _setup_turn(session, next_player_id=first_player_id)

        elif action_type == "toggle_ready":
            if session.status not in (WhatIfSession.Status.OPEN, WhatIfSession.Status.PRE_LOBBY):
                return Response(
                    {"detail": "Ready can only be changed while waiting in the lobby."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            pl = WhatIfPlayer.objects.select_for_update().get(id=actor.id, session_id=session.id)
            pl.ready_to_start = not pl.ready_to_start
            pl.save(update_fields=["ready_to_start", "updated_at"])
            session.state_version = F("state_version") + 1
            session.save(update_fields=["state_version", "updated_at"])

        elif action_type == "pick_subject":
            if session.status != WhatIfSession.Status.TURN:
                return Response({"detail": "Subject pick is only allowed during turn state."}, status=400)
            if not session.challenge_mode:
                return Response({"detail": "Subject pick is not active for this session."}, status=400)
            if state.get("active_player_id") != actor.id:
                return Response({"detail": "Only the active player can pick the round subject."}, status=403)
            if state.get("challenge_target_player_id"):
                return Response({"detail": "Subject is already chosen for this round."}, status=400)
            target_id = serializer.validated_data.get("target_player_id")
            if not target_id:
                return Response({"detail": "target_player_id is required."}, status=400)
            candidates = list(state.get("subject_candidate_ids") or [])
            if target_id not in candidates:
                return Response(
                    {"detail": "Choose one of the two subject candidates for this round."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            target = session.players.filter(id=target_id).first()
            if target is None:
                return Response({"detail": "Player does not exist in this session."}, status=400)
            question = _question_for_round(state)
            if question is None:
                # Recover if a previously selected question was removed or missing:
                # draw a replacement so subject selection can continue.
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
            state["votes"] = {}
            state["vote_counts"] = {}
            state["voted_player_ids"] = []
            state["round_scores"] = {}
            session.state = state
            session.status = WhatIfSession.Status.VOTING
            session.state_version = F("state_version") + 1
            session.save(update_fields=["status", "state", "state_version", "updated_at"])

        elif action_type == "vote":
            if session.status != WhatIfSession.Status.VOTING:
                return Response({"detail": "Not in voting state."}, status=400)
            option_index = serializer.validated_data.get("option_index")
            if option_index is None or option_index not in [1, 2, 3, 4, 5, 6]:
                return Response({"detail": "option_index must be an integer from 1 to 6."}, status=400)
            question = _question_for_round(state)
            if question is None:
                return Response({"detail": "Question is missing for this round."}, status=400)
            if option_index not in question.answers_map():
                return Response({"detail": "Option does not exist for this question."}, status=400)
            votes = state.get("votes", {})
            votes[str(actor.id)] = option_index
            state["votes"] = votes
            state["vote_counts"] = vote_breakdown(
                {int(pid): int(choice) for pid, choice in votes.items()}
            )
            state["voted_player_ids"] = sorted(int(pid) for pid in votes.keys())
            session.state = state
            session.state_version = F("state_version") + 1
            session.save(update_fields=["state", "state_version", "updated_at"])

            question_id = state.get("question_id")
            if question_id:
                WhatIfQuestion.objects.filter(id=question_id).update(total_responses=F("total_responses") + 1)

        elif action_type == "reveal":
            if session.status != WhatIfSession.Status.VOTING:
                return Response({"detail": "Reveal is only allowed during voting."}, status=400)
            if state.get("active_player_id") != actor.id:
                return Response({"detail": "Only the active player can reveal votes."}, status=403)
            if not _all_players_voted(session, state):
                return Response({"detail": "Not all votes are in."}, status=400)
            votes = {int(pid): int(choice) for pid, choice in state.get("votes", {}).items()}
            active_player_id = int(state["active_player_id"])
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
            state["round_scores"] = {str(pid): points for pid, points in round_scores.items()}
            state["revealed_at"] = timezone.now().isoformat()
            state["next_turn_not_before"] = (
                timezone.now() + timedelta(seconds=ROUND_TRANSITION_SECONDS)
            ).isoformat()
            state["final_scores"] = _final_scores(session)
            session.state = state
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
                    session.state["winner_player_id"] = winner.id
            session.state_version = F("state_version") + 1
            session.save(update_fields=["status", "state", "state_version", "updated_at"])

        elif action_type == "next_turn":
            if session.status != WhatIfSession.Status.POST_RESULTS:
                return Response({"detail": "Not ready for next turn."}, status=400)
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
                return Response({"detail": "No players available."}, status=400)
            _setup_turn(session, next_player_id=next_player_id)

        elif action_type == "skip":
            if session.status != WhatIfSession.Status.TURN:
                return Response({"detail": "Skip is only allowed during turn state."}, status=400)
            if state.get("active_player_id") != actor.id:
                return Response({"detail": "Only the active player can skip."}, status=403)
            if actor.skips_remaining <= 0:
                return Response({"detail": "No skips remaining."}, status=400)
            question_id = state.get("question_id")
            if question_id:
                WhatIfQuestion.objects.filter(id=question_id).update(total_skips=F("total_skips") + 1)
            WhatIfPlayer.objects.filter(id=actor.id).update(skips_remaining=F("skips_remaining") - 1)
            _setup_turn(session, next_player_id=actor.id)

    session.refresh_from_db()
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
        query = str(request.GET.get("q", "")).strip()
        qs = WhatIfQuestion.objects.all().order_by("-created_at", "-id")
        if query:
            qs = qs.filter(prompt__icontains=query)
        return Response(WhatIfQuestionAdminSerializer(qs, many=True).data, status=200)

    serializer = WhatIfQuestionAdminSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    question = serializer.save()
    return Response(WhatIfQuestionAdminSerializer(question).data, status=201)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def admin_question_detail(request, question_id: int):
    staff_err = _require_staff(request)
    if staff_err is not None:
        return staff_err

    question = get_object_or_404(WhatIfQuestion, id=question_id)
    if request.method == "DELETE":
        question.delete()
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
        created = [WhatIfQuestion.objects.create(**row) for row in rows]
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

