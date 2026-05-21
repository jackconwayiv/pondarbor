from __future__ import annotations

import logging
import random
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsApprovedUser

from .bot_user import get_computer_user, is_computer_user
from .computer import EffectMove, PlacementMove, pick_random_persona, rank_computer_moves
from .constants import (
    COMPUTER_CARD_PLAY_DELAY_MS,
    COMPUTER_FIRST_CARD_DELAY_MAX_MS,
    COMPUTER_FIRST_CARD_DELAY_MIN_MS,
    COMPUTER_SEAT_INDEX,
    HUMAN_SEAT_INDEX,
    MAX_LOBBY_AGE_HOURS,
    MY_GAMES_LIST_LIMIT,
    SCORING_STEP_DELAY_MS,
    SOLO_VICTORY_SCORE,
    VICTORY_SCORE,
)
from .game_setup import (
    SCORING_STEPS_IN_ORDER,
    ZONE_NAMES_IN_SCORING_ORDER,
    card_total_value,
    coerce_int,
    create_opening_hand_state,
    initial_placements_by_zone,
    is_suit_allowed_in_zone,
    normalize_card_suit,
    suit_strength,
)
from .models import EstatesGame, EstatesPlayerState, EstatesRoundState, EstatesUserStats
from .presence import initialize_presence_for_active_game, initialize_presence_for_solo_game
from .realtime import notify_estates_game, notify_estates_lobbies
from .serializers import (
    JoinLobbySerializer,
    LobbyCreateSerializer,
    LobbySettingsSerializer,
    SoloLobbyCreateSerializer,
    _user_display_name,
    serialize_estates_game_state,
)
from .stats import record_estates_game_completed, record_estates_zone_win, serialize_estates_user_stats

logger = logging.getLogger(__name__)


def _game_queryset():
    return EstatesGame.objects.select_related(
        "player_1",
        "player_1__profile",
        "player_2",
        "player_2__profile",
    ).prefetch_related("player_states__user__profile")


def _prune_stale_lobbies() -> int:
    cutoff = timezone.now() - timedelta(hours=MAX_LOBBY_AGE_HOURS)
    stale_qs = EstatesGame.objects.filter(
        status=EstatesGame.Status.LOBBY,
        player_2__isnull=True,
        created_at__lt=cutoff,
    )
    deleted_count, _ = stale_qs.delete()
    return deleted_count


def _initialize_lobby_for_owner(*, owner, victory_score: int) -> EstatesGame:
    with transaction.atomic():
        game = EstatesGame.objects.create(
            player_1=owner,
            status=EstatesGame.Status.LOBBY,
            round=1,
            is_solo=False,
            victory_score=victory_score,
        )
        EstatesPlayerState.objects.create(
            game=game,
            user=owner,
            seat_index=1,
            deck=[],
            hand=[],
            discard=[],
            draw_bonus=0,
            is_starting_player=False,
            score=0,
        )
        EstatesRoundState.objects.create(
            game=game,
            round_number=1,
            phase=EstatesRoundState.Phase.LOBBY,
            turn_player_seat=None,
            actions_taken_by_seat={"1": 0, "2": 0},
            placements_by_zone={},
            pending_actor_seat=None,
            pending_action="confirm_lobby",
            pending_payload={"confirmations": {"1": False, "2": False}},
            status_message="Waiting for an opponent to join the lobby.",
        )
    return game


def _seat_for_user(game: EstatesGame, *, user_id: int) -> int | None:
    if game.player_1_id == user_id:
        return 1
    if game.player_2_id == user_id:
        return 2
    return None


def _paused_response(round_state: EstatesRoundState) -> Response:
    return Response(
        {"detail": round_state.status_message or "Game is paused."},
        status=status.HTTP_409_CONFLICT,
    )


def _player_name_for_seat(game: EstatesGame, seat_index: int) -> str:
    if game.is_solo and seat_index == COMPUTER_SEAT_INDEX:
        return "Computer"
    if seat_index == 1:
        profile = getattr(game.player_1, "profile", None)
        display_name = (getattr(profile, "display_name", "") or "").strip()
        return display_name or game.player_1.email.split("@", 1)[0]
    if seat_index == 2 and game.player_2:
        profile = getattr(game.player_2, "profile", None)
        display_name = (getattr(profile, "display_name", "") or "").strip()
        return display_name or game.player_2.email.split("@", 1)[0]
    return "Player"


def _serialize_for_request(game: EstatesGame, request) -> dict:
    return serialize_estates_game_state(game, requesting_user_id=int(request.user.id))


def _user_has_open_estates_game(user_id: int) -> bool:
    return (
        _games_for_user(user_id)
        .filter(status__in=(EstatesGame.Status.LOBBY, EstatesGame.Status.ACTIVE))
        .exists()
    )


def _schedule_computer_action(
    round_state: EstatesRoundState,
    *,
    first_in_sequence: bool = False,
) -> None:
    if first_in_sequence:
        delay_ms = random.randint(COMPUTER_FIRST_CARD_DELAY_MIN_MS, COMPUTER_FIRST_CARD_DELAY_MAX_MS)
    else:
        delay_ms = COMPUTER_CARD_PLAY_DELAY_MS
    round_state.pending_computer_action_at = timezone.now() + timedelta(milliseconds=delay_ms)


def _clear_computer_schedule(round_state: EstatesRoundState) -> None:
    round_state.pending_computer_action_at = None


def _computer_action_due(round_state: EstatesRoundState) -> bool:
    due_at = round_state.pending_computer_action_at
    if due_at is None:
        return False
    return timezone.now() >= due_at


def _maybe_schedule_computer_after_human_action(
    *,
    locked: EstatesGame,
    round_state: EstatesRoundState,
) -> None:
    if not locked.is_solo or locked.status != EstatesGame.Status.ACTIVE:
        return
    if round_state.pending_actor_seat != COMPUTER_SEAT_INDEX:
        _clear_computer_schedule(round_state)
        return
    if round_state.phase == EstatesRoundState.Phase.PLACEMENT:
        actions = dict(round_state.actions_taken_by_seat or {})
        first_play = int(actions.get(str(COMPUTER_SEAT_INDEX), 0)) == 0
        _schedule_computer_action(round_state, first_in_sequence=first_play)
        round_state.save(update_fields=["pending_computer_action_at", "updated_at"])
    elif (
        round_state.phase == EstatesRoundState.Phase.SCORING
        and round_state.pending_action == "choose_effect_target"
    ):
        _schedule_computer_action(round_state, first_in_sequence=False)
        round_state.save(update_fields=["pending_computer_action_at", "updated_at"])


def _games_for_user(user_id: int):
    return _game_queryset().filter(Q(player_1_id=user_id) | Q(player_2_id=user_id))


def _other_seat(seat_index: int) -> int:
    return 2 if seat_index == 1 else 1


def _find_card_in_hand(player_state: EstatesPlayerState, *, card_id: str):
    for idx, card in enumerate(player_state.hand):
        if str(card.get("card_id")) == card_id:
            return idx, card
    return None, None


def _discard_hand_card(player_state: EstatesPlayerState, *, card_id: str) -> bool:
    hand = list(player_state.hand or [])
    for idx, card in enumerate(hand):
        if str(card.get("card_id") or "") != card_id:
            continue
        card_for_discard = dict(card)
        card_for_discard["temporary_value_modifier"] = 0
        discard = list(player_state.discard or [])
        discard.append(card_for_discard)
        hand.pop(idx)
        player_state.hand = hand
        player_state.discard = discard
        player_state.save(update_fields=["hand", "discard", "updated_at"])
        return True
    return False


def _clear_unconfirmed_for_seat(placements_by_zone: dict, *, seat_key: str) -> None:
    for zone_payload in placements_by_zone.values():
        placed = zone_payload.get(seat_key)
        if isinstance(placed, dict) and not bool(placed.get("confirmed")):
            zone_payload[seat_key] = None


def _normalize_placements(placements: dict) -> dict:
    for zone_name in ("gate", "farm", "road", "tower", "throne"):
        if zone_name not in placements or not isinstance(placements.get(zone_name), dict):
            placements[zone_name] = {"1": None, "2": None}
        placements[zone_name].setdefault("1", None)
        placements[zone_name].setdefault("2", None)
    return placements


