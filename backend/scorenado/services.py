from __future__ import annotations

from collections import defaultdict

from scorenado.game_access import (
    can_edit_game,
    is_game_owner,
    serialize_user_summary,
)
from scorenado.inbox import serialize_player_row
from scorenado.models import Game, GameCategory, GamePlayer, ScoreboardTemplate


def player_totals_from_score_rows(
    game: Game,
    *,
    categories: list[GameCategory],
) -> dict[str, int | None]:
    """Sum all scored category values across every round."""
    scored_cat_ids = {c.id for c in categories if c.is_scored}
    totals: dict[str, int | None] = {
        str(p.id): 0 for p in game.players.all()
    }
    for row in game.scores.all():
        if row.category_id not in scored_cat_ids:
            continue
        if row.value is None:
            continue
        pid = str(row.player_id)
        totals[pid] = (totals[pid] or 0) + row.value
    return totals


def winner_player_ids(
    game: Game,
    *,
    players: list[GamePlayer],
    totals: dict[str, int | None],
) -> list[str]:
    if not players:
        return []
    low_wins = game.snapshot_low_score_wins
    scored = [
        (str(p.id), totals.get(str(p.id)))
        for p in players
        if totals.get(str(p.id)) is not None
    ]
    if not scored:
        return []
    if low_wins:
        best_val = min(v for _, v in scored if v is not None)
        return [pid for pid, v in scored if v == best_val]
    best_val = max(v for _, v in scored if v is not None)
    return [pid for pid, v in scored if v == best_val]


def snapshot_template_onto_game(game: Game, template: ScoreboardTemplate) -> None:
    """Copy template categories onto a game (metadata is stored on Game at creation)."""
    GameCategory.objects.bulk_create(
        [
            GameCategory(
                game=game,
                name=row.name,
                description=row.description,
                sort_order=row.sort_order,
                is_scored=row.is_scored,
            )
            for row in template.categories.all().order_by("sort_order", "id")
        ]
    )


def build_game_payload(game: Game, *, user) -> dict:
    """Nested game dict for API responses."""
    template = game.template
    categories = list(game.categories.all())
    players = list(game.players.all())
    round_based = game.snapshot_scored_by_rounds
    round_count = game.round_count if round_based else 1
    owner = is_game_owner(game, user)

    by_cat_round: dict[str, dict[str, dict[str, int | None]]] = defaultdict(
        lambda: defaultdict(dict)
    )
    for row in game.scores.all():
        by_cat_round[str(row.category_id)][str(row.round_number)][
            str(row.player_id)
        ] = row.value

    cat_payload = []
    for cat in categories:
        cat_id = str(cat.id)
        round_maps = by_cat_round.get(cat_id, {})
        if round_based:
            scores_by_round = {
                str(rn): round_maps.get(str(rn), {}) for rn in range(1, round_count + 1)
            }
            scores = scores_by_round.get("1", {})
        else:
            scores_by_round = None
            scores = round_maps.get("1", {})

        entry = {
            "id": cat_id,
            "name": cat.name,
            "description": cat.description,
            "sort_order": cat.sort_order,
            "is_scored": cat.is_scored,
            "scores": scores,
        }
        if scores_by_round is not None:
            entry["scores_by_round"] = scores_by_round
        cat_payload.append(entry)

    totals = player_totals_from_score_rows(game, categories=categories)
    winners = winner_player_ids(game, players=players, totals=totals)

    return {
        "id": str(game.id),
        "title": game.title,
        "played_at": game.played_at.isoformat() if game.played_at else None,
        "is_finalized": game.is_finalized,
        "notes": game.notes,
        "round_count": round_count,
        "created_at": game.created_at.isoformat(),
        "updated_at": game.updated_at.isoformat(),
        "is_owner": owner,
        "can_edit": can_edit_game(game, user),
        "owner_user": serialize_user_summary(game.owner_user),
        "template": {
            "id": str(template.id),
            "name": game.snapshot_template_name,
            "scored_by_rounds": round_based,
            "low_score_wins": game.snapshot_low_score_wins,
            "min_players": template.min_players,
            "categories": cat_payload,
        },
        "players": [
            {
                **serialize_player_row(p),
                "total": totals.get(str(p.id)),
                "is_winner": str(p.id) in winners,
            }
            for p in players
        ],
        "tags": [
            {
                "id": str(tag.id),
                "label": tag.label,
                "player_id": str(tag.player_id) if tag.player_id else None,
            }
            for tag in game.tags.all()
        ],
    }


def build_stats_payload(*, user) -> dict:
    from scorenado.game_access import games_for_user_qs

    finalized = games_for_user_qs(user).filter(is_finalized=True)
    owned = finalized.filter(owner_user=user).count()
    participated = finalized.filter(players__claimed_user=user).distinct().count()
    wins = 0
    for game in finalized.prefetch_related("players", "categories"):
        players = list(game.players.all())
        categories = list(game.categories.all())
        totals = player_totals_from_score_rows(game, categories=categories)
        winner_ids = winner_player_ids(game, players=players, totals=totals)
        for pid in winner_ids:
            player = next((p for p in players if str(p.id) == pid), None)
            if player and player.claimed_user_id == user.id:
                wins += 1
                break
    return {
        "games_owned": owned,
        "games_participated": participated,
        "wins": wins,
    }
