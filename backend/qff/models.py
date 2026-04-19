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

    class KeyUnlockScope(models.TextChoices):
        REALM_TIMED = "realm_timed", "Realm (timed)"
        CHARACTER = "character", "Character only"

    key_item = models.ForeignKey(
        "Item",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="exit_keys_for",
    )
    key_unlock_scope = models.CharField(
        max_length=16,
        choices=KeyUnlockScope.choices,
        default=KeyUnlockScope.REALM_TIMED,
    )
    device_interactable = models.ForeignKey(
        "Interactable",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="device_for_exits",
    )
    quest_required_state = models.ForeignKey(
        "QuestState",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="exits_requiring_state",
    )
    # When is_hidden: exit is shown only if all set conditions are met (AND).
    reveal_item = models.ForeignKey(
        "Item",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="exits_revealed_by_item",
    )
    reveal_quest_state = models.ForeignKey(
        "QuestState",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="exits_revealed_by_quest_state",
    )
    unlock_duration_seconds = models.PositiveIntegerField(
        default=600,
        help_text="Realm-timed unlock duration (KEY realm_timed, DEVICE).",
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
    # Null = not equippable (quest items, consumables without a wear slot, etc.).
    slot = models.CharField(
        max_length=16,
        choices=Slot.choices,
        null=True,
        blank=True,
    )
    consumable = models.BooleanField(
        default=False,
        help_text="If true, eat/drink/use can consume from inventory (non-consumables cannot).",
    )
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
    visible_quest_state = models.ForeignKey(
        "QuestState",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="floor_item_instances_visible",
        help_text="If set, only characters in this quest state see this floor item; "
        "hidden if they already carry this item template.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["owner_character", "room"]),
        ]

    def __str__(self) -> str:
        return f"{self.item.name}#{self.pk}"


class RoomItem(models.Model):
    """DM-placed item template in a room; get mints a new ItemInstance per player (not a shared floor row)."""

    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="room_items",
    )
    item = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        related_name="room_item_slots",
    )
    nickname = models.CharField(max_length=200, blank=True, null=True)
    visible_quest_state = models.ForeignKey(
        "QuestState",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="room_items_visible",
        help_text="If set, only characters in this quest state see this slot; "
        "hidden if they carry this item template; hidden if an unowned floor instance "
        "of this template exists in the room.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["room_id", "id"]

    def __str__(self) -> str:
        return f"{self.room_id} {self.item.name}"


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
    gold = models.PositiveIntegerField(default=0)
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
    glyphs = models.JSONField(
        default=list,
        blank=True,
        help_text="Ordered glyph ids from character creation: war, survival, study, devotion.",
    )
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


# --- Quests, NPCs, interactables ---


class Quest(models.Model):
    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class QuestState(models.Model):
    quest = models.ForeignKey(Quest, on_delete=models.CASCADE, related_name="states")
    slug = models.SlugField(max_length=80)
    name = models.CharField(max_length=200, blank=True)
    is_initial = models.BooleanField(default=False)
    is_terminal = models.BooleanField(default=False)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["quest_id", "sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["quest", "slug"],
                name="qff_queststate_quest_slug_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.quest.slug}:{self.slug}"


class QuestTransition(models.Model):
    """Single edge in a quest graph; effects run when the transition fires."""

    quest = models.ForeignKey(Quest, on_delete=models.CASCADE, related_name="transitions")
    from_state = models.ForeignKey(
        QuestState,
        on_delete=models.CASCADE,
        related_name="transitions_from",
    )
    to_state = models.ForeignKey(
        QuestState,
        on_delete=models.CASCADE,
        related_name="transitions_to",
    )
    requires_item = models.ForeignKey(
        Item,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        help_text="If set, character must carry this item template (inventory or equipped).",
    )
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["quest_id", "sort_order", "id"]

    def __str__(self) -> str:
        return f"{self.quest_id} {self.from_state_id}→{self.to_state_id}"


class QuestEffect(models.Model):
    class Kind(models.TextChoices):
        GRANT_XP = "grant_xp", "Grant XP"
        GRANT_GOLD = "grant_gold", "Grant gold"
        GRANT_ITEM = "grant_item", "Grant item (new instance)"
        REMOVE_ITEM_TEMPLATE = "remove_item_template", "Remove item by template"
        REALM_UNLOCK_EXIT_TIMED = "realm_unlock_exit_timed", "Realm unlock exit (timed)"
        CHARACTER_UNLOCK_EXIT = "character_unlock_exit", "Character unlock exit"

    transition = models.ForeignKey(
        QuestTransition,
        on_delete=models.CASCADE,
        related_name="effects",
    )
    kind = models.CharField(max_length=32, choices=Kind.choices)
    amount = models.IntegerField(
        default=0,
        help_text="XP, gold, or unlock duration in minutes for timed realm unlock.",
    )
    item = models.ForeignKey(
        Item,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    room_exit = models.ForeignKey(
        RoomExit,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="quest_effects",
    )
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["transition_id", "sort_order", "id"]


class CharacterQuestProgress(models.Model):
    character = models.ForeignKey(
        Character,
        on_delete=models.CASCADE,
        related_name="quest_progress",
    )
    quest = models.ForeignKey(Quest, on_delete=models.CASCADE, related_name="character_progress")
    current_state = models.ForeignKey(
        QuestState,
        on_delete=models.PROTECT,
        related_name="characters_here",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["character", "quest"],
                name="qff_charquestprogress_uniq",
            ),
        ]


class Npc(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="npcs")
    slug = models.SlugField(max_length=80)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["room", "slug"],
                name="qff_npc_room_slug_uniq",
            ),
        ]
        ordering = ["room_id", "name"]

    def __str__(self) -> str:
        return self.name