def _commit_card_placement(
    *,
    locked: EstatesGame,
    round_state: EstatesRoundState,
    player_state: EstatesPlayerState,
    seat_index: int,
    zone: str,
    card: dict,
    placements: dict,
) -> None:
    seat_key = str(seat_index)
    card_idx, _card = _find_card_in_hand(player_state, card_id=str(card.get("card_id") or ""))
    if card_idx is None:
        raise ValueError("Card not in hand")
    hand = list(player_state.hand)
    hand.pop(card_idx)
    player_state.hand = hand
    player_state.save(update_fields=["hand", "updated_at"])

    placements[zone][seat_key] = {"card": card, "confirmed": True}

    actions_taken = dict(round_state.actions_taken_by_seat or {"1": 0, "2": 0})
    actions_taken[seat_key] = int(actions_taken.get(seat_key, 0)) + 1
    total_actions = int(actions_taken.get("1", 0)) + int(actions_taken.get("2", 0))
    next_seat = _other_seat(seat_index)

    winners_by_zone: dict[str, dict | None] = {}
    for zone_name, payload in placements.items():
        if isinstance(payload, dict):
            winners_by_zone[zone_name] = _zone_winner_payload(payload)

    round_state.placements_by_zone = placements
    round_state.actions_taken_by_seat = actions_taken
    round_state.pending_payload = {"zone_winners": winners_by_zone}

    if total_actions >= 6:
        round_state.phase = EstatesRoundState.Phase.SCORING
        round_state.pending_actor_seat = None
        round_state.turn_player_seat = None
        round_state.pending_action = "resolve_scoring"
        round_state.status_message = "All cards are locked in. Scoring starts soon."
        now_ms = int(timezone.now().timestamp() * 1000)
        round_state.pending_payload = {
            "zone_winners": winners_by_zone,
            "scoring": {
                "zone_index": 0,
                "waiting_until_ms": now_ms + SCORING_STEP_DELAY_MS,
                "awaiting_choice": None,
            },
        }
    else:
        round_state.pending_actor_seat = next_seat
        round_state.turn_player_seat = next_seat
        round_state.pending_action = "play_card"
        next_name = _player_name_for_seat(locked, next_seat)
        round_state.status_message = f"Waiting for {next_name} to play a card."

    round_state.phase_started_at = timezone.now()
    round_state.save(
        update_fields=[
            "phase",
            "turn_player_seat",
            "actions_taken_by_seat",
            "placements_by_zone",
            "pending_actor_seat",
            "pending_action",
            "pending_payload",
            "status_message",
            "phase_started_at",
            "updated_at",
        ]
    )


def _confirmed_card_for_seat(zone_payload: dict, seat_key: str) -> dict | None:
    placed = zone_payload.get(seat_key)
    if not isinstance(placed, dict):
        return None
    card = placed.get("card")
    if not isinstance(card, dict):
        return None
    if not bool(placed.get("confirmed")):
        return None
    return card


def _card_eligible_to_win_zone(card: dict | None) -> bool:
    return card is not None and card_total_value(card) > 0


def _zone_winner_payload(zone_payload: dict) -> dict | None:
    top_card = _confirmed_card_for_seat(zone_payload, "1")
    bottom_card = _confirmed_card_for_seat(zone_payload, "2")
    has_top = top_card is not None
    has_bottom = bottom_card is not None
    if not has_top and not has_bottom:
        return None
    top_eligible = _card_eligible_to_win_zone(top_card)
    bottom_eligible = _card_eligible_to_win_zone(bottom_card)
    if not top_eligible and not bottom_eligible:
        return {"winning_seat": None, "outcome": "no_winner"}
    if top_eligible and not bottom_eligible:
        return {"winning_seat": 1}
    if bottom_eligible and not top_eligible:
        return {"winning_seat": 2}
    top_value = card_total_value(top_card)
    bottom_value = card_total_value(bottom_card)
    if top_value > bottom_value:
        return {"winning_seat": 1}
    if bottom_value > top_value:
        return {"winning_seat": 2}
    top_suit = normalize_card_suit(top_card)
    bottom_suit = normalize_card_suit(bottom_card)
    top_strength = suit_strength(top_suit)
    bottom_strength = suit_strength(bottom_suit)
    if top_strength > bottom_strength:
        return {"winning_seat": 1}
    if bottom_strength > top_strength:
        return {"winning_seat": 2}
    return {"winning_seat": None, "outcome": "tie"}


def _zone_has_no_cards(zone_payload: dict | None) -> bool:
    if not isinstance(zone_payload, dict):
        return True
    return (
        _confirmed_card_for_seat(zone_payload, "1") is None
        and _confirmed_card_for_seat(zone_payload, "2") is None
    )


def _advance_scoring_zone_index(
    *,
    round_state: EstatesRoundState,
    scoring: dict,
    payload: dict,
    winners_by_zone: dict,
    zone_index: int,
    silent: bool,
    status_message: str | None = None,
) -> bool:
    scoring["zone_index"] = zone_index + 1
    scoring["awaiting_choice"] = None
    scoring["waiting_until_ms"] = _now_ms() if silent else _now_ms() + SCORING_STEP_DELAY_MS
    payload["zone_winners"] = winners_by_zone
    payload["scoring"] = scoring
    round_state.pending_payload = payload
    round_state.pending_action = "resolve_scoring"
    round_state.pending_actor_seat = None
    if status_message is not None:
        round_state.status_message = status_message
    round_state.phase_started_at = timezone.now()
    round_state.save(
        update_fields=[
            "pending_payload",
            "pending_action",
            "pending_actor_seat",
            "status_message",
            "phase_started_at",
            "updated_at",
        ]
    )
    return True


def _zone_no_winner_status_message(*, zone_name: str, winner_payload: dict | None) -> str:
    zone_label = zone_name.title()
    if winner_payload and winner_payload.get("outcome") == "tie":
        return f"The {zone_label} is tied this round - no reward."
    return f"There is no winner at the {zone_label} this round."


def _winner_seat_from_payload(winner_payload: dict | None) -> int | None:
    if winner_payload is None:
        return None
    seat = winner_payload.get("winning_seat")
    if seat in (None, "", False):
        return None
    resolved = coerce_int(seat, -1)
    return resolved if resolved in (1, 2) else None


def _schedule_scoring_pause(
    *,
    round_state: EstatesRoundState,
    scoring: dict,
    payload: dict,
    winners_by_zone: dict,
    zone_index: int,
    status_message: str,
) -> bool:
    scoring["zone_index"] = zone_index + 1
    scoring["waiting_until_ms"] = _now_ms() + SCORING_STEP_DELAY_MS
    scoring["awaiting_choice"] = None
    payload["zone_winners"] = winners_by_zone
    payload["scoring"] = scoring
    round_state.pending_payload = payload
    round_state.pending_action = "resolve_scoring"
    round_state.pending_actor_seat = None
    round_state.status_message = status_message
    round_state.phase_started_at = timezone.now()
    round_state.save(
        update_fields=[
            "pending_payload",
            "pending_action",
            "pending_actor_seat",
            "status_message",
            "phase_started_at",
            "updated_at",
        ]
    )
    return True


def _now_ms() -> int:
    return int(timezone.now().timestamp() * 1000)


def _start_active_game(
    *,
    locked: EstatesGame,
    round_state: EstatesRoundState,
    solo_presence: bool = False,
) -> int:
    """Deal hands and enter placement. Returns starting seat index."""
    now = timezone.now()
    locked.status = EstatesGame.Status.ACTIVE
    locked.started_at = now
    locked.round = 1
    locked.save(update_fields=["status", "started_at", "round", "updated_at"])

    starting_seat = random.choice((1, 2))
    player_states = {
        state.seat_index: state
        for state in EstatesPlayerState.objects.select_for_update().filter(game=locked).order_by("seat_index")
    }
    for idx in (1, 2):
        state = player_states.get(idx)
        if state is None:
            raise ValueError("Missing player state rows.")
        opening = create_opening_hand_state(hand_size=5)
        state.deck = opening.deck
        state.hand = opening.hand
        state.discard = opening.discard
        state.draw_bonus = 0
        state.is_starting_player = idx == starting_seat
        state.score = 0
        state.save(
            update_fields=[
                "deck",
                "hand",
                "discard",
                "draw_bonus",
                "is_starting_player",
                "score",
                "updated_at",
            ]
        )

    next_name = _player_name_for_seat(locked, starting_seat)
    round_state.round_number = 1
    round_state.phase = EstatesRoundState.Phase.PLACEMENT
    round_state.turn_player_seat = starting_seat
    round_state.actions_taken_by_seat = {"1": 0, "2": 0}
    round_state.placements_by_zone = initial_placements_by_zone()
    round_state.pending_actor_seat = starting_seat
    round_state.pending_action = "play_card"
    round_state.pending_payload = {}
    round_state.phase_started_at = now
    round_state.pending_computer_action_at = None
    if solo_presence:
        initialize_presence_for_solo_game(round_state)
    else:
        initialize_presence_for_active_game(round_state)
    round_state.status_message = f"Waiting for {next_name} to play a card."

    if locked.is_solo and starting_seat == COMPUTER_SEAT_INDEX:
        _schedule_computer_action(round_state, first_in_sequence=True)

    round_state.save(
        update_fields=[
            "round_number",
            "phase",
            "turn_player_seat",
            "actions_taken_by_seat",
            "placements_by_zone",
            "pending_actor_seat",
            "pending_action",
            "pending_payload",
            "phase_started_at",
            "status_message",
            "connections_seat_1",
            "connections_seat_2",
            "is_paused",
            "disconnected_seat",
            "pending_computer_action_at",
            "updated_at",
        ]
    )
    return starting_seat


