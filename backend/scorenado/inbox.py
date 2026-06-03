from __future__ import annotations

from scorenado.game_access import serialize_user_summary
from scorenado.models import Game, GamePlayer


def pending_seat_invites_payload(*, user) -> list[dict]:
    rows = (
        GamePlayer.objects.filter(
            invited_user=user,
            invite_status=GamePlayer.INVITE_PENDING,
        )
        .select_related("game", "game__owner_user", "game__owner_user__profile")
        .order_by("-game__updated_at", "-created_at")
    )
    out: list[dict] = []
    for row in rows:
        game = row.game
        out.append(
            {
                "player_id": str(row.id),
                "game_id": str(game.id),
                "game_title": game.title or game.snapshot_template_name,
                "slot_display_name": row.display_name,
                "owner_label": _owner_label(game),
            }
        )
    return out


def _owner_label(game: Game) -> str:
    owner = game.owner_user
    profile = getattr(owner, "profile", None)
    name = (getattr(profile, "display_name", None) or "").strip()
    if name:
        return name
    return getattr(owner, "email", None) or "Someone"


def serialize_player_row(player: GamePlayer) -> dict:
    return {
        "id": str(player.id),
        "display_name": player.display_name,
        "color": player.color,
        "sort_order": player.sort_order,
        "team": player.team,
        "invite_status": player.invite_status,
        "invited_user": serialize_user_summary(player.invited_user),
        "claimed_user": serialize_user_summary(player.claimed_user),
    }