class NpcDialogue(models.Model):
    npc = models.ForeignKey(Npc, on_delete=models.CASCADE, related_name="dialogues")
    quest = models.ForeignKey(
        Quest,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="npc_dialogues",
    )
    quest_state = models.ForeignKey(
        QuestState,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="npc_dialogues",
    )
    priority = models.PositiveSmallIntegerField(default=0)
    text = models.TextField()

    class Meta:
        ordering = ["npc_id", "-priority", "id"]


class Interactable(models.Model):
    class Kind(models.TextChoices):
        SIGN = "sign", "Sign"
        CHEST = "chest", "Chest"
        BUTTON = "button", "Button"
        LEVER = "lever", "Lever"
        OTHER = "other", "Other"

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="interactables")
    slug = models.SlugField(max_length=80)
    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.OTHER)
    inspect_text = models.TextField(blank=True)
    quest_transition = models.ForeignKey(
        QuestTransition,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="interactables",
    )
    unlocks_exit = models.ForeignKey(
        RoomExit,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="interactable_unlocks",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["room", "slug"],
                name="qff_interactable_room_slug_uniq",
            ),
        ]
        ordering = ["room_id", "name"]


class RealmExitUnlock(models.Model):
    """Realm-wide timed access; one active row per exit (replaced on extend)."""

    room_exit = models.OneToOneField(
        RoomExit,
        on_delete=models.CASCADE,
        related_name="realm_unlock",
    )
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["expires_at"]),
        ]


class CharacterExitUnlock(models.Model):
    character = models.ForeignKey(
        Character,
        on_delete=models.CASCADE,
        related_name="exit_unlocks",
    )
    room_exit = models.ForeignKey(
        RoomExit,
        on_delete=models.CASCADE,
        related_name="character_unlocks",
    )
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Null = permanent for this character.",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["character", "room_exit"],
                name="qff_charexitunlock_uniq",
            ),
        ]


class QffIneffectiveInput(models.Model):
    """Commands that parse as unknown and produce 'nothing happens.' (staff review)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="qff_ineffective_inputs",
    )
    user_email = models.CharField(max_length=254)
    raw_line = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user_email!r} @ {self.created_at}"
