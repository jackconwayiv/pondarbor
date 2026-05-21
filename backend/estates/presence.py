from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from .constants import COMPUTER_SEAT_INDEX, HUMAN_SEAT_INDEX
from .models import EstatesGame, EstatesRoundState
from .realtime import notify_estates_game


def _seat_connection_field(seat_index: int) -> str:
    if seat_index == 1:
        return "connections_seat_1"
    if seat_index == 2:
        return "connections_seat_2"
    raise ValueError("seat_index must be 1 or 2")


def _player_name_for_seat(game: EstatesGame, seat_index: int) -> str:
    if game.is_solo and seat_index == COMPUTER_SEAT_INDEX:
        return "Computer"
    if seat_index == 1:
        user = game.player_1
    elif seat_index == 2 and game.player_2:
        user = game.player_2
    else:
        return "Player"
    profile = getattr(user, "profile", None)
    display_name = (getattr(profile, "display_name", "") or "").strip()
    if display_name:
        return display_name
    email = getattr(user, "email", "") or ""
    if email and "@" in email:
        return email.split("@", 1)[0]
    return getattr(user, "username", "") or "Player"


def _sync_pause_from_connections(*, game: EstatesGame, round_state: EstatesRoundState) -> None:
    if game.status != EstatesGame.Status.ACTIVE:
        round_state.is_paused = False
        round_state.disconnected_seat = None
        return

    seat_1_live = int(round_state.connections_seat_1 or 0) > 0
    seat_2_live = int(round_state.connections_seat_2 or 0) > 0

    if game.is_solo:
        if seat_1_live:
            round_state.is_paused = False
            round_state.disconnected_seat = None
            if round_state.phase == EstatesRoundState.Phase.PLACEMENT and round_state.pending_actor_seat:
                actor = int(round_state.pending_actor_seat)
                round_state.status_message = f"Waiting for {_player_name_for_seat(game, actor)} to play a card."
            return
        round_state.is_paused = True
        round_state.disconnected_seat = None
        round_state.status_message = "Waiting for you to open the game."
        return

    if seat_1_live and seat_2_live:
        round_state.is_paused = False
        round_state.disconnected_seat = None
        if round_state.phase == EstatesRoundState.Phase.PLACEMENT and round_state.pending_actor_seat:
            actor = int(round_state.pending_actor_seat)
            round_state.status_message = f"Waiting for {_player_name_for_seat(game, actor)} to play a card."
        return

    if not seat_1_live and not seat_2_live:
        round_state.is_paused = True
        round_state.disconnected_seat = None
        round_state.status_message = "Waiting for both players to open the game."
        return

    disconnected = 1 if not seat_1_live else 2
    name = _player_name_for_seat(game, disconnected)
    round_state.is_paused = True
    round_state.disconnected_seat = disconnected
    round_state.status_message = f"{name} has disconnected. Game paused until they return."


def initialize_presence_for_active_game(round_state: EstatesRoundState) -> None:
    round_state.connections_seat_1 = 0
    round_state.connections_seat_2 = 0
    round_state.is_paused = True
    round_state.disconnected_seat = None
    round_state.status_message = "Waiting for both players to open the game."


def initialize_presence_for_solo_game(round_state: EstatesRoundState) -> None:
    round_state.connections_seat_1 = 0
    round_state.connections_seat_2 = 0
    round_state.is_paused = True
    round_state.disconnected_seat = None
    round_state.status_message = "Waiting for you to open the game."


def adjust_presence_connection(*, game_id: str, seat_index: int, delta: int) -> None:
    if seat_index == COMPUTER_SEAT_INDEX:
        game = EstatesGame.objects.filter(pk=game_id).only("is_solo").first()
        if game and game.is_solo:
            return
    field = _seat_connection_field(seat_index)
    with transaction.atomic():
        game = EstatesGame.objects.select_for_update().get(pk=game_id)
        round_state = EstatesRoundState.objects.select_for_update().get(game=game)
        current = int(getattr(round_state, field) or 0)
        setattr(round_state, field, max(0, current + delta))
        _sync_pause_from_connections(game=game, round_state=round_state)
        round_state.save(
            update_fields=[
                "connections_seat_1",
                "connections_seat_2",
                "is_paused",
                "disconnected_seat",
                "status_message",
                "updated_at",
            ]
        )
    notify_estates_game(game_id)
