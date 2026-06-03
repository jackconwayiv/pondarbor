from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

MAX_PLAYERS_PER_GAME = 8


class ScoreboardTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="scorenado_templates",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255)
    scored_by_rounds = models.BooleanField(default=False)
    low_score_wins = models.BooleanField(default=False)
    min_players = models.PositiveSmallIntegerField(
        default=2,
        help_text="Minimum players when starting a game from this template.",
    )
    default_round_count = models.PositiveSmallIntegerField(
        default=3,
        help_text="Default number of rounds for scored_by_rounds templates.",
    )
    is_published = models.BooleanField(
        default=False,
        help_text="When true, any user may start games from this template (read-only).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]
        indexes = [
            models.Index(fields=["owner_user", "-updated_at"]),
        ]

    def __str__(self) -> str:
        return self.name


class TemplateCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(
        ScoreboardTemplate,
        on_delete=models.CASCADE,
        related_name="categories",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    sort_order = models.IntegerField(default=0)
    is_scored = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
        indexes = [
            models.Index(fields=["template", "sort_order"]),
        ]

    def __str__(self) -> str:
        return self.name


class Game(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="scorenado_games",
    )
    template = models.ForeignKey(
        ScoreboardTemplate,
        on_delete=models.PROTECT,
        related_name="games",
    )
    snapshot_template_name = models.CharField(max_length=255)
    snapshot_scored_by_rounds = models.BooleanField(default=False)
    snapshot_low_score_wins = models.BooleanField(default=False)
    title = models.CharField(max_length=255, blank=True)
    played_at = models.DateField(null=True, blank=True)
    is_finalized = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    round_count = models.PositiveSmallIntegerField(
        default=1,
        help_text="For scored_by_rounds templates: how many rounds to score (each round uses all categories).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]
        indexes = [
            models.Index(fields=["owner_user", "-updated_at"]),
            models.Index(fields=["owner_user", "is_finalized"]),
        ]

    def __str__(self) -> str:
        return self.title or self.snapshot_template_name or str(self.template_id)


class GameCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name="categories",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    sort_order = models.IntegerField(default=0)
    is_scored = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
        indexes = [
            models.Index(fields=["game", "sort_order"]),
        ]

    def __str__(self) -> str:
        return self.name


class GamePlayer(models.Model):
    INVITE_PENDING = "pending"
    INVITE_ACCEPTED = "accepted"
    INVITE_REJECTED = "rejected"
    INVITE_CANCELLED = "cancelled"
    INVITE_STATUS_CHOICES = [
        (INVITE_PENDING, "Pending"),
        (INVITE_ACCEPTED, "Accepted"),
        (INVITE_REJECTED, "Rejected"),
        (INVITE_CANCELLED, "Cancelled"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name="players",
    )
    display_name = models.CharField(max_length=255)
    color = models.CharField(max_length=32, blank=True, default="gray.200")
    sort_order = models.PositiveSmallIntegerField(default=0)
    team = models.CharField(max_length=8, blank=True)
    invited_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scorenado_seat_invites_received",
    )
    invite_status = models.CharField(
        max_length=16,
        choices=INVITE_STATUS_CHOICES,
        null=True,
        blank=True,
    )
    claimed_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scorenado_claimed_seats",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
        indexes = [
            models.Index(fields=["game", "sort_order"]),
            models.Index(fields=["invited_user", "invite_status"]),
            models.Index(fields=["claimed_user"]),
        ]

    def __str__(self) -> str:
        return self.display_name


class GameTag(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name="tags",
    )
    player = models.ForeignKey(
        GamePlayer,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="tags",
    )
    label = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["game", "created_at"]),
        ]

    def __str__(self) -> str:
        return self.label


class Score(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name="scores",
    )
    category = models.ForeignKey(
        GameCategory,
        on_delete=models.CASCADE,
        related_name="scores",
    )
    player = models.ForeignKey(
        GamePlayer,
        on_delete=models.CASCADE,
        related_name="scores",
    )
    value = models.IntegerField(null=True, blank=True)
    round_number = models.PositiveSmallIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["game", "category", "player", "round_number"],
                name="uniq_scorenado_score_game_cat_player_round",
            ),
        ]
        indexes = [
            models.Index(fields=["game", "category"]),
        ]
