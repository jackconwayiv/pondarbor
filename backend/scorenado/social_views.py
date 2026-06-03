from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from friends.services import are_friends
from scorenado.game_access import (
    can_edit_game,
    game_for_user_or_404,
    is_game_owner,
)
from scorenado.inbox import pending_seat_invites_payload
from scorenado.models import GamePlayer, GameTag
from scorenado.serializers import (
    GameTagCreateSerializer,
    SeatInviteSerializer,
)
from scorenado.services import build_game_payload, build_stats_payload
from scorenado.views import _require_approved

User = get_user_model()


def _reload_game(user, game_id):
    return game_for_user_or_404(user, game_id)


def _player_or_404(game, player_id) -> GamePlayer:
    return get_object_or_404(GamePlayer, pk=player_id, game=game)


def _clear_seat_invite(player: GamePlayer) -> None:
    player.invited_user = None
    player.invite_status = None


def _claimed_slot_for_user(game, user) -> GamePlayer | None:
    return GamePlayer.objects.filter(game=game, claimed_user=user).first()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def invites_pending(request):
    err = _require_approved(request)
    if err:
        return err
    return Response(pending_seat_invites_payload(user=request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def invites_accept(request, player_id):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    player = get_object_or_404(
        GamePlayer.objects.select_related("game"),
        pk=player_id,
        invited_user=user,
        invite_status=GamePlayer.INVITE_PENDING,
    )
    game = player.game
    if _claimed_slot_for_user(game, user):
        return Response(
            {"detail": "You already have a seat in this game."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    with transaction.atomic():
        player.claimed_user = user
        player.invite_status = GamePlayer.INVITE_ACCEPTED
        player.save(update_fields=["claimed_user", "invite_status"])
    return Response(build_game_payload(_reload_game(user, game.id), user=user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def invites_reject(request, player_id):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    player = get_object_or_404(
        GamePlayer,
        pk=player_id,
        invited_user=user,
        invite_status=GamePlayer.INVITE_PENDING,
    )
    with transaction.atomic():
        _clear_seat_invite(player)
        player.invite_status = GamePlayer.INVITE_REJECTED
        player.save(update_fields=["invited_user", "invite_status"])
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def games_players_invite(request, game_id, player_id):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    game = _reload_game(user, game_id)
    if not can_edit_game(game, user):
        return Response(
            {"detail": "Only the game owner can invite friends."},
            status=status.HTTP_403_FORBIDDEN,
        )
    player = _player_or_404(game, player_id)
    if player.claimed_user_id:
        return Response(
            {"detail": "This seat is already claimed."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    ser = SeatInviteSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    invitee = get_object_or_404(User, pk=ser.validated_data["user_id"])
    if invitee.id == user.id:
        return Response(
            {"detail": "Cannot invite yourself."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not are_friends(user_a=user, user_b=invitee):
        return Response(
            {"detail": "You can only invite approved friends."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if GamePlayer.objects.filter(game=game, claimed_user=invitee).exists():
        return Response(
            {"detail": "That friend already has a seat in this game."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    with transaction.atomic():
        player.invited_user = invitee
        player.invite_status = GamePlayer.INVITE_PENDING
        player.save(update_fields=["invited_user", "invite_status"])
    return Response(build_game_payload(_reload_game(user, game.id), user=user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def games_players_cancel_invite(request, game_id, player_id):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    game = _reload_game(user, game_id)
    if not can_edit_game(game, user):
        return Response(
            {"detail": "Only the game owner can cancel invites."},
            status=status.HTTP_403_FORBIDDEN,
        )
    player = _player_or_404(game, player_id)
    if player.invite_status != GamePlayer.INVITE_PENDING:
        return Response(
            {"detail": "No pending invite on this seat."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    with transaction.atomic():
        _clear_seat_invite(player)
        player.invite_status = GamePlayer.INVITE_CANCELLED
        player.save(update_fields=["invited_user", "invite_status"])
    return Response(build_game_payload(_reload_game(user, game.id), user=user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def games_players_unclaim(request, game_id, player_id):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    game = _reload_game(user, game_id)
    if not is_game_owner(game, user):
        return Response(
            {"detail": "Only the game owner can unclaim a seat."},
            status=status.HTTP_403_FORBIDDEN,
        )
    player = _player_or_404(game, player_id)
    if not player.claimed_user_id:
        return Response(
            {"detail": "This seat is not claimed."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    with transaction.atomic():
        player.claimed_user = None
        _clear_seat_invite(player)
        player.save(update_fields=["claimed_user", "invited_user", "invite_status"])
    return Response(build_game_payload(_reload_game(user, game.id), user=user))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def stats_summary(request):
    err = _require_approved(request)
    if err:
        return err
    return Response(build_stats_payload(user=request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def games_tags_collection(request, game_id):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    game = _reload_game(user, game_id)
    if not can_edit_game(game, user):
        return Response(
            {"detail": "Only the game owner can add tags."},
            status=status.HTTP_403_FORBIDDEN,
        )
    ser = GameTagCreateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data
    player = None
    if data.get("player_id"):
        player = _player_or_404(game, data["player_id"])
    tag = GameTag.objects.create(
        game=game,
        player=player,
        label=data["label"].strip(),
    )
    return Response(
        {
            "id": str(tag.id),
            "label": tag.label,
            "player_id": str(player.id) if player else None,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def games_tags_detail(request, game_id, tag_id):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    game = _reload_game(user, game_id)
    if not can_edit_game(game, user):
        return Response(
            {"detail": "Only the game owner can remove tags."},
            status=status.HTTP_403_FORBIDDEN,
        )
    tag = get_object_or_404(GameTag, pk=tag_id, game=game)
    tag.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
