from __future__ import annotations

from collections import defaultdict

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .bot_user import get_computer_user, is_computer_user
from .models import EstatesGame, EstatesPlayerState, EstatesUserStats

User = get_user_model()

ZONE_FIELD_BY_NAME = {
    "farm": "zone_farm_wins",
    "road": "zone_road_wins",
    "tower": "zone_tower_wins",
    "gate": "zone_gate_wins",
    "throne": "zone_throne_wins",
}

ACHIEVEMENT_THRESHOLDS = {
    "noble": 10,
    "royal": 5,
    "peasant": 5,
    "zone_badges": 50,
}


def _get_or_create_stats(user_id: int) -> EstatesUserStats:
    stats, _ = EstatesUserStats.objects.get_or_create(user_id=user_id)
    return stats


def record_estates_zone_win(user_id: int, zone_name: str) -> None:
    field = ZONE_FIELD_BY_NAME.get(zone_name)
    if field is None:
        return
    user = User.objects.filter(pk=user_id).first()
    if user is None or is_computer_user(user):
        return

    from achievements.services import evaluate_estates_achievements_for_user

    with transaction.atomic():
        stats = _get_or_create_stats(user_id)
        current = getattr(stats, field)
        setattr(stats, field, current + 1)
        stats.save(update_fields=[field, "updated_at"])
    evaluate_estates_achievements_for_user(user_id)


def evaluate_estates_stunt_zone_win_achievements(
    *,
    game: EstatesGame,
    user_id: int,
    zone_name: str,
    winning_card: dict | None,
) -> None:
    from achievements.services import evaluate_estates_stunt_zone_win_achievements as unlock

    unlock(
        game=game,
        user_id=user_id,
        zone_name=zone_name,
        winning_card=winning_card,
    )


def record_estates_game_completed(game: EstatesGame) -> None:
    if game.status != EstatesGame.Status.COMPLETED:
        return

    from achievements.services import evaluate_estates_achievements_for_user

    human_user_ids: list[int] = []
    with transaction.atomic():
        locked = EstatesGame.objects.select_for_update().get(pk=game.pk)
        if locked.stats_recorded_at is not None:
            return

        player_rows = list(
            EstatesPlayerState.objects.filter(game=locked).select_related("user")
        )
        for row in player_rows:
            if is_computer_user(row.user):
                continue
            human_user_ids.append(row.user_id)
            stats = _get_or_create_stats(row.user_id)
            stats.games_completed += 1
            stats.save(update_fields=["games_completed", "updated_at"])

        winner = locked.winner_user
        if winner is not None and not is_computer_user(winner):
            stats = _get_or_create_stats(winner.id)
            if locked.is_solo:
                stats.solo_wins += 1
                stats.save(update_fields=["solo_wins", "updated_at"])
            else:
                stats.pvp_wins += 1
                stats.save(update_fields=["pvp_wins", "updated_at"])

        locked.stats_recorded_at = timezone.now()
        locked.save(update_fields=["stats_recorded_at", "updated_at"])

    for user_id in human_user_ids:
        evaluate_estates_achievements_for_user(user_id)


def serialize_estates_user_stats(stats: EstatesUserStats | None) -> dict:
    if stats is None:
        return {
            "games_completed": 0,
            "pvp_wins": 0,
            "solo_wins": 0,
            "zone_wins": {
                "farm": 0,
                "road": 0,
                "tower": 0,
                "gate": 0,
                "throne": 0,
            },
            "achievement_thresholds": ACHIEVEMENT_THRESHOLDS,
        }
    return {
        "games_completed": stats.games_completed,
        "pvp_wins": stats.pvp_wins,
        "solo_wins": stats.solo_wins,
        "zone_wins": {
            "farm": stats.zone_farm_wins,
            "road": stats.zone_road_wins,
            "tower": stats.zone_tower_wins,
            "gate": stats.zone_gate_wins,
            "throne": stats.zone_throne_wins,
        },
        "achievement_thresholds": ACHIEVEMENT_THRESHOLDS,
    }


def backfill_estates_match_stats_from_history() -> None:
    """Rebuild match-level counters from completed games; zone wins stay as-is."""
    from achievements.services import evaluate_estates_achievements_for_user

    try:
        computer_id = get_computer_user().id
    except User.DoesNotExist:
        computer_id = None

    counts: dict[int, dict[str, int]] = defaultdict(
        lambda: {"games_completed": 0, "pvp_wins": 0, "solo_wins": 0}
    )
    completed = EstatesGame.objects.filter(status=EstatesGame.Status.COMPLETED)
    for game in completed.iterator():
        player_ids = list(
            EstatesPlayerState.objects.filter(game=game).values_list("user_id", flat=True)
        )
        for user_id in player_ids:
            if computer_id is not None and user_id == computer_id:
                continue
            counts[user_id]["games_completed"] += 1
        winner_id = game.winner_user_id
        if winner_id is None or (computer_id is not None and winner_id == computer_id):
            continue
        if game.is_solo:
            counts[winner_id]["solo_wins"] += 1
        else:
            counts[winner_id]["pvp_wins"] += 1

    for user_id, row in counts.items():
        stats, _ = EstatesUserStats.objects.get_or_create(user_id=user_id)
        stats.games_completed = row["games_completed"]
        stats.pvp_wins = row["pvp_wins"]
        stats.solo_wins = row["solo_wins"]
        stats.save(update_fields=["games_completed", "pvp_wins", "solo_wins", "updated_at"])
        evaluate_estates_achievements_for_user(user_id)

    now = timezone.now()
    completed.filter(stats_recorded_at__isnull=True).update(stats_recorded_at=now)