def _place_card_for_seat(
    *,
    locked: EstatesGame,
    round_state: EstatesRoundState,
    seat_index: int,
    zone: str,
    card_id: str,
) -> None:
    player_state = EstatesPlayerState.objects.select_for_update().filter(game=locked, seat_index=seat_index).first()
    if player_state is None:
        raise ValueError("Missing player state.")
    _idx, card = _find_card_in_hand(player_state, card_id=card_id)
    if card is None:
        raise ValueError("Card not found in hand.")
    card_suit = normalize_card_suit(card)
    if not is_suit_allowed_in_zone(zone=zone, suit=card_suit):
        raise ValueError("That card suit is not allowed in this zone.")
    placements = _normalize_placements(dict(round_state.placements_by_zone or {}))
    seat_key = str(seat_index)
    existing = placements[zone].get(seat_key)
    if isinstance(existing, dict) and bool(existing.get("confirmed")):
        raise ValueError("Already confirmed a card in that zone.")
    _commit_card_placement(
        locked=locked,
        round_state=round_state,
        player_state=player_state,
        seat_index=seat_index,
        zone=zone,
        card=card,
        placements=placements,
    )


def _apply_effect_for_seat(
    *,
    locked: EstatesGame,
    round_state: EstatesRoundState,
    seat_index: int,
    move: EffectMove,
) -> None:
    payload = dict(round_state.pending_payload or {})
    scoring = dict(payload.get("scoring") or {})
    awaiting = dict(scoring.get("awaiting_choice") or {})
    if not awaiting:
        raise ValueError("No scoring choice is pending.")
    actor_seat = int(awaiting.get("actor_seat") or 0)
    if actor_seat != seat_index:
        raise ValueError("Not actor seat.")
    effect_type = str(awaiting.get("type") or "")

    placements = dict(round_state.placements_by_zone or {})
    if effect_type == "gate_debuff":
        target_zone = move.target_zone
        target_card_id = move.target_card_id
        if target_zone not in placements:
            raise ValueError("Invalid target zone.")
        if target_zone == str(awaiting.get("source_zone") or ""):
            raise ValueError("Target must be in another zone.")
        target_seat = int(awaiting.get("target_seat") or 0)
        zone_payload = placements.get(target_zone) or {}
        seat_payload = zone_payload.get(str(target_seat))
        if not isinstance(seat_payload, dict):
            raise ValueError("Target card not found.")
        card = seat_payload.get("card")
        if not isinstance(card, dict):
            raise ValueError("Target card not found.")
        if str(card.get("card_id") or "") != target_card_id:
            raise ValueError("Target card mismatch.")
        card["temporary_value_modifier"] = int(card.get("temporary_value_modifier") or 0) - 1
        seat_payload["card"] = card
        zone_payload[str(target_seat)] = seat_payload
        placements[target_zone] = zone_payload
        winner_name = _player_name_for_seat(locked, actor_seat)
        round_state.status_message = f"{winner_name} applies -1 from Gate."
        round_state.placements_by_zone = placements
    elif effect_type == "farm_upgrade":
        winner_row = EstatesPlayerState.objects.select_for_update().filter(game=locked, seat_index=actor_seat).first()
        if winner_row is None:
            raise ValueError("Missing player state.")
        hand = list(winner_row.hand or [])
        found = False
        for idx, card in enumerate(hand):
            if str(card.get("card_id") or "") == move.target_card_id:
                card["permanent_value_bonus"] = int(card.get("permanent_value_bonus") or 0) + 1
                hand[idx] = card
                found = True
                break
        if not found:
            raise ValueError("Target hand card not found.")
        winner_row.hand = hand
        winner_row.save(update_fields=["hand", "updated_at"])
        winner_name = _player_name_for_seat(locked, actor_seat)
        round_state.status_message = f"{winner_name} permanently upgrades a hand card from Farm (+1)."
    elif effect_type == "tower_discard":
        scoring["next_round_start_seat"] = _other_seat(actor_seat)
        winner_row = EstatesPlayerState.objects.select_for_update().filter(game=locked, seat_index=actor_seat).first()
        if winner_row is None:
            raise ValueError("Missing player state.")
        winner_name = _player_name_for_seat(locked, actor_seat)
        hand = list(winner_row.hand or [])
        if hand:
            if not move.target_card_id:
                raise ValueError("Target hand card is required.")
            if not _discard_hand_card(winner_row, card_id=move.target_card_id):
                raise ValueError("Target hand card not found.")
        round_state.status_message = (
            f"{winner_name} discards from hand (Tower) and will go second next round."
        )
    else:
        raise ValueError("Unsupported choice effect.")

    winners_by_zone = _recompute_zone_winners(round_state.placements_by_zone or {})
    zone_index = coerce_int(scoring.get("zone_index"), 0)
    scoring["zone_index"] = zone_index + 1
    scoring["awaiting_choice"] = None
    scoring["waiting_until_ms"] = _now_ms() + SCORING_STEP_DELAY_MS
    payload["zone_winners"] = winners_by_zone
    payload["scoring"] = scoring
    round_state.pending_payload = payload
    round_state.pending_action = "resolve_scoring"
    round_state.pending_actor_seat = None
    round_state.phase_started_at = timezone.now()
    round_state.save(
        update_fields=[
            "placements_by_zone",
            "pending_payload",
            "pending_action",
            "pending_actor_seat",
            "status_message",
            "phase_started_at",
            "updated_at",
        ]
    )


def _try_run_computer_step(*, game_id: str) -> bool:
    with transaction.atomic():
        locked = EstatesGame.objects.select_for_update().get(pk=game_id)
        if not locked.is_solo or locked.status != EstatesGame.Status.ACTIVE:
            return False
        round_state = EstatesRoundState.objects.select_for_update().get(game=locked)
        if round_state.is_paused:
            return False
        if round_state.pending_actor_seat != COMPUTER_SEAT_INDEX:
            return False
        if not _computer_action_due(round_state):
            return False

        player_rows = {
            row.seat_index: row
            for row in EstatesPlayerState.objects.select_for_update().filter(game=locked).order_by("seat_index")
        }
        computer_row = player_rows.get(COMPUTER_SEAT_INDEX)
        human_row = player_rows.get(HUMAN_SEAT_INDEX)
        if computer_row is None or human_row is None:
            return False

        payload = dict(round_state.pending_payload or {})
        scoring = dict(payload.get("scoring") or {})
        awaiting = scoring.get("awaiting_choice")
        if isinstance(awaiting, dict):
            awaiting = dict(awaiting)
        else:
            awaiting = None

        ranked = rank_computer_moves(
            phase=round_state.phase,
            pending_action=round_state.pending_action,
            awaiting_choice=awaiting,
            computer_hand=list(computer_row.hand or []),
            placements=dict(round_state.placements_by_zone or {}),
            computer_seat=COMPUTER_SEAT_INDEX,
            opponent_seat=HUMAN_SEAT_INDEX,
            computer_score=int(computer_row.score or 0),
            opponent_score=int(human_row.score or 0),
            victory_score=int(locked.victory_score or VICTORY_SCORE),
            persona=locked.computer_persona or "throne_rush",
            difficulty=locked.computer_difficulty or "normal",
        )
        if not ranked:
            _clear_computer_schedule(round_state)
            round_state.save(update_fields=["pending_computer_action_at", "updated_at"])
            return False

        for move in ranked:
            try:
                if isinstance(move, PlacementMove):
                    _place_card_for_seat(
                        locked=locked,
                        round_state=round_state,
                        seat_index=COMPUTER_SEAT_INDEX,
                        zone=move.zone,
                        card_id=move.card_id,
                    )
                elif isinstance(move, EffectMove):
                    _apply_effect_for_seat(
                        locked=locked,
                        round_state=round_state,
                        seat_index=COMPUTER_SEAT_INDEX,
                        move=move,
                    )
                else:
                    continue
                break
            except ValueError as exc:
                logger.warning("computer move failed game=%s move=%s: %s", game_id, move, exc)
                continue
        else:
            logger.error("computer exhausted moves game=%s", game_id)
            return False

        round_state.refresh_from_db()
        locked.refresh_from_db()

        if locked.status == EstatesGame.Status.COMPLETED:
            _clear_computer_schedule(round_state)
            round_state.save(update_fields=["pending_computer_action_at", "updated_at"])
            return True

        if round_state.phase == EstatesRoundState.Phase.SCORING and round_state.pending_action == "resolve_scoring":
            _progress_scoring_if_ready(locked=locked, round_state=round_state)
            round_state.refresh_from_db()

        if round_state.pending_actor_seat == COMPUTER_SEAT_INDEX:
            if round_state.phase == EstatesRoundState.Phase.PLACEMENT:
                _schedule_computer_action(round_state, first_in_sequence=False)
            elif round_state.pending_action == "choose_effect_target":
                _schedule_computer_action(round_state, first_in_sequence=False)
            round_state.save(update_fields=["pending_computer_action_at", "updated_at"])
        else:
            _clear_computer_schedule(round_state)
            round_state.save(update_fields=["pending_computer_action_at", "updated_at"])

        return True


