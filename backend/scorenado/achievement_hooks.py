from __future__ import annotations

from scorenado.models import Game, GamePlayer


def scorenado_participant_user_ids(game: Game) -> set[int]:
    ids = {game.owner_user_id}
    ids.update(
        GamePlayer.objects.filter(game=game, claimed_user_id__isnull=False).values_list(
            "claimed_user_id",
            flat=True,
        )
    )
    return ids


def notify_scorenado_game_finalized(game_id) -> None:
    from achievements.services import evaluate_scorenado_achievements_for_user

    game = Game.objects.filter(pk=game_id).only("owner_user_id").first()
    if game is None:
        return
    for user_id in scorenado_participant_user_ids(game):
        evaluate_scorenado_achievements_for_user(user_id)


def notify_scorenado_template_owner(user_id: int) -> None:
    from achievements.services import evaluate_scorenado_achievements_for_user

    evaluate_scorenado_achievements_for_user(user_id)
