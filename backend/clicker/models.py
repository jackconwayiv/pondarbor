from django.conf import settings
from django.db import models


class ClickerGameSave(models.Model):
    """Client-authoritative game blob; server persists and scopes by user."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="clicker_game_save",
    )
    state = models.JSONField(default=dict)
    schema_version = models.PositiveIntegerField(default=1)
    last_played_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Clicker game save"
        verbose_name_plural = "Clicker game saves"

    def __str__(self) -> str:
        return f"ClickerSave({self.user_id})"


class Clicker2GameSave(models.Model):
    """PondClicker Redux save blob; separate from Legacy ClickerGameSave."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="clicker2_game_save",
    )
    state = models.JSONField(default=dict)
    schema_version = models.PositiveIntegerField(default=1)
    last_played_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Clicker2 game save"
        verbose_name_plural = "Clicker2 game saves"

    def __str__(self) -> str:
        return f"Clicker2Save({self.user_id})"
