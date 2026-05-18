from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from .constants import VICTORY_SCORE


class EstatesGame(models.Model):
    class Status(models.TextChoices):
        LOBBY = "lobby", "Lobby"
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"

    class CompletionOutcome(models.TextChoices):
        VICTORY_SCORE = "victory_score", "Victory score"
        CONCESSION = "concession", "Concession"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player_1 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="estates_games_as_player_1",
    )
    player_2 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="estates_games_as_player_2",
        null=True,
        blank=True,
    )
    winner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="estates_games_won",
        null=True,
        blank=True,
    )
    completion_outcome = models.CharField(
        max_length=16,
        choices=CompletionOutcome.choices,
        blank=True,
        default="",
    )
    conceded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="estates_games_conceded",
        null=True,
        blank=True,
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.LOBBY)
    round = models.PositiveIntegerField(default=1)
    is_solo = models.BooleanField(default=False)
    victory_score = models.PositiveSmallIntegerField(default=VICTORY_SCORE)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]
        indexes = [
            models.Index(fields=["status", "-updated_at"]),
            models.Index(fields=["player_1", "-updated_at"]),
            models.Index(fields=["player_2", "-updated_at"]),
        ]


class EstatesPlayerState(models.Model):
    game = models.ForeignKey(EstatesGame, on_delete=models.CASCADE, related_name="player_states")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="estates_player_states",
    )
    seat_index = models.PositiveSmallIntegerField()
    deck = models.JSONField(default=list, blank=True)
    hand = models.JSONField(default=list, blank=True)
    discard = models.JSONField(default=list, blank=True)
    draw_bonus = models.PositiveSmallIntegerField(default=0)
    is_starting_player = models.BooleanField(default=False)
    score = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["seat_index"]
        constraints = [
            models.UniqueConstraint(fields=["game", "seat_index"], name="estates_player_state_game_seat_uniq"),
            models.UniqueConstraint(fields=["game", "user"], name="estates_player_state_game_user_uniq"),
        ]


class EstatesRoundState(models.Model):
    class Phase(models.TextChoices):
        LOBBY = "lobby", "Lobby"
        PLACEMENT = "placement", "Placement"
        SCORING = "scoring", "Scoring"
        CLEANUP = "cleanup", "Cleanup"
        COMPLETED = "completed", "Completed"

    game = models.OneToOneField(
        EstatesGame,
        on_delete=models.CASCADE,
        related_name="round_state",
        primary_key=True,
    )
    round_number = models.PositiveIntegerField(default=1)
    phase = models.CharField(max_length=16, choices=Phase.choices, default=Phase.LOBBY)
    turn_player_seat = models.PositiveSmallIntegerField(null=True, blank=True)
    actions_taken_by_seat = models.JSONField(default=dict, blank=True)
    placements_by_zone = models.JSONField(default=dict, blank=True)
    pending_actor_seat = models.PositiveSmallIntegerField(null=True, blank=True)
    pending_action = models.CharField(max_length=64, blank=True, default="")
    pending_payload = models.JSONField(default=dict, blank=True)
    phase_started_at = models.DateTimeField(default=timezone.now)
    status_message = models.CharField(max_length=255, blank=True, default="")
    connections_seat_1 = models.PositiveSmallIntegerField(default=0)
    connections_seat_2 = models.PositiveSmallIntegerField(default=0)
    is_paused = models.BooleanField(default=False)
    disconnected_seat = models.PositiveSmallIntegerField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class EstatesGameEvent(models.Model):
    game = models.ForeignKey(EstatesGame, on_delete=models.CASCADE, related_name="events")
    sequence = models.PositiveIntegerField()
    event_type = models.CharField(max_length=64)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sequence", "id"]
        constraints = [
            models.UniqueConstraint(fields=["game", "sequence"], name="estates_game_event_game_sequence_uniq"),
        ]
        indexes = [
            models.Index(fields=["game", "event_type"]),
        ]

