from __future__ import annotations

from typing import Any

from rest_framework import serializers

from .constants import COMPUTER_DIFFICULTIES, COMPUTER_SEAT_INDEX
from .models import EstatesGame, EstatesPlayerState, EstatesRoundState


def _user_display_name(user, *, game: EstatesGame | None = None, seat_index: int | None = None) -> str:
    if game and game.is_solo and seat_index == COMPUTER_SEAT_INDEX:
        return "Computer"
    profile = getattr(user, "profile", None)
    if profile and (profile.display_name or "").strip():
        return (profile.display_name or "").strip()
    email = getattr(user, "email", "") or ""
    if email and "@" in email:
        return email.split("@", 1)[0]
    return getattr(user, "username", "") or f"User {user.id}"


def _user_avatar_url(user) -> str:
    profile = getattr(user, "profile", None)
    return (getattr(profile, "avatar_url", "") or "").strip()


def _player_identity_row(user, seat_index: int, *, game: EstatesGame) -> dict[str, Any]:
    return {
        "user_id": user.id,
        "seat_index": seat_index,
        "display_name": _user_display_name(user, game=game, seat_index=seat_index),
        "avatar_url": _user_avatar_url(user),
    }


def _serialize_player_state(
    obj: EstatesPlayerState,
    *,
    game: EstatesGame,
    requesting_user_id: int | None,
) -> dict[str, Any]:
    is_own = requesting_user_id is not None and obj.user_id == requesting_user_id
    hand = list(obj.hand or []) if is_own else []
    deck = list(obj.deck or []) if is_own else []
    # Spent pile is public (cards were visible on the board); only hand and deck stay hidden.
    discard = list(obj.discard or [])
    return {
        "user_id": obj.user_id,
        "seat_index": obj.seat_index,
        "display_name": _user_display_name(obj.user, game=game, seat_index=obj.seat_index),
        "avatar_url": _user_avatar_url(obj.user),
        "deck": deck,
        "hand": hand,
        "discard": discard,
        "hand_count": len(obj.hand or []),
        "deck_count": len(obj.deck or []),
        "discard_count": len(obj.discard or []),
        "draw_bonus": obj.draw_bonus,
        "is_starting_player": obj.is_starting_player,
        "score": obj.score,
    }


class LobbyCreateSerializer(serializers.Serializer):
    victory_score = serializers.IntegerField(required=False, min_value=1, max_value=50)


class SoloLobbyCreateSerializer(serializers.Serializer):
    difficulty = serializers.ChoiceField(choices=[(d, d) for d in sorted(COMPUTER_DIFFICULTIES)])


class JoinLobbySerializer(serializers.Serializer):
    pass


class LobbySettingsSerializer(serializers.Serializer):
    victory_score = serializers.IntegerField(required=True, min_value=1, max_value=50)


class EstatesRoundStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstatesRoundState
        fields = [
            "round_number",
            "phase",
            "turn_player_seat",
            "actions_taken_by_seat",
            "placements_by_zone",
            "pending_actor_seat",
            "pending_action",
            "pending_payload",
            "status_message",
            "phase_started_at",
            "connections_seat_1",
            "connections_seat_2",
            "is_paused",
            "disconnected_seat",
            "pending_computer_action_at",
        ]


def serialize_estates_game_state(
    game: EstatesGame,
    *,
    requesting_user_id: int | None = None,
) -> dict[str, Any]:
    player_1 = _player_identity_row(game.player_1, seat_index=1, game=game)
    player_2 = (
        _player_identity_row(game.player_2, seat_index=2, game=game) if game.player_2_id else None
    )
    player_states = game.player_states.select_related("user", "user__profile").order_by("seat_index")
    round_state = getattr(game, "round_state", None)
    round_data = None
    if round_state is not None:
        round_data = EstatesRoundStateSerializer(round_state).data
        if round_state.pending_computer_action_at:
            round_data["pending_computer_action_at"] = round_state.pending_computer_action_at.isoformat()

    return {
        "id": str(game.id),
        "status": game.status,
        "round": game.round,
        "is_solo": game.is_solo,
        "computer_difficulty": game.computer_difficulty or None,
        "computer_persona": game.computer_persona or None,
        "victory_score": game.victory_score,
        "player_1_id": game.player_1_id,
        "player_2_id": game.player_2_id,
        "player_1": player_1,
        "player_2": player_2,
        "players": [
            _serialize_player_state(row, game=game, requesting_user_id=requesting_user_id)
            for row in player_states
        ],
        "round_state": round_data,
        "winner_user_id": game.winner_user_id,
        "completion_outcome": game.completion_outcome or None,
        "conceded_by_user_id": game.conceded_by_id,
        "started_at": game.started_at.isoformat() if game.started_at else None,
        "completed_at": game.completed_at.isoformat() if game.completed_at else None,
        "created_at": game.created_at.isoformat(),
        "updated_at": game.updated_at.isoformat(),
    }