def _recompute_zone_winners(placements_by_zone: dict) -> dict[str, dict | None]:
    out: dict[str, dict | None] = {}
    for zone_name, payload in placements_by_zone.items():
        if isinstance(payload, dict):
            out[zone_name] = _zone_winner_payload(payload)
    return out


def _draw_to_target_size(player_state: EstatesPlayerState, *, target_size: int) -> None:
    deck = list(player_state.deck or [])
    hand = list(player_state.hand or [])
    discard = list(player_state.discard or [])
    while len(hand) < target_size:
        if not deck:
            if not discard:
                break
            deck = list(discard)
            random.shuffle(deck)
            discard = []
        hand.append(deck.pop(0))
    player_state.deck = deck
    player_state.hand = hand
    player_state.discard = discard


def _start_next_round(locked: EstatesGame, round_state: EstatesRoundState) -> None:
    player_rows = {
        row.seat_index: row
        for row in EstatesPlayerState.objects.select_for_update().filter(game=locked).order_by("seat_index")
    }
    for zone_name, zone_payload in (round_state.placements_by_zone or {}).items():
        if not isinstance(zone_payload, dict):
            continue
        for seat_key in ("1", "2"):
            placed = zone_payload.get(seat_key)
            if not isinstance(placed, dict):
                continue
            card = placed.get("card")
            if not isinstance(card, dict):
                continue
            seat = int(seat_key)
            row = player_rows.get(seat)
            if row is None:
                continue
            card_for_discard = dict(card)
            card_for_discard["temporary_value_modifier"] = 0
            discard = list(row.discard or [])
            discard.append(card_for_discard)
            row.discard = discard

    current_start = 1
    for idx, row in player_rows.items():
        if row.is_starting_player:
            current_start = idx
            break
    payload = dict(round_state.pending_payload or {})
    scoring = dict(payload.get("scoring") or {})
    chosen_start = coerce_int(scoring.get("next_round_start_seat"), 0)
    if chosen_start in (1, 2):
        next_start = chosen_start
    else:
        next_start = _other_seat(current_start)

    for idx, row in player_rows.items():
        target_hand = 5 + int(row.draw_bonus or 0)
        _draw_to_target_size(row, target_size=target_hand)
        row.draw_bonus = 0
        row.is_starting_player = idx == next_start
        row.save(update_fields=["deck", "hand", "discard", "draw_bonus", "is_starting_player", "updated_at"])

    locked.round = int(locked.round or 1) + 1
    locked.save(update_fields=["round", "updated_at"])

    next_name = _player_name_for_seat(locked, next_start)
    round_state.round_number = locked.round
    round_state.phase = EstatesRoundState.Phase.PLACEMENT
    round_state.turn_player_seat = next_start
    round_state.actions_taken_by_seat = {"1": 0, "2": 0}
    round_state.placements_by_zone = initial_placements_by_zone()
    round_state.pending_actor_seat = next_start
    round_state.pending_action = "play_card"
    round_state.pending_payload = {}
    round_state.status_message = f"Waiting for {next_name} to play a card."
    round_state.phase_started_at = timezone.now()
    update_fields = [
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
        "updated_at",
    ]
    if locked.is_solo and next_start == COMPUTER_SEAT_INDEX:
        _schedule_computer_action(round_state, first_in_sequence=True)
        update_fields.append("pending_computer_action_at")
    else:
        _clear_computer_schedule(round_state)
        update_fields.append("pending_computer_action_at")
    round_state.save(update_fields=update_fields)


def _zones_scored_before(zone_name: str) -> frozenset[str]:
    zones = list(ZONE_NAMES_IN_SCORING_ORDER)
    try:
        idx = zones.index(zone_name)
    except ValueError:
        return frozenset()
    return frozenset(zones[:idx])


def _progress_scoring_if_ready(*, locked: EstatesGame, round_state: EstatesRoundState) -> bool:
    if locked.status != EstatesGame.Status.ACTIVE:
        return False
    if round_state.phase != EstatesRoundState.Phase.SCORING:
        return False
    if round_state.is_paused:
        return False

    payload = dict(round_state.pending_payload or {})
    scoring = dict(payload.get("scoring") or {})
    zone_index = coerce_int(scoring.get("zone_index"), 0)
    waiting_until_ms = scoring.get("waiting_until_ms")
    awaiting_choice = scoring.get("awaiting_choice")

    if awaiting_choice:
        return False
    if waiting_until_ms is not None and _now_ms() < coerce_int(waiting_until_ms, 0):
        return False

    placements = dict(round_state.placements_by_zone or {})
    winners_by_zone = _recompute_zone_winners(placements)
    scoring_steps = list(SCORING_STEPS_IN_ORDER)

    if zone_index >= len(scoring_steps):
        _start_next_round(locked, round_state)
        return True

    zone_name = scoring_steps[zone_index][0]
    zone_payload = placements.get(zone_name) or {}
    winner_payload = winners_by_zone.get(zone_name)
    winner_seat = _winner_seat_from_payload(winner_payload)
    if winner_seat is None:
        if _zone_has_no_cards(zone_payload if isinstance(zone_payload, dict) else None):
            return _advance_scoring_zone_index(
                round_state=round_state,
                scoring=scoring,
                payload=payload,
                winners_by_zone=winners_by_zone,
                zone_index=zone_index,
                silent=True,
            )
        return _schedule_scoring_pause(
            round_state=round_state,
            scoring=scoring,
            payload=payload,
            winners_by_zone=winners_by_zone,
            zone_index=zone_index,
            status_message=_zone_no_winner_status_message(
                zone_name=zone_name,
                winner_payload=winner_payload,
            ),
        )

    winner_name = _player_name_for_seat(locked, winner_seat)
    loser_seat = _other_seat(winner_seat)
    player_rows = {
        row.seat_index: row
        for row in EstatesPlayerState.objects.select_for_update().filter(game=locked).order_by("seat_index")
    }
    winner_row = player_rows.get(winner_seat)
    if winner_row is None:
        return False

    record_estates_zone_win(winner_row.user_id, zone_name)

    if zone_name == "gate":
        scoring["awaiting_choice"] = {
            "type": "gate_debuff",
            "source_zone": zone_name,
            "actor_seat": winner_seat,
            "target_seat": loser_seat,
        }
        scoring["waiting_until_ms"] = None
        payload["zone_winners"] = winners_by_zone
        payload["scoring"] = scoring
        round_state.pending_payload = payload
        round_state.pending_actor_seat = winner_seat
        round_state.pending_action = "choose_effect_target"
        round_state.status_message = f"Waiting for {winner_name} to choose a card for Gate (-1)."
        round_state.phase_started_at = timezone.now()
        if locked.is_solo and winner_seat == COMPUTER_SEAT_INDEX:
            _schedule_computer_action(round_state, first_in_sequence=False)
            round_state.save(
                update_fields=[
                    "pending_payload",
                    "pending_actor_seat",
                    "pending_action",
                    "status_message",
                    "phase_started_at",
                    "pending_computer_action_at",
                    "updated_at",
                ]
            )
        else:
            round_state.save(
                update_fields=[
                    "pending_payload",
                    "pending_actor_seat",
                    "pending_action",
                    "status_message",
                    "phase_started_at",
                    "updated_at",
                ]
            )
        return True

    if zone_name == "farm":
        scoring["awaiting_choice"] = {
            "type": "farm_upgrade",
            "source_zone": zone_name,
            "actor_seat": winner_seat,
        }
        scoring["waiting_until_ms"] = None
        payload["zone_winners"] = winners_by_zone
        payload["scoring"] = scoring
        round_state.pending_payload = payload
        round_state.pending_actor_seat = winner_seat
        round_state.pending_action = "choose_effect_target"
        round_state.status_message = f"Waiting for {winner_name} to permanently upgrade a hand card from Farm (+1)."
        round_state.phase_started_at = timezone.now()
        if locked.is_solo and winner_seat == COMPUTER_SEAT_INDEX:
            _schedule_computer_action(round_state, first_in_sequence=False)
            round_state.save(
                update_fields=[
                    "pending_payload",
                    "pending_actor_seat",
                    "pending_action",
                    "status_message",
                    "phase_started_at",
                    "pending_computer_action_at",
                    "updated_at",
                ]
            )
        else:
            round_state.save(
                update_fields=[
                    "pending_payload",
                    "pending_actor_seat",
                    "pending_action",
                    "status_message",
                    "phase_started_at",
                    "updated_at",
                ]
            )
        return True

    if zone_name == "road":
        winner_row.draw_bonus = 1
        winner_row.save(update_fields=["draw_bonus", "updated_at"])
        return _schedule_scoring_pause(
            round_state=round_state,
            scoring=scoring,
            payload=payload,
            winners_by_zone=winners_by_zone,
            zone_index=zone_index,
            status_message=f"{winner_name} wins Road and will draw an extra card next round.",
        )

    if zone_name == "tower":
        scoring["awaiting_choice"] = {
            "type": "tower_discard",
            "source_zone": zone_name,
            "actor_seat": winner_seat,
        }
        scoring["waiting_until_ms"] = None
        payload["zone_winners"] = winners_by_zone
        payload["scoring"] = scoring
        round_state.pending_payload = payload
        round_state.pending_actor_seat = winner_seat
        round_state.pending_action = "choose_effect_target"
        round_state.status_message = (
            f"Waiting for {winner_name} to choose a hand card to discard (Tower)."
        )
        round_state.phase_started_at = timezone.now()
        if locked.is_solo and winner_seat == COMPUTER_SEAT_INDEX:
            _schedule_computer_action(round_state, first_in_sequence=False)
            round_state.save(
                update_fields=[
                    "pending_payload",
                    "pending_actor_seat",
                    "pending_action",
                    "status_message",
                    "phase_started_at",
                    "pending_computer_action_at",
                    "updated_at",
                ]
            )
        else:
            round_state.save(
                update_fields=[
                    "pending_payload",
                    "pending_actor_seat",
                    "pending_action",
                    "status_message",
                    "phase_started_at",
                    "updated_at",
                ]
            )
        return True

    if zone_name == "throne":
        winner_row.score = int(winner_row.score or 0) + 1
        winner_row.save(update_fields=["score", "updated_at"])
        if winner_row.score >= int(locked.victory_score or VICTORY_SCORE):
            locked.status = EstatesGame.Status.COMPLETED
            locked.winner_user_id = winner_row.user_id
            locked.completion_outcome = EstatesGame.CompletionOutcome.VICTORY_SCORE
            locked.conceded_by_id = None
            locked.completed_at = timezone.now()
            locked.save(
                update_fields=[
                    "status",
                    "winner_user",
                    "completion_outcome",
                    "conceded_by",
                    "completed_at",
                    "updated_at",
                ]
            )
            round_state.phase = EstatesRoundState.Phase.COMPLETED
            round_state.pending_action = ""
            round_state.pending_actor_seat = None
            round_state.status_message = f"{winner_name} wins the Throne and wins the game!"
            round_state.phase_started_at = timezone.now()
            round_state.save(
                update_fields=[
                    "phase",
                    "pending_action",
                    "pending_actor_seat",
                    "status_message",
                    "phase_started_at",
                    "updated_at",
                ]
            )
            record_estates_game_completed(locked)
            return True
        return _schedule_scoring_pause(
            round_state=round_state,
            scoring=scoring,
            payload=payload,
            winners_by_zone=winners_by_zone,
            zone_index=zone_index,
            status_message=f"{winner_name} wins the Throne and gains 1 point.",
        )

    return False


