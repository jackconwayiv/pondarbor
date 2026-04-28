from __future__ import annotations

from django.conf import settings
from django.db import models


class PondsteadGame(models.Model):
    """Multiplayer Pondstead campaign (lobby → active → finished)."""

    STATUS_LOBBY = "lobby"
    STATUS_ACTIVE = "active"
    STATUS_FINISHED = "finished"
    STATUS_CHOICES = [
        (STATUS_LOBBY, "Lobby"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_FINISHED, "Finished"),
    ]

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_LOBBY)
    name = models.CharField(max_length=120, blank=True, default="")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="pondstead_owned_games",
        null=True,
        blank=True,
    )
    max_players = models.PositiveSmallIntegerField(default=2)
    config = models.JSONField(default=dict)
    current_day = models.PositiveIntegerField(default=1)
    winner_player_id = models.PositiveIntegerField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    last_calendar_new_day_phx_date = models.DateField(null=True, blank=True)
    last_activity_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]


class PondsteadPlayer(models.Model):
    game = models.ForeignKey(PondsteadGame, on_delete=models.CASCADE, related_name="players")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pondstead_players",
    )
    seat_index = models.PositiveSmallIntegerField()
    display_name = models.CharField(max_length=120, blank=True)
    points = models.IntegerField(default=0)
    eliminated = models.BooleanField(default=False)
    faction_color = models.CharField(max_length=16, blank=True, default="")

    class Meta:
        ordering = ["seat_index"]
        constraints = [
            models.UniqueConstraint(fields=["game", "seat_index"], name="pondstead_player_game_seat_uniq"),
        ]


class PondsteadPlayerPrivateState(models.Model):
    """Per-seat authoritative mirror row (future split from monolithic world_json)."""

    player = models.OneToOneField(
        PondsteadPlayer,
        on_delete=models.CASCADE,
        related_name="private_state_row",
        primary_key=True,
    )
    data = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)


class PondsteadCampaignInvite(models.Model):
    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_DECLINED = "declined"
    STATUS_REVOKED = "revoked"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_DECLINED, "Declined"),
        (STATUS_REVOKED, "Revoked"),
    ]

    game = models.ForeignKey(PondsteadGame, on_delete=models.CASCADE, related_name="invites")
    invitee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="pondstead_campaign_invites",
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["game", "invitee"], name="pondstead_invite_game_invitee_uniq"),
        ]


class PondsteadGameState(models.Model):
    game = models.ForeignKey(PondsteadGame, on_delete=models.CASCADE, related_name="states")
    revision = models.PositiveIntegerField()
    world_json = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-revision", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["game", "revision"], name="pondstead_state_game_revision_uniq"),
        ]


class PondsteadDayLog(models.Model):
    game = models.ForeignKey(PondsteadGame, on_delete=models.CASCADE, related_name="day_logs")
    day = models.PositiveIntegerField()
    log_json = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-day", "-id"]
