import re
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


def validate_character_name(value: str):
    if not value or not value.strip():
        raise ValidationError("Name is required.")
    if len(value) > 20:
        raise ValidationError("Name must be at most 20 characters.")
    if not re.fullmatch(r"[a-zA-Z0-9 ]+", value):
        raise ValidationError(
            "Name may only contain letters, digits, and spaces.",
        )


class Area(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=80, unique=True, blank=True)
    description = models.TextField(blank=True)
    grid_width = models.PositiveSmallIntegerField(default=3)
    grid_height = models.PositiveSmallIntegerField(default=3)
    # Play UI palette (#RRGGBB); empty = client/server fallbacks
    theme_primary = models.CharField(max_length=7, blank=True, default="")
    theme_secondary = models.CharField(max_length=7, blank=True, default="")
    theme_accent = models.CharField(max_length=7, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Room(models.Model):
    area = models.ForeignKey(
        Area, on_delete=models.CASCADE, related_name="rooms"
    )
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=80, blank=True)
    description = models.TextField(blank=True)
    search_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["area_id", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.area_id})"


class AreaCell(models.Model):
    area = models.ForeignKey(
        Area, on_delete=models.CASCADE, related_name="cells"
    )
    x = models.PositiveSmallIntegerField()
    y = models.PositiveSmallIntegerField()
    room = models.OneToOneField(
        Room,
        on_delete=models.CASCADE,
        related_name="area_cell",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["area", "x", "y"],
                name="qff_areacell_area_xy_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["area", "x", "y"]),
        ]

    def __str__(self) -> str:
        return f"{self.area_id} ({self.x},{self.y}) → room {self.room_id}"


class RoomExit(models.Model):
    class Direction(models.TextChoices):
        N = "n", "North"
        S = "s", "South"
        E = "e", "East"
        W = "w", "West"
        NW = "nw", "Northwest"
        NE = "ne", "Northeast"
        SW = "sw", "Southwest"
        SE = "se", "Southeast"
        UP = "up", "Up"
        DOWN = "down", "Down"
        IN = "in", "In"
        OUT = "out", "Out"

    class LockKind(models.TextChoices):
        NONE = "none", "None"
        KEY = "key", "Key"
        DEVICE = "device", "Device"
        QUEST = "quest", "Quest"

    from_room = models.ForeignKey(
        Room, on_delete=models.CASCADE, related_name="exits_out"
    )
    to_room = models.ForeignKey(
        Room, on_delete=models.CASCADE, related_name="exits_in"
    )
    direction = models.CharField(
        max_length=8,
        choices=Direction.choices,
    )
    is_hidden = models.BooleanField(default=False)
    lock_kind = models.CharField(
        max_length=16,
        choices=LockKind.choices,
        default=LockKind.NONE,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["from_room", "direction"],
                name="qff_roomexit_from_direction_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.from_room_id} {self.direction} → {self.to_room_id}"


class CharacterClass(models.Model):
    slug = models.SlugField(max_length=32, unique=True)
    name = models.CharField(max_length=100)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name


class Character(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="qff_character",
    )
    name = models.CharField(max_length=20, validators=[validate_character_name])
    name_normalized = models.CharField(max_length=20, unique=True, db_index=True)
    character_class = models.ForeignKey(
        CharacterClass,
        on_delete=models.PROTECT,
        related_name="characters",
    )
    current_room = models.ForeignKey(
        Room,
        on_delete=models.PROTECT,
        related_name="occupants",
    )
    # Room the character returns to on death (respawn); set at creation, changeable later.
    spawn_room = models.ForeignKey(
        Room,
        on_delete=models.PROTECT,
        related_name="respawn_characters",
    )
    last_activity_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["current_room", "last_activity_at"]),
        ]

    def save(self, *args, **kwargs):
        self.name_normalized = self.name.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class CharacterRoomVisit(models.Model):
    character = models.ForeignKey(
        Character, on_delete=models.CASCADE, related_name="room_visits"
    )
    room = models.ForeignKey(
        Room, on_delete=models.CASCADE, related_name="character_visits"
    )
    first_visited_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["character", "room"],
                name="qff_charroomvisit_uniq",
            ),
        ]


class CharacterExitSeen(models.Model):
    character = models.ForeignKey(
        Character, on_delete=models.CASCADE, related_name="exits_seen"
    )
    room_exit = models.ForeignKey(
        RoomExit, on_delete=models.CASCADE, related_name="seen_by"
    )
    seen_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["character", "room_exit"],
                name="qff_charexitseen_uniq",
            ),
        ]