@api_view(["POST", "GET"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def lobbies_collection(request):
    _prune_stale_lobbies()

    if request.method == "POST":
        if _user_has_open_estates_game(request.user.id):
            return Response(
                {"detail": "Finish or leave your current Estates game before starting another."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = LobbyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        victory_score = serializer.validated_data.get("victory_score", VICTORY_SCORE)
        game = _initialize_lobby_for_owner(owner=request.user, victory_score=victory_score)
        game = _game_queryset().get(pk=game.pk)
        notify_estates_game(str(game.pk))
        notify_estates_lobbies()
        return Response(_serialize_for_request(game, request), status=status.HTTP_201_CREATED)

    rows = (
        _game_queryset()
        .filter(
            status=EstatesGame.Status.LOBBY,
            player_2__isnull=True,
        )
        .exclude(player_1_id=request.user.id)
        .order_by("-created_at")[:50]
    )
    return Response(
        [serialize_estates_game_state(game, requesting_user_id=request.user.id) for game in rows],
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def lobby_solo(request):
    _prune_stale_lobbies()
    if is_computer_user(request.user):
        return Response({"detail": "Computer account cannot start solo games."}, status=status.HTTP_403_FORBIDDEN)
    if _user_has_open_estates_game(request.user.id):
        return Response(
            {"detail": "Finish or leave your current Estates game before starting another."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = SoloLobbyCreateSerializer(data=request.data if isinstance(request.data, dict) else {})
    serializer.is_valid(raise_exception=True)
    difficulty = serializer.validated_data["difficulty"]
    computer_user = get_computer_user()
    persona = pick_random_persona()

    with transaction.atomic():
        game = EstatesGame.objects.create(
            player_1=request.user,
            player_2=computer_user,
            status=EstatesGame.Status.LOBBY,
            round=1,
            is_solo=True,
            computer_difficulty=difficulty,
            computer_persona=persona,
            victory_score=SOLO_VICTORY_SCORE,
        )
        EstatesPlayerState.objects.create(
            game=game,
            user=request.user,
            seat_index=HUMAN_SEAT_INDEX,
            deck=[],
            hand=[],
            discard=[],
            draw_bonus=0,
            is_starting_player=False,
            score=0,
        )
        EstatesPlayerState.objects.create(
            game=game,
            user=computer_user,
            seat_index=COMPUTER_SEAT_INDEX,
            deck=[],
            hand=[],
            discard=[],
            draw_bonus=0,
            is_starting_player=False,
            score=0,
        )
        EstatesRoundState.objects.create(
            game=game,
            round_number=1,
            phase=EstatesRoundState.Phase.LOBBY,
            turn_player_seat=None,
            actions_taken_by_seat={"1": 0, "2": 0},
            placements_by_zone={},
            pending_actor_seat=None,
            pending_action="",
            pending_payload={},
            status_message="Starting game against Computer.",
        )
        locked = EstatesGame.objects.select_for_update().get(pk=game.pk)
        round_state = EstatesRoundState.objects.select_for_update().get(game=locked)
        _start_active_game(locked=locked, round_state=round_state, solo_presence=True)

    game = _game_queryset().get(pk=game.pk)
    notify_estates_game(str(game.pk))
    notify_estates_lobbies()
    return Response(_serialize_for_request(game, request), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def lobby_join(request, game_id):
    _prune_stale_lobbies()

    serializer = JoinLobbySerializer(data=request.data if isinstance(request.data, dict) else {})
    serializer.is_valid(raise_exception=True)
    game = get_object_or_404(_game_queryset(), pk=game_id)

    if game.player_1_id == request.user.id:
        return Response({"detail": "You are already in this lobby."}, status=status.HTTP_400_BAD_REQUEST)

    if game.status != EstatesGame.Status.LOBBY:
        return Response({"detail": "Lobby is not open."}, status=status.HTTP_400_BAD_REQUEST)

    if game.player_2_id and game.player_2_id != request.user.id:
        return Response({"detail": "Lobby is already full."}, status=status.HTTP_400_BAD_REQUEST)

    if game.player_2_id == request.user.id:
        return Response(_serialize_for_request(game, request), status=status.HTTP_200_OK)

    if _user_has_open_estates_game(request.user.id):
        return Response(
            {"detail": "Finish or leave your current Estates game before joining another."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        locked = EstatesGame.objects.select_for_update().get(pk=game.pk)
        if locked.status != EstatesGame.Status.LOBBY:
            return Response({"detail": "Lobby is not open."}, status=status.HTTP_400_BAD_REQUEST)
        if locked.player_2_id is not None:
            return Response({"detail": "Lobby is already full."}, status=status.HTTP_400_BAD_REQUEST)
        if locked.player_1_id == request.user.id:
            return Response({"detail": "You are already in this lobby."}, status=status.HTTP_400_BAD_REQUEST)
        locked.player_2 = request.user
        locked.save(update_fields=["player_2", "updated_at"])
        EstatesPlayerState.objects.create(
            game=locked,
            user=request.user,
            seat_index=2,
            deck=[],
            hand=[],
            discard=[],
            draw_bonus=0,
            is_starting_player=False,
            score=0,
        )
        EstatesRoundState.objects.filter(game=locked).update(
            pending_action="confirm_lobby",
            pending_payload={"confirmations": {"1": False, "2": False}},
            status_message="Both players are in the lobby. Owner can start the game.",
            updated_at=timezone.now(),
        )

    refreshed = _game_queryset().get(pk=game.pk)
    notify_estates_game(str(game.pk))
    notify_estates_lobbies()
    return Response(_serialize_for_request(refreshed, request), status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def lobby_leave(request, game_id):
    _prune_stale_lobbies()
    game = get_object_or_404(_game_queryset(), pk=game_id)
    if game.status != EstatesGame.Status.LOBBY:
        return Response({"detail": "Can only leave while game is in lobby state."}, status=status.HTTP_400_BAD_REQUEST)
    if game.player_2_id != request.user.id:
        return Response(
            {"detail": "Only the joined non-owner player can leave this lobby."},
            status=status.HTTP_403_FORBIDDEN,
        )

    with transaction.atomic():
        locked = EstatesGame.objects.select_for_update().get(pk=game.pk)
        if locked.status != EstatesGame.Status.LOBBY:
            return Response({"detail": "Lobby is not open."}, status=status.HTTP_400_BAD_REQUEST)
        if locked.player_2_id != request.user.id:
            return Response(
                {"detail": "Only the joined non-owner player can leave this lobby."},
                status=status.HTTP_403_FORBIDDEN,
            )
        EstatesPlayerState.objects.filter(game=locked, user_id=request.user.id, seat_index=2).delete()
        locked.player_2 = None
        locked.save(update_fields=["player_2", "updated_at"])
        EstatesRoundState.objects.filter(game=locked).update(
            pending_action="confirm_lobby",
            pending_actor_seat=None,
            pending_payload={"confirmations": {"1": False, "2": False}},
            status_message="Waiting for an opponent to join the lobby.",
            phase_started_at=timezone.now(),
            updated_at=timezone.now(),
        )

    refreshed = _game_queryset().get(pk=game.pk)
    notify_estates_game(str(game.pk))
    notify_estates_lobbies()
    return Response(_serialize_for_request(refreshed, request), status=status.HTTP_200_OK)


def _serialize_estates_my_game_row(game: EstatesGame, user_id: int) -> dict:
    player_names = [_user_display_name(game.player_1)]
    if game.is_solo:
        player_names.append("Computer")
    elif game.player_2_id:
        player_names.append(_user_display_name(game.player_2))

    winner_display_name = None
    if game.winner_user_id:
        if game.is_solo and game.winner_user_id == get_computer_user().id:
            winner_display_name = "Computer"
        else:
            winner_display_name = _user_display_name(game.winner_user)

    my_score: int | None = None
    opponent_score: int | None = None
    for player_state in game.player_states.all():
        if player_state.user_id == user_id:
            my_score = player_state.score
        else:
            opponent_score = player_state.score

    return {
        "id": str(game.id),
        "status": game.status,
        "created_at": game.created_at.isoformat(),
        "updated_at": game.updated_at.isoformat(),
        "is_owner": game.player_1_id == user_id,
        "is_solo": game.is_solo,
        "computer_difficulty": (game.computer_difficulty or None) if game.is_solo else None,
        "player_names": player_names,
        "winner_display_name": winner_display_name,
        "round": game.round,
        "my_score": my_score,
        "opponent_score": opponent_score,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def list_my_games(request):
    """Games the user hosts or joined; grouped for the homepage My games section."""
    _prune_stale_lobbies()
    uid = int(request.user.id)
    games = list(
        _games_for_user(uid)
        .select_related(
            "player_1",
            "player_1__profile",
            "player_2",
            "player_2__profile",
            "winner_user",
            "winner_user__profile",
        )
        .prefetch_related("player_states__user__profile")
        .order_by("-updated_at", "-created_at")[:MY_GAMES_LIST_LIMIT]
    )

    def by_updated_desc(rows: list[EstatesGame]) -> list[EstatesGame]:
        return sorted(rows, key=lambda g: g.updated_at, reverse=True)

    lobby = by_updated_desc([g for g in games if g.status == EstatesGame.Status.LOBBY])
    in_progress = by_updated_desc([g for g in games if g.status == EstatesGame.Status.ACTIVE])
    completed = by_updated_desc([g for g in games if g.status == EstatesGame.Status.COMPLETED])
    known = frozenset(
        (
            EstatesGame.Status.LOBBY,
            EstatesGame.Status.ACTIVE,
            EstatesGame.Status.COMPLETED,
        )
    )
    unknown = [g for g in games if g.status not in known]
    if unknown:
        in_progress = by_updated_desc(in_progress + unknown)

    return Response(
        {
            "open_lobby": [_serialize_estates_my_game_row(g, uid) for g in lobby],
            "in_progress": [_serialize_estates_my_game_row(g, uid) for g in in_progress],
            "completed": [_serialize_estates_my_game_row(g, uid) for g in completed],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def stats_mine(request):
    stats = EstatesUserStats.objects.filter(user_id=request.user.id).first()
    return Response(serialize_estates_user_stats(stats))


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def games_mine(request):
    _prune_stale_lobbies()
    game = (
        (_games_for_user(request.user.id))
        .order_by(
            "-updated_at",
            "-created_at",
        )
        .first()
    )
    if game is None:
        return Response(status=status.HTTP_204_NO_CONTENT)
    if game.status == EstatesGame.Status.ACTIVE:
        progressed = False
        computer_step = False
        try:
            with transaction.atomic():
                locked = EstatesGame.objects.select_for_update().get(pk=game.pk)
                round_state = EstatesRoundState.objects.select_for_update().get(game=locked)
                if locked.is_solo:
                    computer_step = _try_run_computer_step(game_id=str(game.pk))
                progressed = _progress_scoring_if_ready(locked=locked, round_state=round_state)
        except EstatesRoundState.DoesNotExist:
            pass
        game = _game_queryset().get(pk=game.pk)
        if progressed or computer_step:
            notify_estates_game(str(game.pk))
    return Response(serialize_estates_game_state(game, requesting_user_id=request.user.id), status=status.HTTP_200_OK)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def lobby_detail(request, game_id):
    _prune_stale_lobbies()
    game = get_object_or_404(_game_queryset(), pk=game_id)
    if game.status != EstatesGame.Status.LOBBY:
        return Response({"detail": "Only lobby games can be modified here."}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == "PATCH":
        if game.player_1_id != request.user.id:
            return Response({"detail": "Only the lobby owner can update settings."}, status=status.HTTP_403_FORBIDDEN)
        serializer = LobbySettingsSerializer(data=request.data if isinstance(request.data, dict) else {})
        serializer.is_valid(raise_exception=True)
        victory_score = serializer.validated_data["victory_score"]
        with transaction.atomic():
            locked = EstatesGame.objects.select_for_update().get(pk=game.pk)
            if locked.status != EstatesGame.Status.LOBBY:
                return Response({"detail": "Lobby is not open."}, status=status.HTTP_400_BAD_REQUEST)
            locked.victory_score = victory_score
            locked.save(update_fields=["victory_score", "updated_at"])
        refreshed = _game_queryset().get(pk=game.pk)
        notify_estates_game(str(game.pk))
        notify_estates_lobbies()
        return Response(_serialize_for_request(refreshed, request), status=status.HTTP_200_OK)

    # DELETE
    if game.player_1_id != request.user.id:
        return Response({"detail": "Only the lobby owner can cancel this lobby."}, status=status.HTTP_403_FORBIDDEN)
    if game.player_2_id is not None:
        return Response(
            {"detail": "Cannot cancel lobby after an opponent has joined."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    game.delete()
    notify_estates_lobbies()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def lobby_confirm(request, game_id):
    _prune_stale_lobbies()
    game = get_object_or_404(_game_queryset(), pk=game_id)
    seat_index = _seat_for_user(game, user_id=request.user.id)
    if seat_index is None:
        return Response({"detail": "Only players in this lobby can confirm."}, status=status.HTTP_403_FORBIDDEN)

    with transaction.atomic():
        locked = EstatesGame.objects.select_for_update().get(pk=game.pk)
        round_state = EstatesRoundState.objects.select_for_update().get(game=locked)
        seat_index = _seat_for_user(locked, user_id=request.user.id)
        if seat_index is None:
            return Response({"detail": "Only players in this lobby can confirm."}, status=status.HTTP_403_FORBIDDEN)
        if locked.player_1_id != request.user.id:
            return Response({"detail": "Only the lobby owner can start the game."}, status=status.HTTP_403_FORBIDDEN)
        if locked.status != EstatesGame.Status.LOBBY:
            return Response({"detail": "Game already started."}, status=status.HTTP_400_BAD_REQUEST)
        if locked.player_2_id is None:
            return Response({"detail": "Waiting for a second player."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            _start_active_game(locked=locked, round_state=round_state, solo_presence=False)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    refreshed = _game_queryset().get(pk=game.pk)
    notify_estates_game(str(game.pk))
    notify_estates_lobbies()
    return Response(_serialize_for_request(refreshed, request), status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def game_place_card(request, game_id):
    if is_computer_user(request.user):
        return Response({"detail": "Computer cannot act via the API."}, status=status.HTTP_403_FORBIDDEN)
    game = get_object_or_404(_game_queryset(), pk=game_id)
    seat_index = _seat_for_user(game, user_id=request.user.id)
    if seat_index is None:
        return Response({"detail": "Only players in this game can act."}, status=status.HTTP_403_FORBIDDEN)
    if game.status != EstatesGame.Status.ACTIVE:
        return Response({"detail": "Game is not active."}, status=status.HTTP_400_BAD_REQUEST)

    body = request.data if isinstance(request.data, dict) else {}
    card_id = str(body.get("card_id") or "").strip()
    zone = str(body.get("zone") or "").strip().lower()
    if not card_id:
        return Response({"detail": "card_id is required."}, status=status.HTTP_400_BAD_REQUEST)
    if zone not in {"gate", "farm", "road", "tower", "throne"}:
        return Response({"detail": "Invalid zone."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        locked = EstatesGame.objects.select_for_update().get(pk=game.pk)
        round_state = EstatesRoundState.objects.select_for_update().get(game=locked)
        if locked.status != EstatesGame.Status.ACTIVE or round_state.phase != EstatesRoundState.Phase.PLACEMENT:
            return Response({"detail": "Placements are not open right now."}, status=status.HTTP_400_BAD_REQUEST)
        if round_state.is_paused:
            return _paused_response(round_state)
        if round_state.pending_actor_seat != seat_index:
            return Response({"detail": "It is not your turn."}, status=status.HTTP_400_BAD_REQUEST)

        actions_taken = dict(round_state.actions_taken_by_seat or {"1": 0, "2": 0})
        taken = int(actions_taken.get(str(seat_index), 0))
        if taken >= 3:
            return Response({"detail": "You have already confirmed 3 actions this round."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            _place_card_for_seat(
                locked=locked,
                round_state=round_state,
                seat_index=seat_index,
                zone=zone,
                card_id=card_id,
            )
        except ValueError as exc:
            detail = str(exc)
            if "not found" in detail.lower():
                return Response({"detail": "Card not found in your hand."}, status=status.HTTP_400_BAD_REQUEST)
            if "suit" in detail.lower():
                return Response({"detail": "That card suit is not allowed in this zone."}, status=status.HTTP_400_BAD_REQUEST)
            if "Already confirmed" in detail:
                return Response({"detail": "You already confirmed a card in that zone this round."}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)

        _maybe_schedule_computer_after_human_action(locked=locked, round_state=round_state)

    refreshed = _game_queryset().get(pk=game.pk)
    notify_estates_game(str(game.pk))
    return Response(_serialize_for_request(refreshed, request), status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def game_reorder_hand(request, game_id):
    game = get_object_or_404(_game_queryset(), pk=game_id)
    seat_index = _seat_for_user(game, user_id=request.user.id)
    if seat_index is None:
        return Response({"detail": "Only players in this game can act."}, status=status.HTTP_403_FORBIDDEN)
    if game.status != EstatesGame.Status.ACTIVE:
        return Response({"detail": "Game is not active."}, status=status.HTTP_400_BAD_REQUEST)

    body = request.data if isinstance(request.data, dict) else {}
    raw_ids = body.get("card_ids")
    if not isinstance(raw_ids, list) or len(raw_ids) < 1:
        return Response({"detail": "card_ids must be a non-empty list."}, status=status.HTTP_400_BAD_REQUEST)
    card_ids = [str(value or "").strip() for value in raw_ids]
    card_ids = [value for value in card_ids if value]
    if len(card_ids) < 1:
        return Response({"detail": "card_ids must be a non-empty list."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        locked = EstatesGame.objects.select_for_update().get(pk=game.pk)
        round_state = EstatesRoundState.objects.select_for_update().get(game=locked)
        if locked.status != EstatesGame.Status.ACTIVE or round_state.phase != EstatesRoundState.Phase.PLACEMENT:
            return Response({"detail": "Hand can only be reordered during placement."}, status=status.HTTP_400_BAD_REQUEST)
        if round_state.is_paused:
            return _paused_response(round_state)

        player_state = EstatesPlayerState.objects.select_for_update().filter(game=locked, seat_index=seat_index).first()
        if player_state is None:
            return Response({"detail": "Missing player state."}, status=status.HTTP_400_BAD_REQUEST)

        hand = list(player_state.hand or [])
        current_ids = [str(card.get("card_id") or "") for card in hand]
        if sorted(card_ids) != sorted(current_ids):
            return Response({"detail": "card_ids must match your current hand."}, status=status.HTTP_400_BAD_REQUEST)

        by_id = {str(card.get("card_id") or ""): card for card in hand}
        player_state.hand = [by_id[cid] for cid in card_ids]
        player_state.save(update_fields=["hand", "updated_at"])

    refreshed = _game_queryset().get(pk=game.pk)
    notify_estates_game(str(game.pk))
    return Response(_serialize_for_request(refreshed, request), status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def game_clear_staged_card(request, game_id):
    game = get_object_or_404(_game_queryset(), pk=game_id)
    seat_index = _seat_for_user(game, user_id=request.user.id)
    if seat_index is None:
        return Response({"detail": "Only players in this game can act."}, status=status.HTTP_403_FORBIDDEN)
    if game.status != EstatesGame.Status.ACTIVE:
        return Response({"detail": "Game is not active."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        locked = EstatesGame.objects.select_for_update().get(pk=game.pk)
        round_state = EstatesRoundState.objects.select_for_update().get(game=locked)
        player_state = EstatesPlayerState.objects.select_for_update().filter(game=locked, seat_index=seat_index).first()
        if player_state is None:
            return Response({"detail": "Missing player state."}, status=status.HTTP_400_BAD_REQUEST)
        if round_state.phase != EstatesRoundState.Phase.PLACEMENT:
            return Response({"detail": "Placements are not open right now."}, status=status.HTTP_400_BAD_REQUEST)
        if round_state.pending_actor_seat != seat_index:
            return Response({"detail": "It is not your turn."}, status=status.HTTP_400_BAD_REQUEST)
        placements = dict(round_state.placements_by_zone or {})
        seat_key = str(seat_index)
        _clear_unconfirmed_for_seat(placements, seat_key=seat_key)
        round_state.placements_by_zone = placements
        round_state.pending_action = "play_card"
        round_state.status_message = "Choose a card and drag it to a zone."
        round_state.phase_started_at = timezone.now()
        round_state.save(update_fields=["placements_by_zone", "pending_action", "status_message", "phase_started_at", "updated_at"])

    refreshed = _game_queryset().get(pk=game.pk)
    notify_estates_game(str(game.pk))
    return Response(_serialize_for_request(refreshed, request), status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def game_confirm_card(request, game_id):
    game = get_object_or_404(_game_queryset(), pk=game_id)
    seat_index = _seat_for_user(game, user_id=request.user.id)
    if seat_index is None:
        return Response({"detail": "Only players in this game can act."}, status=status.HTTP_403_FORBIDDEN)
    if game.status != EstatesGame.Status.ACTIVE:
        return Response({"detail": "Game is not active."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        locked = EstatesGame.objects.select_for_update().get(pk=game.pk)
        round_state = EstatesRoundState.objects.select_for_update().get(game=locked)
        player_state = EstatesPlayerState.objects.select_for_update().filter(game=locked, seat_index=seat_index).first()
        if player_state is None:
            return Response({"detail": "Missing player state."}, status=status.HTTP_400_BAD_REQUEST)
        if round_state.phase != EstatesRoundState.Phase.PLACEMENT:
            return Response({"detail": "Placements are not open right now."}, status=status.HTTP_400_BAD_REQUEST)
        if round_state.pending_actor_seat != seat_index:
            return Response({"detail": "It is not your turn."}, status=status.HTTP_400_BAD_REQUEST)

        placements = dict(round_state.placements_by_zone or {})
        seat_key = str(seat_index)
        staged_zone = None
        staged_payload = None
        for zone_name, payload in placements.items():
            placed = payload.get(seat_key) if isinstance(payload, dict) else None
            if isinstance(placed, dict) and not bool(placed.get("confirmed")):
                staged_zone = zone_name
                staged_payload = placed
                break
        if staged_zone is None or staged_payload is None:
            return Response({"detail": "No staged card to confirm."}, status=status.HTTP_400_BAD_REQUEST)

        staged_card = staged_payload.get("card") if isinstance(staged_payload, dict) else None
        if not isinstance(staged_card, dict):
            return Response({"detail": "Staged card is invalid."}, status=status.HTTP_400_BAD_REQUEST)

        placements = _normalize_placements(placements)
        _commit_card_placement(
            locked=locked,
            round_state=round_state,
            player_state=player_state,
            seat_index=seat_index,
            zone=staged_zone,
            card=staged_card,
            placements=placements,
        )

    refreshed = _game_queryset().get(pk=game.pk)
    notify_estates_game(str(game.pk))
    return Response(_serialize_for_request(refreshed, request), status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def game_choose_effect_target(request, game_id):
    if is_computer_user(request.user):
        return Response({"detail": "Computer cannot act via the API."}, status=status.HTTP_403_FORBIDDEN)
    game = get_object_or_404(_game_queryset(), pk=game_id)
    seat_index = _seat_for_user(game, user_id=request.user.id)
    if seat_index is None:
        return Response({"detail": "Only players in this game can act."}, status=status.HTTP_403_FORBIDDEN)

    body = request.data if isinstance(request.data, dict) else {}
    target_zone = str(body.get("target_zone") or "").strip().lower()
    target_card_id = str(body.get("target_card_id") or "").strip()

    with transaction.atomic():
        locked = EstatesGame.objects.select_for_update().get(pk=game.pk)
        round_state = EstatesRoundState.objects.select_for_update().get(game=locked)
        if round_state.phase != EstatesRoundState.Phase.SCORING:
            return Response({"detail": "No scoring choice is pending."}, status=status.HTTP_400_BAD_REQUEST)
        if round_state.is_paused:
            return _paused_response(round_state)
        payload = dict(round_state.pending_payload or {})
        scoring = dict(payload.get("scoring") or {})
        awaiting = dict(scoring.get("awaiting_choice") or {})
        if not awaiting:
            return Response({"detail": "No scoring choice is pending."}, status=status.HTTP_400_BAD_REQUEST)
        actor_seat = int(awaiting.get("actor_seat") or 0)
        if actor_seat != seat_index:
            return Response({"detail": "It is not your choice to make."}, status=status.HTTP_400_BAD_REQUEST)
        effect_type = str(awaiting.get("type") or "")

        placements = dict(round_state.placements_by_zone or {})
        if effect_type == "gate_debuff":
            if target_zone not in placements:
                return Response({"detail": "Invalid target zone."}, status=status.HTTP_400_BAD_REQUEST)
            if target_zone == str(awaiting.get("source_zone") or ""):
                return Response({"detail": "Target must be in another zone."}, status=status.HTTP_400_BAD_REQUEST)
            target_seat = int(awaiting.get("target_seat") or 0)
            zone_payload = placements.get(target_zone) or {}
            seat_payload = zone_payload.get(str(target_seat))
            if not isinstance(seat_payload, dict):
                return Response({"detail": "Target card not found."}, status=status.HTTP_400_BAD_REQUEST)
            card = seat_payload.get("card")
            if not isinstance(card, dict):
                return Response({"detail": "Target card not found."}, status=status.HTTP_400_BAD_REQUEST)
            if str(card.get("card_id") or "") != target_card_id:
                return Response({"detail": "Target card mismatch."}, status=status.HTTP_400_BAD_REQUEST)
            card["temporary_value_modifier"] = int(card.get("temporary_value_modifier") or 0) - 1
            seat_payload["card"] = card
            zone_payload[str(target_seat)] = seat_payload
            placements[target_zone] = zone_payload
            winner_name = _player_name_for_seat(locked, actor_seat)
            round_state.status_message = f"{winner_name} applies -1 from Gate."
            round_state.placements_by_zone = placements
        elif effect_type in {"farm_upgrade", "road_upgrade"}:
            winner_row = EstatesPlayerState.objects.select_for_update().filter(game=locked, seat_index=actor_seat).first()
            if winner_row is None:
                return Response({"detail": "Missing player state."}, status=status.HTTP_400_BAD_REQUEST)
            hand = list(winner_row.hand or [])
            found = False
            for idx, card in enumerate(hand):
                if str(card.get("card_id") or "") == target_card_id:
                    card["permanent_value_bonus"] = int(card.get("permanent_value_bonus") or 0) + 1
                    hand[idx] = card
                    found = True
                    break
            if not found:
                return Response({"detail": "Target hand card not found."}, status=status.HTTP_400_BAD_REQUEST)
            winner_row.hand = hand
            winner_row.save(update_fields=["hand", "updated_at"])
            winner_name = _player_name_for_seat(locked, actor_seat)
            zone_label = "Farm" if effect_type == "farm_upgrade" else "Road"
            round_state.status_message = f"{winner_name} permanently upgrades a hand card from {zone_label} (+1)."
        elif effect_type == "tower_discard":
            scoring["next_round_start_seat"] = _other_seat(actor_seat)
            winner_row = EstatesPlayerState.objects.select_for_update().filter(
                game=locked, seat_index=actor_seat
            ).first()
            if winner_row is None:
                return Response({"detail": "Missing player state."}, status=status.HTTP_400_BAD_REQUEST)
            winner_name = _player_name_for_seat(locked, actor_seat)
            hand = list(winner_row.hand or [])
            if hand:
                if not target_card_id:
                    return Response(
                        {"detail": "target_card_id is required."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if not _discard_hand_card(winner_row, card_id=target_card_id):
                    return Response(
                        {"detail": "Target hand card not found."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            round_state.status_message = (
                f"{winner_name} discards from hand (Tower) and will go second next round."
            )
        else:
            return Response({"detail": "Unsupported choice effect."}, status=status.HTTP_400_BAD_REQUEST)

        winners_by_zone = _recompute_zone_winners(round_state.placements_by_zone or {})
        zone_index = coerce_int(scoring.get("zone_index"), 0)
        scoring["zone_index"] = zone_index + 1
        scoring["awaiting_choice"] = None
        scoring["waiting_until_ms"] = _now_ms() + SCORING_STEP_DELAY_MS
        payload["zone_winners"] = winners_by_zone
        payload["scoring"] = scoring
        round_state.pending_payload = payload
        round_state.pending_action = "resolve_scoring"
        round_state.pending_actor_seat = None
        round_state.phase_started_at = timezone.now()
        round_state.save(
            update_fields=[
                "placements_by_zone",
                "pending_payload",
                "pending_action",
                "pending_actor_seat",
                "status_message",
                "phase_started_at",
                "updated_at",
            ]
        )

    refreshed = _game_queryset().get(pk=game.pk)
    notify_estates_game(str(game.pk))
    return Response(_serialize_for_request(refreshed, request), status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def game_concede(request, game_id):
    game = get_object_or_404(_game_queryset(), pk=game_id)
    seat_index = _seat_for_user(game, user_id=request.user.id)
    if seat_index is None:
        return Response({"detail": "Only players in this game can concede."}, status=status.HTTP_403_FORBIDDEN)
    if game.status != EstatesGame.Status.ACTIVE:
        return Response({"detail": "Game is not active."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        locked = EstatesGame.objects.select_for_update().get(pk=game.pk)
        round_state = EstatesRoundState.objects.select_for_update().get(game=locked)
        seat_index = _seat_for_user(locked, user_id=request.user.id)
        if seat_index is None:
            return Response({"detail": "Only players in this game can concede."}, status=status.HTTP_403_FORBIDDEN)
        if locked.status != EstatesGame.Status.ACTIVE:
            return Response({"detail": "Game is not active."}, status=status.HTTP_400_BAD_REQUEST)

        winner_seat = _other_seat(seat_index)
        winner_row = EstatesPlayerState.objects.select_for_update().filter(
            game=locked, seat_index=winner_seat
        ).first()
        if winner_row is None:
            return Response({"detail": "Missing opponent state."}, status=status.HTTP_400_BAD_REQUEST)

        conceder_name = _player_name_for_seat(locked, seat_index)
        winner_name = _player_name_for_seat(locked, winner_seat)
        now = timezone.now()
        locked.status = EstatesGame.Status.COMPLETED
        locked.winner_user_id = winner_row.user_id
        locked.completion_outcome = EstatesGame.CompletionOutcome.CONCESSION
        locked.conceded_by_id = request.user.id
        locked.completed_at = now
        locked.save(
            update_fields=[
                "status",
                "winner_user",
                "completion_outcome",
                "conceded_by",
                "completed_at",
                "updated_at",
            ]
        )

        round_state.phase = EstatesRoundState.Phase.COMPLETED
        round_state.pending_action = ""
        round_state.pending_actor_seat = None
        round_state.turn_player_seat = None
        round_state.is_paused = False
        round_state.disconnected_seat = None
        round_state.status_message = f"{conceder_name} conceded. {winner_name} wins the game!"
        round_state.phase_started_at = now
        round_state.save(
            update_fields=[
                "phase",
                "pending_action",
                "pending_actor_seat",
                "turn_player_seat",
                "is_paused",
                "disconnected_seat",
                "status_message",
                "phase_started_at",
                "updated_at",
            ]
        )
        record_estates_game_completed(locked)

    refreshed = _game_queryset().get(pk=game.pk)
    notify_estates_game(str(game.pk))
    return Response(_serialize_for_request(refreshed, request), status=status.HTTP_200_OK)

