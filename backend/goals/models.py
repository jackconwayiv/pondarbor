from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class Goal(models.Model):
    class Kind(models.TextChoices):
        ONE_TIME = "one_time", "One-time"
        CONTINUOUS = "continuous", "Continuous"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"
        PAUSED = "paused", "Paused"

    class FrequencyKind(models.TextChoices):
        DAILY = "daily", "Daily"
        WEEKLY = "weekly", "Weekly"
        TIMES_PER_DAY = "times_per_day", "Times per day"
        TIMES_PER_WEEK = "times_per_week", "Times per week"

    class LastCompletionEventType(models.TextChoices):
        CHECK_IN = "check_in", "Check-in"
        CHECKPOINT_COMPLETED = "checkpoint_completed", "Checkpoint completed"
        GOAL_COMPLETED = "goal_completed", "Goal completed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="goals_owned",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    kind = models.CharField(max_length=16, choices=Kind.choices)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    frequency_kind = models.CharField(
        max_length=20,
        choices=FrequencyKind.choices,
        default=FrequencyKind.DAILY,
    )
    frequency_count = models.PositiveSmallIntegerField(default=1)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_check_in_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_completion_event_at = models.DateTimeField(null=True, blank=True)
    last_completion_event_type = models.CharField(
        max_length=24,
        choices=LastCompletionEventType.choices,
        blank=True,
    )
    last_completion_checkpoint = models.ForeignKey(
        "Checkpoint",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["owner_user", "status"]),
            models.Index(fields=["owner_user", "-last_check_in_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title


class Checkpoint(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    goal = models.ForeignKey(
        Goal,
        on_delete=models.CASCADE,
        related_name="checkpoints",
    )
    title = models.CharField(max_length=255)
    sort_order = models.IntegerField(default=0)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "created_at"]

    def __str__(self) -> str:
        return self.title


class CheckIn(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    goal = models.ForeignKey(
        Goal,
        on_delete=models.CASCADE,
        related_name="check_ins",
    )
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="goal_check_ins",
    )
    checkpoint = models.ForeignKey(
        Checkpoint,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="check_ins",
    )
    occurred_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at", "-created_at"]
        indexes = [
            models.Index(fields=["goal", "occurred_at"]),
            models.Index(fields=["owner_user", "occurred_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.goal_id} @ {self.occurred_at}"
