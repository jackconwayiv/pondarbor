from __future__ import annotations

import copy
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsApprovedUser

from .models import (
    PondsteadCampaignInvite,
    PondsteadDayLog,
    PondsteadGame,
    PondsteadGameState,
    PondsteadPlayer,
)
from .private_state_sync import sync_player_private_states_from_world, sync_shared_world_from_world_blob
from .phoenix_calendar import phoenix_campaign_calendar_date
from .pondstead_victory import victor_seat_index_or_none
from .subprocess_new_day import (
    filter_world_snapshot_for_viewer,
    load_initial_world_envelope,
    run_pondstead_new_day_subprocess,
)
from .world_envelope import unwrap_world_json, wrap_world_json

User = get_user_model()

FACTION_COLORS = frozenset({"blue", "red", "green", "yellow", "purple", "orange"})


def _approved_invitee_candidates_qs(*, owner: User, search: str):
    """Same visibility as friends approved-users search (all approved users matching search, excluding self)."""
    return (
        User.objects.select_related("profile")
        .filter(
            account_status=User.AccountStatus.APPROVED,
            deleted_at__isnull=True,
        )
        .exclude(pk=owner.pk)
        .filter(Q(email__icontains=search) | Q(profile__display_name__icontains=search))
        .order_by("profile__display_name", "email")[:20]
    )


def _player_row(p: PondsteadPlayer) -> dict[str, Any]:
    return {
        "seat_index": p.seat_index,
        "display_name": p.display_name,
        "points": p.points,
        "eliminated": p.eliminated,
        "user_id": p.user_id,
        "faction_color": p.faction_color or None,
    }


def _fallback_seat_strings(game: PondsteadGame) -> tuple[str, ...]:
    tup = tuple(str(p.seat_index) for p in game.players.all().order_by("seat_index"))
    return tup if tup else ("0", "1")


def _seat_undo_empty_template(game: PondsteadGame) -> dict[str, list[Any]]:
    return {str(p.seat_index): [] for p in game.players.all().order_by("seat_index")} or {"0": [], "1": []}


def _merge_world_seat_safe(
    client_world: dict[str, Any],
    server_world: dict[str, Any],
    requester_seat: int,
    seat_strings: tuple[str, ...],
) -> dict[str, Any]:
    merged = copy.deepcopy(client_world)
    rs = str(requester_seat)
    for key in ("pursesBySeat", "revealedBySeat", "scoutedTodayBySeat", "stackMovementBySeat", "bonusPointsBySeat"):
        cw = merged.get(key) if isinstance(merged.get(key), dict) else {}
        sw = server_world.get(key) if isinstance(server_world.get(key), dict) else {}
        out: dict[str, Any] = {}
        for sk in seat_strings:
            if sk == rs:
                if sk in cw:
                    out[sk] = cw[sk]
                elif sk in sw:
                    out[sk] = sw[sk]
            else:
                out[sk] = sw.get(sk, cw.get(sk))
        merged[key] = out
    return merged


def _merge_undo_for_patch(
    client_undo: dict[str, Any],
    server_undo: dict[str, list[Any]],
    requester_seat: int,
    seat_strings: tuple[str, ...],
) -> dict[str, list[Any]]:
    rs = str(requester_seat)
    cu = client_undo if isinstance(client_undo, dict) else {}
    su = server_undo if isinstance(server_undo, dict) else {}
    merged: dict[str, list[Any]] = {}
    for sk in seat_strings:
        if sk == rs:
            cv = cu.get(sk)
            merged[sk] = list(cv) if isinstance(cv, list) else []
        else:
            merged[sk] = list(su.get(sk) or [])
    return merged


def _try_finish_campaign_if_victory(game_pk: int, world: dict[str, Any]) -> None:
    win_seat = victor_seat_index_or_none(world)
    if win_seat is None:
        return
    row = PondsteadPlayer.objects.filter(game_id=game_pk, seat_index=win_seat).first()
    if row is None:
        return
    PondsteadGame.objects.filter(pk=game_pk).update(
        status=PondsteadGame.STATUS_FINISHED,
        winner_player_id=row.pk,
    )


