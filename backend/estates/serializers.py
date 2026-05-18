from __future__ import annotations

from typing import Any

from rest_framework import serializers

from .models import EstatesGame, EstatesPlayerState, EstatesRoundState


def _user_display_name(user) -> str:
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


def _player_identity_row(user, seat_index: int) -> dict[str, Any]:
    return {
        "user_id": user.id,
        "seat_index": seat_index,
        "display_name": _user_display_name(user),
        "avatar_url": _user_avatar_url(user),
    }


class LobbyCreateSerializer(serializers.Serializer):
    victory_score = serializers.IntegerField(required=False, min_value=1, max_value=50)


class JoinLobbySerializer(serializers.Serializer):
    pass


class LobbySettingsSerializer(serializers.Serializer):
    victory_score = serializers.IntegerField(required=True, min_value=1, max_value=50)


class EstatesPlayerStateSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = EstatesPlayerState
        fields = [
            "user_id",
            "seat_index",
            "display_name",
            "avatar_url",
            "deck",
            "hand",
            "discard",
            "draw_bonus",
            "is_starting_player",
            "score",
        ]

    def get_display_name(self, obj: EstatesPlayerState) -> str:
        return _user_display_name(obj.user)

    def get_avatar_url(self, obj: EstatesPlayerState) -> str:
        return _user_avatar_url(obj.user)


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
        ]


def serialize_estates_game_state(game: EstatesGame) -> dict[str, Any]:
    player_1 = _player_identity_row(game.player_1, seat_index=1)
    player_2 = _player_identity_row(game.player_2, seat_index=2) if game.player_2_id else None
    player_states = game.player_states.select_related("user").order_by("seat_index")
    round_state = getattr(game, "round_state", None)

    return {
        "id": str(game.id),
        "status": game.status,
        "round": game.round,
        "is_solo": game.is_solo,
        "victory_score": game.victory_score,
        "player_1_id": game.player_1_id,
        "player_2_id": game.player_2_id,
        "player_1": player_1,
        "player_2": player_2,
        "players": EstatesPlayerStateSerializer(player_states, many=True).data,
        "round_state": EstatesRoundStateSerializer(round_state).data if round_state else None,
        "winner_user_id": game.winner_user_id,
        "completion_outcome": game.completion_outcome or None,
        "conceded_by_user_id": game.conceded_by_id,
        "started_at": game.started_at.isoformat() if game.started_at else None,
        "completed_at": game.completed_at.isoformat() if game.completed_at else None,
        "created_at": game.created_at.isoformat(),
        "updated_at": game.updated_at.isoformat(),
    }

