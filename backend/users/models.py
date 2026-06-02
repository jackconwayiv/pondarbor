from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class MealWeekStartsOn(models.IntegerChoices):
    """Monday=0 … Sunday=6 (Python weekday())."""

    MONDAY = 0, "Monday"
    TUESDAY = 1, "Tuesday"
    WEDNESDAY = 2, "Wednesday"
    THURSDAY = 3, "Thursday"
    FRIDAY = 4, "Friday"
    SATURDAY = 5, "Saturday"
    SUNDAY = 6, "Sunday"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    class AccountStatus(models.TextChoices):
        PENDING = "pending", "Pending Approval"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        SUSPENDED = "suspended", "Suspended"

    username = models.CharField(max_length=150, blank=True)
    email = models.EmailField(unique=True)
    auth0_sub = models.CharField(max_length=255, unique=True, null=True, blank=True)
    account_status = models.CharField(
        max_length=20,
        choices=AccountStatus.choices,
        default=AccountStatus.PENDING,
    )
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email


PROFILE_TIMEZONE_DEFAULT = "America/Phoenix"


class Profile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="profile"
    )
    display_name = models.CharField(max_length=150, blank=True)
    avatar_url = models.URLField(blank=True, max_length=2048)
    timezone = models.CharField(
        max_length=64, default=PROFILE_TIMEZONE_DEFAULT
    )
    birth_date = models.DateField(null=True, blank=True)
    display_astro = models.BooleanField(
        default=True,
        help_text="When true, Sun/Moon/Rising appear on the member's friend profile.",
    )
    # Set when the user has finished at least one WhatIf session (any role).
    whatif_completed_session = models.BooleanField(default=False)
    meal_week_starts_on = models.PositiveSmallIntegerField(
        choices=MealWeekStartsOn.choices,
        default=MealWeekStartsOn.MONDAY,
    )
    meal_crud_partner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="meal_crud_partner_reverse",
    )
    # Keys "1"…"5" -> list of that length; each value is a user-facing meal-slot name from the app allowlist.
    meal_slot_labels = models.JSONField(null=True, blank=True)
    meal_pantry_enabled = models.BooleanField(
        default=False,
        help_text="When true, show pantry inventory and related grocery hints.",
    )
    meal_slots_per_day = models.PositiveSmallIntegerField(
        default=3,
        help_text="Meal plan rows per day (1–5); adding a row applies to every day.",
    )
    meal_maestro_setup_completed = models.BooleanField(
        default=False,
        help_text="User finished the Meal Maestro setup wizard.",
    )
    meal_dietary_preferences = models.JSONField(
        default=list,
        blank=True,
        help_text="Dietary labels from setup; seeds meal tags and default pantry dietary tags.",
    )

    class SocialPublishVisibility(models.TextChoices):
        ALL_APPROVED = "all_approved", "All approved users"
        FRIENDS_ONLY = "friends_only", "Friends only"

    # Global default for newly-created social objects (quotes, song-a-day, closet sharing, etc.).
    # Per-object overrides still apply where they exist.
    social_publish_visibility = models.CharField(
        max_length=20,
        choices=SocialPublishVisibility.choices,
        default=SocialPublishVisibility.ALL_APPROVED,
    )

    class SocialReadScope(models.TextChoices):
        APPROVED_USERS = "approved_users", "Approved users"
        FRIENDS_ONLY = "friends_only", "Friends only"

    # Viewer preference for feed/discover surfaces (soft filter).
    social_read_scope = models.CharField(
        max_length=20,
        choices=SocialReadScope.choices,
        default=SocialReadScope.APPROVED_USERS,
    )

    class SongadayVisibility(models.TextChoices):
        PRIVATE = "private", "Private (only me)"
        FRIENDS_ONLY = "friends_only", "Friends only"
        ALL_APPROVED = "all_approved", "All approved users"

    songaday_visibility = models.CharField(
        max_length=20,
        choices=SongadayVisibility.choices,
        default=SongadayVisibility.ALL_APPROVED,
    )

    # List of achievement slugs whose "Unlocked: ..." bell notice has been acknowledged
    # by the account. Stored here (vs localStorage) so dismiss persists across devices.
    achievement_inbox_read_slugs = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.display_name or self.user.email