def _invite_row(inv: PondsteadCampaignInvite) -> dict[str, Any]:
    u = inv.invitee
    nick = ""
    if hasattr(u, "profile") and u.profile:
        nick = (u.profile.display_name or "").strip()
    if not nick:
        nick = u.email.split("@")[0]
    return {
        "id": inv.id,
        "invitee_id": u.id,
        "invitee_nickname": nick,
        "status": inv.status,
    }


def _serialize_game_lobby(game: PondsteadGame) -> dict[str, Any]:
    return {
        "id": game.id,
        "name": game.name or "",
        "status": game.status,
        "max_players": game.max_players,
        "current_day": game.current_day,
        "owner_id": game.owner_id,
        "started_at": game.started_at.isoformat() if game.started_at else None,
        "players": [_player_row(p) for p in game.players.all().order_by("seat_index")],
        "invites": [_invite_row(i) for i in game.invites.all().order_by("-created_at")],
    }


# --- Legacy / quick-create (keeps old URL working for dev) ---


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def games_collection(request):
    """Legacy POST games/: immediate 2P active session (dev / old clients)."""
    initial = load_initial_world_envelope(2)
    today = phoenix_campaign_calendar_date()
    with transaction.atomic():
        game = PondsteadGame.objects.create(
            owner=request.user,
            max_players=2,
            config={"player_count": 2, "layout": "twoPlayerHorizontal"},
            current_day=1,
            status=PondsteadGame.STATUS_ACTIVE,
            started_at=timezone.now(),
            last_calendar_new_day_phx_date=today,
        )
        profile = getattr(request.user, "profile", None)
        dn = (getattr(profile, "display_name", None) or "").strip() or getattr(
            request.user, "username", "Player"
        )
        PondsteadPlayer.objects.create(
            game=game,
            user=request.user,
            seat_index=0,
            display_name=str(dn)[:120],
        )
        PondsteadPlayer.objects.create(
            game=game,
            user=None,
            seat_index=1,
            display_name="Opponent",
        )
        PondsteadGameState.objects.create(game=game, revision=0, world_json=initial)
    w0, u0 = unwrap_world_json(initial, fallback_seats=("0", "1"))
    sync_player_private_states_from_world(game.pk, w0, u0)
    sync_shared_world_from_world_blob(game.pk, w0, 0)
    return Response({"id": game.id, "revision": 0, "current_day": game.current_day}, status=status.HTTP_201_CREATED)


