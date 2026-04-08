from django.conf import settings
from django.db import models


class AchievementDefinition(models.Model):
    """Catalog row for a badge. Thresholds for unlocking live in code (see achievements.services)."""

    slug = models.SlugField(max_length=64, unique=True)
    title = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=32, blank=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    # Optional family for tiered badges (e.g. PondClicker): UI may show only the highest
    # `display_group_order` within each non-empty `display_group`.
    display_group = models.CharField(max_length=64, blank=True, db_index=True)
    display_group_order = models.PositiveIntegerField(default=0)
    show_on_public_profile = models.BooleanField(default=True)

    class Meta:
        ordering = ["order", "slug"]

    def __str__(self) -> str:
        return self.title


class UserAchievement(models.Model):
    """Recorded unlock for a user. Sticky: rows are not removed when counts drop (quotes)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_achievements",
    )
    achievement = models.ForeignKey(
        AchievementDefinition,
        on_delete=models.CASCADE,
        related_name="unlocks",
    )
    unlocked_at = models.DateTimeField(auto_now_add=True)
    context = models.JSONField(default=dict, blank=True)
    # null / True: shown on friends’ profiles; False: owner-only (friends’ API omits).
    visible_to_friends = models.BooleanField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "achievement"],
                name="uniq_user_achievement",
            )
        ]
        ordering = ["-unlocked_at"]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.achievement.slug}"
