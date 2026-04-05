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
    # 1–100: roll 1d100 + Sense must meet or exceed this to reveal search_text.
    search_chance = models.PositiveSmallIntegerField(default=50)
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
    """Playable archetype; chest + main-hand Item templates for new characters (no head starter)."""

    class PriorityStat(models.TextChoices):
        GAINS = "gains", "Gains"
        MOVES = "moves", "Moves"
        GUTS = "guts", "Guts"
        SMARTS = "smarts", "Smarts"
        SENSE = "sense", "Sense"
        RIZZ = "rizz", "Rizz"

    slug = models.SlugField(max_length=32, unique=True)
    name = models.CharField(max_length=100)
    sort_order = models.PositiveSmallIntegerField(default=0)
    description = models.TextField(blank=True)
    priority_stat_1 = models.CharField(
        max_length=16,
        choices=PriorityStat.choices,
        default=PriorityStat.GAINS,
    )
    priority_stat_2 = models.CharField(
        max_length=16,
        choices=PriorityStat.choices,
        default=PriorityStat.GUTS,
    )
    starter_chest_item = models.ForeignKey(
        "Item",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    starter_main_hand_item = models.ForeignKey(
        "Item",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    # Spells, extra starters, etc. — extend without schema churn.
    extra_data = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name


class Item(models.Model):
    """Template — never owned directly; instances reference this."""

    class Slot(models.TextChoices):
        HEAD = "head", "Head"
        MAIN_HAND = "main_hand", "Main Hand"
        OFF_HAND = "off_hand", "Off-Hand"
        CHEST = "chest", "Chest"
        FEET = "feet", "Feet"
        RING = "ring", "Ring"
        AMULET = "amulet", "Amulet"

    class DmgType(models.TextChoices):
        PHYSICAL = "physical", "Physical"
        MAGIC = "magic", "Magic"

    class Rarity(models.TextChoices):
        COMMON = "common", "Common"
        RARE = "rare", "Rare"
        LEGENDARY = "legendary", "Legendary"
        UNIQUE = "unique", "Unique"

    class HiddenSpecialEffect(models.TextChoices):
        NONE = "none", "None"
        CRIT_CHAIN = "crit_chain", "Crit chain"
        LIFESTEAL = "lifesteal", "Lifesteal"
        MANA_ON_HIT = "mana_on_hit", "Mana on hit"

    class HiddenBonusStat(models.TextChoices):
        """Extra stat line revealed when lore is unlocked on inspect."""

        NONE = "", "None"
        GAINS = "gains", "Gains"
        MOVES = "moves", "Moves"
        GUTS = "guts", "Guts"
        SMARTS = "smarts", "Smarts"
        SENSE = "sense", "Sense"
        RIZZ = "rizz", "Rizz"

    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=200)
    item_type = models.CharField(max_length=64, blank=True)
    slot = models.CharField(max_length=16, choices=Slot.choices)
    cost = models.PositiveIntegerField(default=0)
    description = models.TextField(blank=True)
    lore = models.TextField(blank=True)
    lore_chance = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="1–100; null = lore available without unlock roll on instance.",
    )
    rarity = models.CharField(
        max_length=16,
        choices=Rarity.choices,
        default=Rarity.COMMON,
    )
    damage = models.PositiveSmallIntegerField(default=0)
    dmg_type = models.CharField(
        max_length=16,
        choices=DmgType.choices,
        default=DmgType.PHYSICAL,
    )
    armor = models.PositiveSmallIntegerField(default=0)
    element = models.CharField(max_length=32, blank=True)
    hidden_special_effect = models.CharField(
        max_length=32,
        choices=HiddenSpecialEffect.choices,
        default=HiddenSpecialEffect.NONE,
    )
    hidden_bonus_stat = models.CharField(
        max_length=16,
        choices=HiddenBonusStat.choices,
        default=HiddenBonusStat.NONE,
        blank=True,
    )
    hidden_bonus_value = models.SmallIntegerField(default=0)
    two_handed = models.BooleanField(default=False)
    req_gains = models.PositiveSmallIntegerField(null=True, blank=True)
    req_moves = models.PositiveSmallIntegerField(null=True, blank=True)
    req_guts = models.PositiveSmallIntegerField(null=True, blank=True)
    req_smarts = models.PositiveSmallIntegerField(null=True, blank=True)
    req_sense = models.PositiveSmallIntegerField(null=True, blank=True)
    req_rizz = models.PositiveSmallIntegerField(null=True, blank=True)
    bonus_gains = models.SmallIntegerField(default=0)
    bonus_moves = models.SmallIntegerField(default=0)
    bonus_guts = models.SmallIntegerField(default=0)
    bonus_smarts = models.SmallIntegerField(default=0)
    bonus_sense = models.SmallIntegerField(default=0)
    bonus_rizz = models.SmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class ItemInstance(models.Model):
    """A concrete item somewhere in the realm."""

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="instances")
    nickname = models.CharField(max_length=200, blank=True, null=True)
    unlocked = models.BooleanField(default=False)
    chars_failed_to_inspect = models.JSONField(default=list)
    owner_character = models.ForeignKey(
        "Character",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="owned_item_instances",
    )
    room = models.ForeignKey(
        "Room",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="floor_items",
    )
    neglect_count = models.PositiveSmallIntegerField(
        default=0,
        help_text="Unowned floor items: times a player left the room; at 4 the instance may be removed.",
    )
    floor_dropped_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this instance was last placed on the floor (drop); null if owned/in inventory.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["owner_character", "room"]),
        ]

    def __str__(self) -> str:
        return f"{self.item.name}#{self.pk}"


class RoomBroadcast(models.Model):
    room = models.ForeignKey(
        Room, on_delete=models.CASCADE, related_name="broadcasts"
    )
    speaker = models.ForeignKey(
        "Character",
        on_delete=models.CASCADE,
        related_name="room_broadcasts_sent",
    )
    text = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(fields=["room", "id"]),
        ]


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
    level = models.PositiveSmallIntegerField(default=1)
    xp = models.PositiveIntegerField(default=0)
    cur_health = models.PositiveSmallIntegerField(default=20)
    max_health = models.PositiveSmallIntegerField(default=20)
    cur_mana = models.PositiveSmallIntegerField(default=0)
    max_mana = models.PositiveSmallIntegerField(default=0)
    gains = models.PositiveSmallIntegerField(default=1)
    moves = models.PositiveSmallIntegerField(default=1)
    guts = models.PositiveSmallIntegerField(default=1)
    smarts = models.PositiveSmallIntegerField(default=1)
    sense = models.PositiveSmallIntegerField(default=1)
    rizz = models.PositiveSmallIntegerField(default=1)
    inventory = models.JSONField(default=list)
    head_item = models.ForeignKey(
        ItemInstance,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    main_hand_item = models.ForeignKey(
        ItemInstance,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    off_hand_item = models.ForeignKey(
        ItemInstance,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    chest_item = models.ForeignKey(
        ItemInstance,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    feet_item = models.ForeignKey(
        ItemInstance,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    ring_item = models.ForeignKey(
        ItemInstance,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    amulet_item = models.ForeignKey(
        ItemInstance,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    last_room_broadcast_id = models.PositiveIntegerField(default=0)
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