# --- Campaigns API ---


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def campaigns_create(request):
    body = request.data if isinstance(request.data, dict) else {}
    max_players = int(body.get("max_players") or 2)
    max_players = max(2, min(6, max_players))
    name = (body.get("name") or "").strip()
    if not name:
        return Response({"detail": "name is required."}, status=status.HTTP_400_BAD_REQUEST)
    name = name[:120]
    color = (body.get("faction_color") or "").strip().lower()
    if color not in FACTION_COLORS:
        return Response({"detail": "Invalid faction_color."}, status=status.HTTP_400_BAD_REQUEST)
    with transaction.atomic():
        game = PondsteadGame.objects.create(
            owner=request.user,
            name=name,
            max_players=max_players,
            config={"player_count": max_players, "layout": "twoPlayerHorizontal"},
            current_day=1,
            status=PondsteadGame.STATUS_LOBBY,
        )
        profile = getattr(request.user, "profile", None)
        dn = (getattr(profile, "display_name", None) or "").strip() or getattr(
            request.user, "username", "Player"
        )
        PondsteadPlayer.objects.create(
            game=game,
            user=request.user,
            seat_index=0,
            display_name=str(dn)[:120],
            faction_color=color,
        )
        seat_undo = {str(i): [] for i in range(max_players)}
        wrapped = wrap_world_json(
            {},
            seat_undo,
            seat_keys_to_retain=list(seat_undo.keys()),
        )
        PondsteadGameState.objects.create(game=game, revision=0, world_json=wrapped)
    w0, u0 = unwrap_world_json(
        wrapped,
        fallback_seats=tuple(str(i) for i in range(max_players)),
    )
    sync_player_private_states_from_world(game.pk, w0, u0)
    sync_shared_world_from_world_blob(game.pk, w0, 0)
    return Response(_serialize_game_lobby(game), status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def campaigns_mine(request):
    uid = request.user.id
    qs = (
        PondsteadGame.objects.filter(Q(owner_id=uid) | Q(players__user_id=uid) | Q(invites__invitee_id=uid))
        .distinct()
        .order_by("-updated_at")[:50]
    )
    return Response([_serialize_game_lobby(g) for g in qs])


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def campaigns_detail(request, game_id: int):
    game = get_object_or_404(PondsteadGame, pk=game_id)
    uid = request.user.id
    if game.owner_id != uid and not game.players.filter(user_id=uid).exists() and not game.invites.filter(invitee_id=uid).exists():
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    return Response(_serialize_game_lobby(game))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def campaigns_invite(request, game_id: int):
    game = get_object_or_404(PondsteadGame, pk=game_id)
    if game.owner_id != request.user.id:
        return Response({"detail": "Only the owner can invite."}, status=status.HTTP_403_FORBIDDEN)
    if game.status != PondsteadGame.STATUS_LOBBY:
        return Response({"detail": "Lobby closed."}, status=status.HTTP_400_BAD_REQUEST)
    body = request.data if isinstance(request.data, dict) else {}
    try:
        invitee_id = int(body.get("user_id"))
    except (TypeError, ValueError):
        return Response({"detail": "user_id required."}, status=status.HTTP_400_BAD_REQUEST)
    invitee = get_object_or_404(User, pk=invitee_id)
    if invitee.id == request.user.id:
        return Response({"detail": "Cannot invite yourself."}, status=status.HTTP_400_BAD_REQUEST)
    if invitee.account_status != User.AccountStatus.APPROVED or invitee.deleted_at is not None:
        return Response({"detail": "User not invitable."}, status=status.HTTP_400_BAD_REQUEST)
    if game.players.filter(user_id=invitee.id).exists():
        return Response({"detail": "Already a player."}, status=status.HTTP_400_BAD_REQUEST)
    inv, _ = PondsteadCampaignInvite.objects.update_or_create(
        game=game,
        invitee=invitee,
        defaults={"status": PondsteadCampaignInvite.STATUS_PENDING},
    )
    return Response(_invite_row(inv), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def campaigns_invite_accept(request, game_id: int):
    game = get_object_or_404(PondsteadGame, pk=game_id)
    inv = PondsteadCampaignInvite.objects.filter(
        game=game, invitee=request.user, status=PondsteadCampaignInvite.STATUS_PENDING
    ).first()
    if not inv:
        return Response({"detail": "No pending invite."}, status=status.HTTP_400_BAD_REQUEST)
    if game.players.filter(user_id=request.user.id).exists():
        return Response({"detail": "Already a player."}, status=status.HTTP_400_BAD_REQUEST)
    body = request.data if isinstance(request.data, dict) else {}
    color = (body.get("faction_color") or "").strip().lower()
    if color not in FACTION_COLORS:
        return Response({"detail": "Invalid faction_color."}, status=status.HTTP_400_BAD_REQUEST)
    taken = {
        str(c).strip().lower()
        for c in PondsteadPlayer.objects.filter(game=game)
        .exclude(faction_color="")
        .values_list("faction_color", flat=True)
    }
    if color in taken:
        return Response({"detail": "Color taken."}, status=status.HTTP_400_BAD_REQUEST)
    with transaction.atomic():
        inv = PondsteadCampaignInvite.objects.select_for_update().get(pk=inv.pk)
        if inv.status != PondsteadCampaignInvite.STATUS_PENDING:
            return Response({"detail": "Invite no longer pending."}, status=status.HTTP_400_BAD_REQUEST)
        used_seats = set(PondsteadPlayer.objects.filter(game=game).values_list("seat_index", flat=True))
        seat = 0
        while seat in used_seats:
            seat += 1
        if seat >= game.max_players:
            return Response({"detail": "Game is full."}, status=status.HTTP_400_BAD_REQUEST)
        profile = getattr(request.user, "profile", None)
        dn = (getattr(profile, "display_name", None) or "").strip() or getattr(request.user, "username", "Player")
        PondsteadPlayer.objects.create(
            game=game,
            user=request.user,
            seat_index=seat,
            display_name=str(dn)[:120],
            faction_color=color,
        )
        inv.status = PondsteadCampaignInvite.STATUS_ACCEPTED
        inv.save(update_fields=["status", "updated_at"])
    return Response(_serialize_game_lobby(game))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def campaigns_invite_decline(request, game_id: int):
    game = get_object_or_404(PondsteadGame, pk=game_id)
    inv = PondsteadCampaignInvite.objects.filter(
        game=game, invitee=request.user, status=PondsteadCampaignInvite.STATUS_PENDING
    ).first()
    if not inv:
        return Response({"detail": "No pending invite."}, status=status.HTTP_400_BAD_REQUEST)
    inv.status = PondsteadCampaignInvite.STATUS_DECLINED
    inv.save(update_fields=["status", "updated_at"])
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def campaigns_invite_revoke(request, game_id: int):
    """Invitee revokes acceptance: remove player row and mark invite revoked."""
    game = get_object_or_404(PondsteadGame, pk=game_id)
    if game.status != PondsteadGame.STATUS_LOBBY:
        return Response({"detail": "Lobby closed."}, status=status.HTTP_400_BAD_REQUEST)
    inv = PondsteadCampaignInvite.objects.filter(
        game=game, invitee=request.user, status=PondsteadCampaignInvite.STATUS_ACCEPTED
    ).first()
    if not inv:
        return Response({"detail": "Nothing to revoke."}, status=status.HTTP_400_BAD_REQUEST)
    with transaction.atomic():
        PondsteadPlayer.objects.filter(game=game, user=request.user).exclude(seat_index=0).delete()
        inv.status = PondsteadCampaignInvite.STATUS_REVOKED
        inv.save(update_fields=["status", "updated_at"])
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def campaigns_start(request, game_id: int):
    game = get_object_or_404(PondsteadGame, pk=game_id)
    if game.owner_id != request.user.id:
        return Response({"detail": "Only the owner can start."}, status=status.HTTP_403_FORBIDDEN)
    if game.status != PondsteadGame.STATUS_LOBBY:
        return Response({"detail": "Already started."}, status=status.HTTP_400_BAD_REQUEST)
    n_players = game.players.count()
    if n_players < game.max_players:
        return Response({"detail": f"Need {game.max_players} players to start."}, status=status.HTTP_400_BAD_REQUEST)
    initial = load_initial_world_envelope(game.max_players)
    today = phoenix_campaign_calendar_date()
    with transaction.atomic():
        g = PondsteadGame.objects.select_for_update().get(pk=game.pk)
        latest = PondsteadGameState.objects.filter(game=g).order_by("-revision").first()
        if latest:
            PondsteadGameState.objects.filter(pk=latest.pk).delete()
        PondsteadGameState.objects.create(game=g, revision=0, world_json=initial)
        g.status = PondsteadGame.STATUS_ACTIVE
        g.started_at = timezone.now()
        g.last_calendar_new_day_phx_date = today
        g.current_day = 1
        g.save(update_fields=["status", "started_at", "last_calendar_new_day_phx_date", "current_day", "updated_at"])
    fb = _fallback_seat_strings(g)
    w0, u0 = unwrap_world_json(initial, fallback_seats=fb)
    sync_player_private_states_from_world(g.pk, w0, u0)
    sync_shared_world_from_world_blob(g.pk, w0, 0)
    return Response(_game_play_payload(g))


def _game_play_payload(game: PondsteadGame) -> dict[str, Any]:
    latest = PondsteadGameState.objects.filter(game=game).order_by("-revision").first()
    if not latest:
        return {"detail": "No state."}
    fb = _fallback_seat_strings(game)
    world, undo = unwrap_world_json(latest.world_json, fallback_seats=fb)
    return {
        "id": game.id,
        "status": game.status,
        "current_day": game.current_day,
        "revision": latest.revision,
        "world": world,
        "undo_stacks_by_seat": undo,
        "players": [_player_row(p) for p in game.players.all().order_by("seat_index")],
    }


def _maybe_advance_calendar_new_day(game_id: int) -> tuple[bool, dict[str, Any] | None]:
    """
    At most one in-game new day per Phoenix calendar day per campaign.
    Uses revision compare-after-subprocess so concurrent opens cannot double-write state.
    """
    today = phoenix_campaign_calendar_date()
    with transaction.atomic():
        g = PondsteadGame.objects.select_for_update().get(pk=game_id)
        if g.status != PondsteadGame.STATUS_ACTIVE:
            return False, None
        if g.last_calendar_new_day_phx_date is not None and g.last_calendar_new_day_phx_date >= today:
            return False, None
        latest = PondsteadGameState.objects.filter(game=g).order_by("-revision").first()
        if not latest:
            return False, None
        start_revision = latest.revision
        fb = _fallback_seat_strings(g)
        world, _ = unwrap_world_json(latest.world_json, fallback_seats=fb)
        names = {}
        for p in g.players.all().order_by("seat_index"):
            uname = ""
            if p.user_id:
                uname = getattr(p.user, "username", "") or ""
            names[str(p.seat_index)] = (p.display_name or uname or "Player")[:120]
        current_day = g.current_day

    try:
        out = run_pondstead_new_day_subprocess(
            sync_world=world,
            current_day=current_day,
            player_names_by_seat=names,
        )
    except Exception:
        return False, None

    purse_keys = list((out.get("pursesBySeat") or {}).keys())
    empty_scouted = out.get("scoutedTodayBySeat") or {k: [] for k in purse_keys}
    empty_mov = out.get("stackMovementBySeat") or {k: {} for k in purse_keys}

    new_world = {
        "map": out["map"],
        "stacks": out["stacks"],
        "recruitQueues": out.get("recruitQueues") or {},
        "pursesBySeat": out.get("pursesBySeat") or {},
        "bonusPointsBySeat": out.get("bonusPointsBySeat") or {},
        "revealedBySeat": out.get("revealedBySeat") or {},
        "scoutedTodayBySeat": empty_scouted,
        "stackMovementBySeat": empty_mov,
        "recruitUsedThisDayKeys": out.get("recruitUsedThisDayKeys") or [],
        "day": int(out.get("nextDay") or current_day + 1),
    }
    reports = out.get("dailyReportsBySeat")

    with transaction.atomic():
        g = PondsteadGame.objects.select_for_update().get(pk=game_id)
        today2 = phoenix_campaign_calendar_date()
        if g.last_calendar_new_day_phx_date is not None and g.last_calendar_new_day_phx_date >= today2:
            return False, None
        latest2 = PondsteadGameState.objects.filter(game=g).order_by("-revision").first()
        if not latest2 or latest2.revision != start_revision:
            return False, None
        sk_list = [str(p.seat_index) for p in g.players.all().order_by("seat_index")] or purse_keys
        empty_undo = {k: [] for k in sk_list}
        wrapped = wrap_world_json(
            new_world,
            empty_undo,
            seat_keys_to_retain=sk_list,
        )
        new_rev = latest2.revision + 1
        PondsteadGameState.objects.create(game=g, revision=new_rev, world_json=wrapped)
        PondsteadDayLog.objects.create(
            game=g,
            day=int(out["nextDay"]),
            log_json={"reports": reports or {}, "auto_calendar": True},
        )
        g.current_day = int(out["nextDay"])
        g.last_calendar_new_day_phx_date = today2
        g.save(update_fields=["current_day", "last_calendar_new_day_phx_date", "updated_at"])
        _try_finish_campaign_if_victory(g.pk, new_world)
        sync_player_private_states_from_world(g.pk, new_world, empty_undo)
        sync_shared_world_from_world_blob(g.pk, new_world, new_rev)

    return True, reports if isinstance(reports, dict) else None


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def game_detail(request, game_id: int):
    game = get_object_or_404(PondsteadGame, pk=game_id)
    uid = request.user.id
    if not (
        game.owner_id == uid
        or game.players.filter(user_id=uid).exists()
        or game.invites.filter(invitee_id=uid).exists()
    ):
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

    did, reports = _maybe_advance_calendar_new_day(game_id)
    game = PondsteadGame.objects.get(pk=game_id)

    player_row = game.players.filter(user_id=uid).first()
    if not player_row:
        return Response(
            {"detail": "Campaign play requires an accepted seat."},
            status=status.HTTP_403_FORBIDDEN,
        )

    latest = PondsteadGameState.objects.filter(game=game).order_by("-revision").first()
    if not latest:
        return Response({"detail": "No state."}, status=status.HTTP_404_NOT_FOUND)
    fb = _fallback_seat_strings(game)
    server_world, undo = unwrap_world_json(latest.world_json, fallback_seats=fb)
    viewer_seat = int(player_row.seat_index)
    try:
        world_view = filter_world_snapshot_for_viewer(copy.deepcopy(server_world), viewer_seat)
    except Exception:
        world_view = server_world

    rp = reports if isinstance(reports, dict) else None
    if did and isinstance(rp, dict):
        sk = str(viewer_seat)
        lone = rp.get(sk)
        rp = {sk: lone} if lone is not None else {}

    winner_payload = None
    if game.status == PondsteadGame.STATUS_FINISHED and game.winner_player_id:
        wp = PondsteadPlayer.objects.filter(pk=game.winner_player_id).first()
        if wp:
            winner_payload = {"seat_index": wp.seat_index, "pondstead_player_id": wp.pk, "user_id": wp.user_id}

    payload: dict[str, Any] = {
        "id": game.id,
        "status": game.status,
        "current_day": game.current_day,
        "revision": latest.revision,
        "world": world_view,
        "world_json": world_view,
        "undo_stacks_by_seat": undo,
        "my_seat_index": viewer_seat,
        "players": [_player_row(p) for p in game.players.all().order_by("seat_index")],
        "calendar_auto_new_day": did,
        "calendar_daily_reports_by_seat": rp,
    }
    if winner_payload:
        payload["winner"] = winner_payload
    return Response(payload, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def game_end_day(request, game_id: int):
    game = get_object_or_404(PondsteadGame, pk=game_id)
    player_row = game.players.filter(user_id=request.user.id).first()
    if not player_row:
        return Response({"detail": "Not a campaign player."}, status=403)
    return Response(
        {
            "detail": "Manual end day has been retired — the campaign advances when you open the map on a new calendar day.",
        },
        status=status.HTTP_410_GONE,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def game_patch_world(request, game_id: int):
    """Mid-turn authoritative world + undo stacks (expects full world dict + undo_stacks_by_seat)."""
    game = get_object_or_404(PondsteadGame, pk=game_id)
    player_row = game.players.filter(user_id=request.user.id).first()
    if not player_row:
        return Response({"detail": "Not a campaign player."}, status=403)
    if game.status != PondsteadGame.STATUS_ACTIVE:
        return Response({"detail": "Game not active."}, status=status.HTTP_400_BAD_REQUEST)
    latest = PondsteadGameState.objects.filter(game=game).order_by("-revision").first()
    if not latest:
        return Response({"detail": "No state."}, status=status.HTTP_404_NOT_FOUND)
    body = request.data if isinstance(request.data, dict) else {}
    er = body.get("expected_revision")
    if er is None or int(er) != latest.revision:
        return Response({"detail": "Revision mismatch.", "current_revision": latest.revision}, status=409)
    world = body.get("world")
    undo = body.get("undo_stacks_by_seat")
    if not isinstance(world, dict) or not isinstance(undo, dict):
        return Response({"detail": "world and undo_stacks_by_seat required."}, status=400)
    fb = _fallback_seat_strings(game)
    server_world, server_undo = unwrap_world_json(latest.world_json, fallback_seats=fb)
    merged_w = _merge_world_seat_safe(world, server_world, player_row.seat_index, fb)
    merged_u = _merge_undo_for_patch(undo, server_undo, player_row.seat_index, fb)
    wrapped = wrap_world_json(merged_w, merged_u, seat_keys_to_retain=list(fb))
    with transaction.atomic():
        new_rev = latest.revision + 1
        PondsteadGameState.objects.create(game=game, revision=new_rev, world_json=wrapped)
        game.last_activity_at = timezone.now()
        game.save(update_fields=["last_activity_at", "updated_at"])
        _try_finish_campaign_if_victory(game.pk, merged_w)
        sync_player_private_states_from_world(game.pk, merged_w, merged_u)
        sync_shared_world_from_world_blob(game.pk, merged_w, new_rev)
    return Response({"revision": new_rev}, status=200)


def _snapshot_to_world(snap: dict[str, Any]) -> dict[str, Any]:
    w = {
        "map": snap["map"],
        "stacks": snap.get("stacks") or [],
        "recruitQueues": snap.get("recruitQueues") or {},
        "pursesBySeat": snap.get("pursesBySeat") or {},
        "bonusPointsBySeat": snap.get("bonusPointsBySeat") or {},
        "revealedBySeat": snap.get("revealedBySeat") or {},
        "scoutedTodayBySeat": snap.get("scoutedTodayBySeat") or {},
    }
    if snap.get("stackMovementBySeat") is not None:
        w["stackMovementBySeat"] = snap["stackMovementBySeat"]
    if snap.get("recruitUsedThisDayKeys") is not None:
        w["recruitUsedThisDayKeys"] = snap["recruitUsedThisDayKeys"]
    if snap.get("day") is not None:
        w["day"] = snap["day"]
    return w


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def game_undo(request, game_id: int):
    """Pop requesting user's seat undo stack and restore world from prior snapshot (revision check)."""
    game = get_object_or_404(PondsteadGame, pk=game_id)
    player = game.players.filter(user_id=request.user.id).first()
    if not player:
        return Response({"detail": "Not a player."}, status=403)
    seat = str(player.seat_index)
    latest = PondsteadGameState.objects.filter(game=game).order_by("-revision").first()
    if not latest:
        return Response({"detail": "No state."}, status=404)
    body = request.data if isinstance(request.data, dict) else {}
    if body.get("expected_revision") is None or int(body["expected_revision"]) != latest.revision:
        return Response({"detail": "Revision mismatch.", "current_revision": latest.revision}, status=409)
    fb = _fallback_seat_strings(game)
    world, undo = unwrap_world_json(latest.world_json, fallback_seats=fb)
    stack = list(undo.get(seat) or [])
    if not stack:
        return Response({"detail": "Nothing to undo."}, status=400)
    snap = stack.pop()
    undo[seat] = stack
    new_world = _snapshot_to_world(snap)
    wrapped = wrap_world_json(new_world, undo, seat_keys_to_retain=list(fb))
    with transaction.atomic():
        new_rev = latest.revision + 1
        PondsteadGameState.objects.create(game=game, revision=new_rev, world_json=wrapped)
        game.last_activity_at = timezone.now()
        game.save(update_fields=["last_activity_at", "updated_at"])
        sync_player_private_states_from_world(game.pk, new_world, undo)
        sync_shared_world_from_world_blob(game.pk, new_world, new_rev)
    try:
        world_out = filter_world_snapshot_for_viewer(copy.deepcopy(new_world), int(player.seat_index))
    except Exception:
        world_out = new_world
    return Response(
        {
            "revision": new_rev,
            "world": world_out,
            "undo_stacks_by_seat": undo,
            "current_day": game.current_day,
        },
        status=200,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def campaigns_invitee_search(request, game_id: int):
    game = get_object_or_404(PondsteadGame, pk=game_id)
    if game.owner_id != request.user.id:
        return Response({"detail": "Forbidden."}, status=403)
    q = (request.query_params.get("q") or "").strip()
    if len(q) < 2:
        return Response([])
    from users.avatar_url import profile_avatar_url

    rows = []
    for u in _approved_invitee_candidates_qs(owner=request.user, search=q):
        profile = getattr(u, "profile", None)
        nick = (profile.display_name if profile else "") or u.email.split("@")[0]
        rows.append(
            {
                "id": u.id,
                "email": u.email,
                "nickname": nick.strip(),
                "avatar_url": profile_avatar_url(profile) if profile else "",
            }
        )
    return Response(rows)
