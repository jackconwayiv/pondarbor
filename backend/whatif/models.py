import re
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class WhatIfSession(models.Model):
    class Status(models.TextChoices):
        PRE_LOBBY = "pre_lobby", "Pre Lobby"
        OPEN = "open", "Open"
        TURN = "turn", "Turn"
        VOTING = "voting", "Voting"
        REVEAL = "reveal", "Reveal"
        POST_RESULTS = "post_results", "Post Results"
        ENDED = "ended", "Ended"

    short_code = models.CharField(max_length=4, unique=True, db_index=True)
    # Returned once at session creation; TV/lobby uses this for start_game / reveal / next_turn without joining as a player.
    host_secret = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    # Authenticated user who created the session; not a WhatIfPlayer row.
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="whatif_sessions_owned",
    )
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.OPEN)
    challenge_mode = models.BooleanField(default=False)
    state_version = models.PositiveIntegerField(default=1)
    state = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        code = (self.short_code or "").strip().upper()
        if not re.fullmatch(r"[A-Z]{4}", code):
            raise ValidationError(
                {"short_code": "Room code must be exactly 4 uppercase letters A-Z."}
            )
        self.short_code = code
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"WhatIfSession({self.short_code}, {self.status})"


class WhatIfQuestion(models.Model):
    class ReviewStatus(models.TextChoices):
        APPROVED = "approved", "Approved"
        PENDING = "pending", "Pending"
        REJECTED = "rejected", "Rejected"

    prompt = models.TextField()
    answer_1 = models.CharField(max_length=255)
    answer_2 = models.CharField(max_length=255)
    answer_3 = models.CharField(max_length=255)
    answer_4 = models.CharField(max_length=255)
    answer_5 = models.CharField(max_length=255)
    answer_6 = models.CharField(max_length=255)

    sessions_used_count = models.PositiveIntegerField(default=0)
    total_responses = models.PositiveIntegerField(default=0)
    total_scores = models.PositiveIntegerField(default=0)
    total_skips = models.PositiveIntegerField(default=0)

    is_active = models.BooleanField(default=True)
    review_status = models.CharField(
        max_length=20,
        choices=ReviewStatus.choices,
        default=ReviewStatus.APPROVED,
        db_index=True,
    )
    proposed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="whatif_questions_proposed",
    )
    deleted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"WhatIfQuestion({self.id})"

    def answers_map(self) -> dict[int, str]:
        return {
            1: self.answer_1,
            2: self.answer_2,
            3: self.answer_3,
            4: self.answer_4,
            5: self.answer_5,
            6: self.answer_6,
        }


class WhatIfQuestionSession(models.Model):
    question = models.ForeignKey(
        WhatIfQuestion,
        on_delete=models.CASCADE,
        related_name="session_usages",
    )
    session = models.ForeignKey(
        WhatIfSession,
        on_delete=models.CASCADE,
        related_name="question_usages",
    )
    used_at = models.DateTimeField(auto_now_add=True)
    skipped_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["question", "session"], name="uniq_whatif_question_session"
            )
        ]


class WhatIfPlayer(models.Model):
    session = models.ForeignKey(
        WhatIfSession,
        on_delete=models.CASCADE,
        related_name="players",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="whatif_players",
    )
    display_name = models.CharField(max_length=80)
    avatar_emoji = models.CharField(max_length=10)
    score = models.IntegerField(default=0)
    skips_remaining = models.PositiveIntegerField(default=1)
    ready_to_start = models.BooleanField(default=False)
    # Host can pause disconnected players so voting can proceed without their ballot.
    paused = models.BooleanField(default=False)
    player_secret = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self) -> str:
        return f"WhatIfPlayer({self.id}, {self.display_name})"


class WhatIfNpc(models.Model):
    session = models.ForeignKey(
        WhatIfSession,
        on_delete=models.CASCADE,
        related_name="npcs",
    )
    display_name = models.CharField(max_length=80)
    avatar_emoji = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self) -> str:
        return f"WhatIfNpc({self.id}, {self.display_name})"


class WhatIfGameResult(models.Model):
    session = models.OneToOneField(
        WhatIfSession, on_delete=models.CASCADE, related_name="result"
    )
    winner_player = models.ForeignKey(
        WhatIfPlayer,
        on_delete=models.CASCADE,
        related_name="wins",
    )
    winner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="whatif_wins",
    )
    winner_display_name = models.CharField(max_length=80, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

