from __future__ import annotations

from django.db import transaction
from django.db.models import F, Max, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from scorenado.game_access import (
    can_edit_game,
    can_score_game,
    game_for_user_or_404,
    games_for_user_qs,
    is_game_owner,
)
from scorenado.models import (
    MAX_PLAYERS_PER_GAME,
    Game,
    GameCategory,
    GamePlayer,
    Score,
    ScoreboardTemplate,
    TemplateCategory,
)
from scorenado.serializers import (
    GameCreateSerializer,
    GamePatchSerializer,
    GamePlayerCreateSerializer,
    GamePlayerPatchSerializer,
    ScoreUpsertSerializer,
    TemplateCategoryInputSerializer,
    TemplateCreateSerializer,
    TemplatePatchSerializer,
)
from scorenado.services import build_game_payload, snapshot_template_onto_game
from users.models import User
from users.permissions import IsApprovedUser


def _require_approved(request):
    if not request.user or not request.user.is_authenticated:
        return Response(
            {"detail": "Authentication required."},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    if request.user.account_status != User.AccountStatus.APPROVED:
        return Response(
            {"detail": IsApprovedUser.message},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _games_qs(user):
    return games_for_user_qs(user)


def _game_or_404(user, game_id):
    return game_for_user_or_404(user, game_id)


def _accessible_templates_qs(user):
    invited_private = Q(
        is_published=False,
        games__players__invited_user=user,
        games__players__invite_status__in=(
            GamePlayer.INVITE_PENDING,
            GamePlayer.INVITE_ACCEPTED,
        ),
    ) | Q(
        games__players__claimed_user=user,
    )
    return (
        ScoreboardTemplate.objects.filter(
            Q(owner_user=user)
            | Q(is_published=True)
            | invited_private
        )
        .distinct()
        .annotate(
            last_played_at=Max(
                "games__updated_at",
                filter=Q(games__owner_user_id=user.id),
            )
        )
        .prefetch_related(
            Prefetch(
                "categories",
                queryset=TemplateCategory.objects.order_by("sort_order", "id"),
            )
        )
    )


def _accessible_template_or_404(user, template_id):
    return get_object_or_404(_accessible_templates_qs(user), pk=template_id)


def _serialize_template(template: ScoreboardTemplate, user) -> dict:
    last_played = getattr(template, "last_played_at", None)
    is_published = template.is_published
    can_edit = template.owner_user_id == user.id
    return {
        "id": str(template.id),
        "name": template.name,
        "scored_by_rounds": template.scored_by_rounds,
        "low_score_wins": template.low_score_wins,
        "min_players": template.min_players,
        "default_round_count": template.default_round_count,
        "is_published": is_published,
        "can_edit": can_edit,
        "created_at": template.created_at.isoformat(),
        "updated_at": template.updated_at.isoformat(),
        "last_played_at": last_played.isoformat() if last_played else None,
        "categories": [
            {
                "id": str(c.id),
                "name": c.name,
                "description": c.description,
                "sort_order": c.sort_order,
                "is_scored": c.is_scored,
            }
            for c in template.categories.all()
        ],
    }


def _replace_categories(template: ScoreboardTemplate, categories_data: list) -> None:
    template.categories.all().delete()
    for idx, row in enumerate(categories_data):
        TemplateCategory.objects.create(
            template=template,
            name=row["name"],
            description=row.get("description", ""),
            sort_order=row.get("sort_order", idx),
            is_scored=row.get("is_scored", True),
        )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def templates_collection(request):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    if request.method == "GET":
        templates = list(
            _accessible_templates_qs(user).order_by("-updated_at", "-created_at")
        )
        return Response([_serialize_template(t, user) for t in templates])
    ser = TemplateCreateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data
    with transaction.atomic():
        template = ScoreboardTemplate.objects.create(
            owner_user=user,
            name=data["name"],
            scored_by_rounds=data.get("scored_by_rounds", False),
            low_score_wins=data.get("low_score_wins", False),
            min_players=data.get("min_players", 2),
            default_round_count=data.get("default_round_count", 3),
            is_published=data.get("is_published", False),
        )
        cats = data.get("categories") or []
        if cats:
            cat_ser = TemplateCategoryInputSerializer(data=cats, many=True)
            cat_ser.is_valid(raise_exception=True)
            _replace_categories(template, cat_ser.validated_data)
    template = _accessible_template_or_404(user, template.id)
    from scorenado.achievement_hooks import notify_scorenado_template_owner

    notify_scorenado_template_owner(user.id)
    return Response(_serialize_template(template, user), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def templates_detail(request, template_id):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    template = _accessible_template_or_404(user, template_id)
    if request.method == "GET":
        return Response(_serialize_template(template, user))
    if template.owner_user_id != user.id:
        return Response(
            {"detail": "Not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    if request.method == "DELETE":
        if template.games.exists():
            return Response(
                {"detail": "Cannot delete a template used by games."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    ser = TemplatePatchSerializer(data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data
    with transaction.atomic():
        for field in (
            "name",
            "scored_by_rounds",
            "low_score_wins",
            "min_players",
            "default_round_count",
            "is_published",
        ):
            if field in data:
                setattr(template, field, data[field])
        if data:
            template.save()
        if "categories" in data:
            cat_ser = TemplateCategoryInputSerializer(data=data["categories"], many=True)
            cat_ser.is_valid(raise_exception=True)
            _replace_categories(template, cat_ser.validated_data)
    template = _accessible_template_or_404(user, template.id)
    from scorenado.achievement_hooks import notify_scorenado_template_owner

    notify_scorenado_template_owner(user.id)
    return Response(_serialize_template(template, user))


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def games_collection(request):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    if request.method == "GET":
        games = _games_qs(user).order_by(
            F("played_at").desc(nulls_last=True),
            "-updated_at",
        )
        return Response(
            [
                {
                    "id": str(g.id),
                    "title": g.title or g.snapshot_template_name,
                    "played_at": g.played_at.isoformat() if g.played_at else None,
                    "is_finalized": g.is_finalized,
                    "template_name": g.snapshot_template_name,
                    "player_count": g.players.count(),
                    "updated_at": g.updated_at.isoformat(),
                    "is_owner": is_game_owner(g, user),
                }
                for g in games
            ]
        )
    ser = GameCreateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data
    template = _accessible_template_or_404(user, data["template_id"])
    players_in = data.get("players") or []
    if not players_in:
        players_in = [
            {"display_name": f"P{i}", "sort_order": i - 1}
            for i in range(1, template.min_players + 1)
        ]
    if len(players_in) < template.min_players:
        return Response(
            {
                "detail": (
                    f"At least {template.min_players} "
                    f"player{'s' if template.min_players != 1 else ''} required."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(players_in) > MAX_PLAYERS_PER_GAME:
        return Response(
            {"detail": f"At most {MAX_PLAYERS_PER_GAME} players per game."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    round_count = 1
    if template.scored_by_rounds:
        round_count = data.get("round_count") or template.default_round_count
    with transaction.atomic():
        game = Game.objects.create(
            owner_user=user,
            template=template,
            snapshot_template_name=template.name,
            snapshot_scored_by_rounds=template.scored_by_rounds,
            snapshot_low_score_wins=template.low_score_wins,
            title=(data.get("title") or "").strip(),
            played_at=data.get("played_at") or timezone.localdate(),
            round_count=round_count,
        )
        for idx, prow in enumerate(players_in):
            sort_order = prow.get("sort_order", idx)
            is_creator_seat = sort_order == 0
            GamePlayer.objects.create(
                game=game,
                display_name=prow["display_name"].strip(),
                color=prow.get("color", "gray.200"),
                sort_order=sort_order,
                team=(prow.get("team") or "").strip(),
                claimed_user=user if is_creator_seat else None,
                invite_status=(
                    GamePlayer.INVITE_ACCEPTED if is_creator_seat else None
                ),
            )
        snapshot_template_onto_game(game, template)
    game = _game_or_404(user, game.id)
    return Response(build_game_payload(game, user=user), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def games_detail(request, game_id):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    game = _game_or_404(user, game_id)
    if request.method == "GET":
        return Response(build_game_payload(game, user=user))
    if not is_game_owner(game, user):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        if not game.is_finalized:
            game.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(
            {"detail": "Finalized games cannot be deleted."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if game.is_finalized:
        return Response(
            {"detail": "Finalized games cannot be edited."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    ser = GamePatchSerializer(data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data
    for field in ("title", "played_at", "notes"):
        if field in data:
            setattr(game, field, data[field])
    if "round_count" in data:
        if not game.snapshot_scored_by_rounds:
            return Response(
                {"detail": "This game does not use rounds."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        new_count = data["round_count"]
        if new_count < game.round_count:
            return Response(
                {"detail": "Cannot remove rounds that may already have scores."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        game.round_count = new_count
    if data:
        game.save()
    game = _game_or_404(user, game.id)
    return Response(build_game_payload(game, user=user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def games_finalize(request, game_id):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    game = _game_or_404(user, game_id)
    if not is_game_owner(game, user):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    if game.is_finalized:
        return Response(build_game_payload(game, user=user))
    game.is_finalized = True
    game.save(update_fields=["is_finalized", "updated_at"])
    from scorenado.achievement_hooks import notify_scorenado_game_finalized

    notify_scorenado_game_finalized(game.id)
    game = _game_or_404(user, game.id)
    return Response(build_game_payload(game, user=user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def games_players_collection(request, game_id):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    game = _game_or_404(user, game_id)
    if not can_edit_game(game, user):
        return Response(
            {"detail": "Only the game owner can edit players."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if game.players.count() >= MAX_PLAYERS_PER_GAME:
        return Response(
            {"detail": f"At most {MAX_PLAYERS_PER_GAME} players per game."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    ser = GamePlayerCreateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data
    player = GamePlayer.objects.create(
        game=game,
        display_name=data["display_name"].strip(),
        color=data.get("color", "gray.200"),
        sort_order=data.get("sort_order", game.players.count()),
        team=(data.get("team") or "").strip(),
    )
    game = _game_or_404(user, game.id)
    payload = build_game_payload(game, user=user)
    payload["player"] = {
        "id": str(player.id),
        "display_name": player.display_name,
        "color": player.color,
        "sort_order": player.sort_order,
        "team": player.team,
    }
    return Response(payload, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def games_players_detail(request, game_id, player_id):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    game = _game_or_404(user, game_id)
    if not can_edit_game(game, user):
        return Response(
            {"detail": "Only the game owner can edit players."},
            status=status.HTTP_403_FORBIDDEN,
        )
    player = get_object_or_404(GamePlayer, pk=player_id, game=game)
    if request.method == "DELETE":
        player.delete()
        game = _game_or_404(user, game.id)
        return Response(build_game_payload(game, user=user))
    ser = GamePlayerPatchSerializer(data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data
    for field in ("display_name", "color", "sort_order", "team"):
        if field in data:
            val = data[field]
            if field == "display_name":
                val = val.strip()
            if field == "team":
                val = (val or "").strip()
            setattr(player, field, val)
    player.save()
    game = _game_or_404(user, game.id)
    return Response(build_game_payload(game, user=user))


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def games_scores_upsert(request, game_id):
    err = _require_approved(request)
    if err:
        return err
    user = request.user
    game = _game_or_404(user, game_id)
    if not can_score_game(game, user):
        return Response(
            {"detail": "Only the game owner can edit scores."},
            status=status.HTTP_403_FORBIDDEN,
        )
    ser = ScoreUpsertSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data
    category = get_object_or_404(
        GameCategory, pk=data["category_id"], game_id=game.id
    )
    player = get_object_or_404(GamePlayer, pk=data["player_id"], game=game)
    round_number = data.get("round_number") or 1
    if not game.snapshot_scored_by_rounds:
        round_number = 1
    elif round_number < 1 or round_number > game.round_count:
        return Response(
            {"detail": f"round_number must be between 1 and {game.round_count}."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    Score.objects.update_or_create(
        game=game,
        category=category,
        player=player,
        round_number=round_number,
        defaults={"value": data.get("value")},
    )
    game = _game_or_404(user, game.id)
    return Response(build_game_payload(game, user=user))
