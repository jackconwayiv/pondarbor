from __future__ import annotations

from django.db.models import Prefetch, Q, QuerySet

from scorenado.models import Game, GameCategory, GamePlayer


INVITE_PENDING = GamePlayer.INVITE_PENDING
INVITE_ACCEPTED = GamePlayer.INVITE_ACCEPTED
INVITE_REJECTED = GamePlayer.INVITE_REJECTED
INVITE_CANCELLED = GamePlayer.INVITE_CANCELLED


def games_for_user_qs(user) -> QuerySet:
    """Games the user owns, has claimed a seat on, or has a pending seat invite for."""
    return (
        Game.objects.filter(
            Q(owner_user=user)
            | Q(players__claimed_user=user)
            | Q(
                players__invited_user=user,
                players__invite_status=INVITE_PENDING,
            )
        )
        .distinct()
        .select_related("template", "owner_user")
        .prefetch_related(
            Prefetch(
                "categories",
                queryset=GameCategory.objects.order_by("sort_order", "id"),
            ),
            Prefetch(
                "players",
                queryset=GamePlayer.objects.select_related(
                    "invited_user",
                    "invited_user__profile",
                    "claimed_user",
                    "claimed_user__profile",
                ).order_by("sort_order", "id"),
            ),
            "scores",
            "tags",
        )
    )


def game_for_user_or_404(user, game_id) -> Game:
    from django.shortcuts import get_object_or_404

    return get_object_or_404(games_for_user_qs(user), pk=game_id)


def is_game_owner(game: Game, user) -> bool:
    return game.owner_user_id == user.id


def player_for_user(game: Game, user) -> GamePlayer | None:
    for row in game.players.all():
        if row.claimed_user_id == user.id:
            return row
        if (
            row.invited_user_id == user.id
            and row.invite_status == INVITE_PENDING
        ):
            return row
    return None


def can_view_game(game: Game, user) -> bool:
    if is_game_owner(game, user):
        return True
    return player_for_user(game, user) is not None


def can_edit_game(game: Game, user) -> bool:
    return is_game_owner(game, user) and not game.is_finalized


def can_score_game(game: Game, user) -> bool:
    return can_edit_game(game, user)


def user_display_label(user) -> str:
    if user is None:
        return ""
    profile = getattr(user, "profile", None)
    name = (getattr(profile, "display_name", None) or "").strip()
    if name:
        return name
    return getattr(user, "email", None) or getattr(user, "username", "User")


def serialize_user_summary(user) -> dict | None:
    if user is None:
        return None
    from users.avatar_url import profile_avatar_url

    profile = getattr(user, "profile", None)
    return {
        "id": user.id,
        "display_name": user_display_label(user),
        "avatar_url": profile_avatar_url(profile) if profile else "",
    }
