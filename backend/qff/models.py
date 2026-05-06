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
    # When true, play minimap uses fog-of-war for this whole area (torch radius, visited cells);
    # heroes who used a sconce here see the minimap as if the area were not dark.
    is_dark_minimap = models.BooleanField(default=False)
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
    search_reward_item = models.ForeignKey(
        "Item",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="rooms_search_reward",
        help_text="Optional: on first successful search roll per hero, mint one into inventory.",
    )
    search_reveals_exit = models.ForeignKey(
        "RoomExit",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="rooms_search_reveal_exit",
        help_text="Optional: on first successful search roll per hero, grant CharacterExitSeen for this exit.",
    )
    search_floor_once_item = models.ForeignKey(
        "Item",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="rooms_search_floor_once",
        help_text="Optional: on first successful search roll per hero, mint one unowned floor instance "
        "(once per character ever from this room).",
    )
    search_floor_quest_item = models.ForeignKey(
        "Item",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="rooms_search_floor_quest",
        help_text="Optional: with search_floor_quest_state, mint a quest-gated floor instance on "
        "successful search when eligible (while-instance: no duplicate on floor / not carrying).",
    )
    search_floor_quest_state = models.ForeignKey(
        "QuestState",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="rooms_search_floor_quest_gate",
        help_text="Required with search_floor_quest_item: only heroes in this quest state receive "
        "the spawn; minted instance uses this visible quest state.",
    )
    # Sconce / permanent light: visible on dark minimap even after temp lighting reset.
    permanent_minimap_light = models.BooleanField(default=False)
    # Entering this room clears character.dark_minimap_lit_room_ids (cave mouth, etc.).
    reset_dark_lighting_on_enter = models.BooleanField(default=False)
    # Monsters cannot enter; pursuit stops at threshold; hero combat engagement ends (v1).
    is_safe = models.BooleanField(default=False)
    # Entering sets Character.spawn_room to this room.
    is_spawn_point = models.BooleanField(default=False)
    monster_lair_template = models.ForeignKey(
        "MonsterTemplate",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lair_rooms",
    )
    lair_last_instance = models.ForeignKey(
        "MonsterInstance",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="remembered_by_lairs",
    )
    lair_next_spawn_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["area_id", "name"]
        indexes = [
            models.Index(fields=["lair_next_spawn_at"]),
        ]

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
    # If False, carrying the key is enough to pass; the item is not destroyed or decremented.
    consume_key_on_pass = models.BooleanField(default=True)

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

    class ConsumeVerb(models.TextChoices):
        ANY = "", "Any (eat / drink / use / read)"
        EAT = "eat", "Eat"
        DRINK = "drink", "Drink"
        USE = "use", "Use"
        READ = "read", "Read"

    class RequiredGlyphsMode(models.TextChoices):
        AND = "and", "All required (AND)"
        OR = "or", "Any required (OR)"

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
        help_text="If true, eat/drink/use/read can consume from inventory (non-consumables cannot).",
    )
    consume_verb = models.CharField(
        max_length=8,
        choices=ConsumeVerb.choices,
        blank=True,
        default=ConsumeVerb.ANY,
        help_text="Which verb must the player use to consume this? Blank = any (legacy).",
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
    required_glyphs = models.JSONField(
        default=list,
        blank=True,
        help_text="Up to two required glyphs for equip/use; empty means no glyph gate.",
    )
    required_glyphs_mode = models.CharField(
        max_length=8,
        choices=RequiredGlyphsMode.choices,
        default=RequiredGlyphsMode.AND,
        help_text="How to evaluate two required glyphs: AND (both) or OR (either).",
    )
    bonus_gains = models.SmallIntegerField(default=0)
    bonus_moves = models.SmallIntegerField(default=0)
    bonus_guts = models.SmallIntegerField(default=0)
    bonus_smarts = models.SmallIntegerField(default=0)
    bonus_sense = models.SmallIntegerField(default=0)
    bonus_rizz = models.SmallIntegerField(default=0)
    weapon_accuracy = models.SmallIntegerField(default=0)
    crit_chance_bonus_pct = models.SmallIntegerField(
        default=0,
        help_text="Added as percentage points to crit chance (5 = +5%).",
    )
    crit_damage_bonus = models.FloatField(
        default=0.0,
        help_text="Added as percentage points to crit multiplier (10 = +0.10x).",
    )
    penetration = models.PositiveSmallIntegerField(default=0)
    dodge_bonus = models.SmallIntegerField(default=0)
    dodge_reduction = models.SmallIntegerField(
        default=0,
        help_text="Reduces target effective dodge when you attack.",
    )
    dodge_ignore = models.SmallIntegerField(
        default=0,
        help_text="Further reduces target effective dodge when you attack.",
    )
    stackable = models.BooleanField(
        default=False,
        help_text="If true, inventory merges same-template stacks up to max_stack per row.",
    )
    max_stack = models.PositiveSmallIntegerField(
        default=99,
        help_text="Max units per ItemInstance when stackable (clamped 1–9999 in logic).",
    )
    extra_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Template metadata; e.g. consume_effects list for consumable items.",
    )
    unsellable = models.BooleanField(
        default=False,
        help_text="If true, players cannot sell this template to vendors.",
    )
    vendor_refuses_buy = models.BooleanField(
        default=False,
        help_text="If true, vendors treat this as junk and will not buy it from players.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class ItemInstance(models.Model):
    """A concrete item somewhere in the realm."""

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="instances")
    quantity = models.PositiveIntegerField(
        default=1,
        help_text="Stack size when item.stackable; always 1 for non-stackable templates.",
    )
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
    container_interactable = models.ForeignKey(
        "Interactable",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="container_items",
        help_text="If set, this floor item is inside this container (not loose in the room).",
    )
    is_crafted = models.BooleanField(
        default=False,
        help_text="If true, shop consignment decay does not apply to this instance.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["owner_character", "room"]),
            models.Index(fields=["container_interactable", "room"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1),
                name="qff_iteminstance_quantity_gte_1",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.item.name}#{self.pk}"


class CharacterItemLoreUnlocked(models.Model):
    """Per-character, per-item-template lore is revealed for all instances of that template."""

    character = models.ForeignKey(
        "Character",
        on_delete=models.CASCADE,
        related_name="item_lore_unlocks",
    )
    item = models.ForeignKey(
        "Item",
        on_delete=models.CASCADE,
        related_name="lore_unlocked_for_characters",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["character", "item"],
                name="qff_charitemlore_uniq",
            )
        ]


class RoomItem(models.Model):
    """DM-placed item template in a room; get mints a new ItemInstance per player (not a shared floor row)."""

    class MintPolicy(models.TextChoices):
        WHILE_INSTANCE = (
            "while_instance",
            "Once if item no longer exists (per hero)",
        )
        ONCE_EVER = (
            "once_ever",
            "Once per character (never again from this slot)",
        )

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
    allow_repeat_while_carrying = models.BooleanField(
        default=False,
        help_text="If true, slot stays visible even when the character already carries this "
        "template (e.g. farmable pickups). Default hides while carrying.",
    )
    interactable = models.ForeignKey(
        "Interactable",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="container_room_items",
        help_text="If set, this pickup appears only while this container is focused (opened).",
    )
    mint_policy = models.CharField(
        max_length=32,
        choices=MintPolicy.choices,
        default=MintPolicy.WHILE_INSTANCE,
        help_text="while_instance: hide while this hero's minted instance still exists. "
        "once_ever: hide forever after this hero's first successful get from this slot.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["room_id", "id"]

    def __str__(self) -> str:
        return f"{self.room_id} {self.item.name}"


class RoomItemCharacterClaim(models.Model):
    """Permanent per-hero claim for a room-item slot when mint_policy is once_ever (survives item delete)."""

    room_item = models.ForeignKey(
        RoomItem, on_delete=models.CASCADE, related_name="character_claims"
    )
    character = models.ForeignKey(
        "Character", on_delete=models.CASCADE, related_name="room_item_character_claims"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["room_item", "character"],
                name="qff_roomitemcharacterclaim_unique_slot_hero",
            ),
        ]
        # Index names pinned to what migration 0044 created; without explicit
        # ``name=`` Django re-derives a hash that drifts across versions and
        # triggers spurious ``RenameIndex`` migrations.
        indexes = [
            models.Index(
                fields=["room_item", "character"],
                name="qff_roomitemclaim_room_ch_idx",
            ),
        ]


class RoomItemSpawn(models.Model):
    """A RoomItem pickup by a specific hero. Cascades away when the underlying ItemInstance is deleted (consumed), re-opening the slot."""

    room_item = models.ForeignKey(
        RoomItem, on_delete=models.CASCADE, related_name="spawns"
    )
    character = models.ForeignKey(
        "Character", on_delete=models.CASCADE, related_name="room_item_spawns"
    )
    item_instance = models.ForeignKey(
        "ItemInstance",
        on_delete=models.CASCADE,
        related_name="room_item_spawn_origins",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Index names pinned to what migration 0037 created (see RoomItemCharacterClaim above).
        indexes = [
            models.Index(
                fields=["room_item", "character"],
                name="qff_roomite_room_it_7f2a91_idx",
            ),
            models.Index(
                fields=["character", "room_item"],
                name="qff_roomite_charact_b3c4d5_idx",
            ),
        ]


class RoomBroadcast(models.Model):
    """Room-level delivery; ``scope`` labels logical reach (room vs realm fanout vs future party/guild)."""

    class Scope(models.TextChoices):
        ROOM = "room", "Room"
        REALM = "realm", "Realm"
        PARTY = "party", "Party"  # reserved
        GUILD = "guild", "Guild"  # reserved

    room = models.ForeignKey(
        Room, on_delete=models.CASCADE, related_name="broadcasts"
    )
    speaker = models.ForeignKey(
        "Character",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="room_broadcasts_sent",
    )
    target_character = models.ForeignKey(
        "Character",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="room_broadcasts_targeted",
    )
    text = models.CharField(max_length=500)
    # Combat log tint in play HUD (hero_hit / enemy_hit / miss); empty = default.
    log_tone = models.CharField(max_length=16, blank=True, default="")
    scope = models.CharField(
        max_length=16,
        choices=Scope.choices,
        default=Scope.ROOM,
    )
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
        help_text=(
            "Ordered glyph ids from character creation/evolution (emoji strings)."
        ),
    )
    glyph_levels = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            "Per-glyph level values aligned with glyphs order. Invariant: "
            "sum(glyph_levels) == character.level for characters with glyphs."
        ),
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
    # Temporarily lit room ids for dark minimap (torch / lamp oil); cleared at flagged entrances.
    dark_minimap_lit_room_ids = models.JSONField(default=list, blank=True)
    # When set, ``dark_minimap_lit_room_ids`` is recomputed from the hero's current cell at this radius.
    dark_minimap_torch_radius = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
    )
    # Legacy: room ids from older sconce saves; mapped to areas for minimap/narrative (prefer sconce area list).
    hero_permanent_minimap_lit_room_ids = models.JSONField(default=list, blank=True)
    # Areas where this hero lit a sconce: minimap behaves like a non-dark area; persists past temp-light resets.
    sconce_full_narrative_area_ids = models.JSONField(default=list, blank=True)
    # Dungeon map item: reveal all visited rooms in this area until expiry.
    minimap_full_reveal_area = models.ForeignKey(
        "Area",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="characters_map_reveal",
    )
    minimap_full_reveal_until = models.DateTimeField(null=True, blank=True)
    # Last opened container for get-from-chest (cleared on room change).
    container_focus_interactable = models.ForeignKey(
        "Interactable",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="characters_with_focus",
    )
    container_focus_expires_at = models.DateTimeField(null=True, blank=True)
    # Durable "opened" container for UI / get-put (cleared on room change); use with container kinds.
    opened_container_interactable = models.ForeignKey(
        "Interactable",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="characters_with_opened_container",
    )
    # Combat pacing (armed by /attack); cleared on safe-room disengage.
    next_action_at = models.DateTimeField(null=True, blank=True)
    combat_target_monster = models.ForeignKey(
        "MonsterInstance",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="targeted_by_heroes",
    )
    last_command_at = models.DateTimeField(null=True, blank=True)
    is_dead = models.BooleanField(default=False)
    died_at = models.DateTimeField(null=True, blank=True)
    unspent_stat_points = models.PositiveSmallIntegerField(default=0)
    # Pending y/n confirm from a service NPC (healer_pay / innkeeper_stay).
    # Shape: {"kind": str, "npc_id": int, "cost": int}. Cleared on accept/decline or fall-through.
    pending_prompt = models.JSONField(null=True, blank=True, default=None)
    # False while the player is in the lobby; True once they've entered the realm.
    # Presence filters hide out-of-realm characters from other players.
    is_in_realm = models.BooleanField(default=True)
    # Set when /leave is issued in an unsafe room; completion happens in the sim tick.
    pending_leave_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["current_room", "last_activity_at"]),
            models.Index(fields=["next_action_at"]),
            models.Index(fields=["pending_leave_at"]),
            models.Index(fields=["died_at"]),
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


class CharacterRoomSearchClaim(models.Model):
    """Tracks one-time search rewards per hero per room (item mint / exit reveal)."""

    character = models.ForeignKey(
        Character, on_delete=models.CASCADE, related_name="room_search_claims"
    )
    room = models.ForeignKey(
        Room, on_delete=models.CASCADE, related_name="search_claims"
    )
    successful_search = models.BooleanField(
        default=False,
        help_text="Set after this hero's first successful search roll in this room.",
    )
    item_reward_granted = models.BooleanField(default=False)
    exit_reward_granted = models.BooleanField(default=False)
    floor_once_reward_granted = models.BooleanField(
        default=False,
        help_text="Set when search_floor_once_item was minted to the floor for this hero.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["character", "room"],
                name="qff_charroomsearchclaim_uniq",
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
    requires_item_quantity = models.PositiveIntegerField(
        default=1,
        help_text="Total quantity required across inventory stacks + equipped.",
    )
    revert_after_minutes = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="If set, character quest state reverts after this many minutes (silent rewind).",
    )
    revert_to_state = models.ForeignKey(
        QuestState,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="transitions_revert_to",
        help_text="State to revert to; defaults to from_state when null.",
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
    quest_revert_at = models.DateTimeField(null=True, blank=True)
    quest_revert_to_state = models.ForeignKey(
        QuestState,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="quest_progress_pending_revert",
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
    is_trainer = models.BooleanField(default=False)
    is_healer = models.BooleanField(default=False)
    is_innkeeper = models.BooleanField(default=False)
    healing_cost = models.PositiveIntegerField(
        default=0,
        help_text="Gold for a heal (healer) or a night's stay (innkeeper). 0 = free.",
    )

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


class NpcShop(models.Model):
    """Merchant inventory and pricing attached to one NPC."""

    npc = models.OneToOneField(
        Npc,
        on_delete=models.CASCADE,
        related_name="shop",
    )
    welcome_text = models.TextField(
        blank=True,
        help_text="Shown when players list the shop (shop / list / buy with no args).",
    )
    enabled = models.BooleanField(default=True)
    sell_price_percent = models.PositiveSmallIntegerField(
        default=50,
        help_text="Percent of Item.cost offered when a player sells (e.g. 50 = half).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Shop({self.npc_id})"


class NpcShopStockLine(models.Model):
    """One offer row in an NPC shop (static restock or player consignment)."""

    class Kind(models.TextChoices):
        STATIC = "static", "Static"
        CONSIGNMENT = "consignment", "Consignment"

    shop = models.ForeignKey(
        NpcShop,
        on_delete=models.CASCADE,
        related_name="stock_lines",
    )
    item = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        related_name="shop_stock_lines",
    )
    price = models.PositiveIntegerField(help_text="Gold per purchase (per unit for stackable).")
    quantity = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Stock remaining; null = unlimited (static only).",
    )
    sort_order = models.PositiveSmallIntegerField(default=0)
    kind = models.CharField(
        max_length=16,
        choices=Kind.choices,
        default=Kind.STATIC,
    )
    times_shown_without_sale = models.PositiveSmallIntegerField(
        default=0,
        help_text="Consignment: increments when listed and not bought; removed at 5 (unless crafted).",
    )
    consignment_item_instance = models.OneToOneField(
        ItemInstance,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="shop_consignment_line",
        help_text="If set, this row sells that exact instance (consignment).",
    )

    class Meta:
        ordering = ["shop_id", "sort_order", "id"]

    def __str__(self) -> str:
        return f"{self.shop_id} {self.item.name}"


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
        READABLE = "readable", "Readable"
        CONTAINER = "container", "Container"
        BUTTON = "button", "Button"
        LEVER = "lever", "Lever"
        SWITCH = "switch", "Switch"
        PULLEY = "pulley", "Pulley"
        SCONCE = "sconce", "Sconce"
        MAP = "map", "Map"
        OTHER = "other", "Other"

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="interactables")
    slug = models.SlugField(max_length=80)
    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.OTHER)
    inspect_text = models.TextField(blank=True)
    read_text = models.TextField(
        blank=True,
        help_text="Long text for read; falls back to inspect_text when empty.",
    )
    untranslated = models.BooleanField(
        default=False,
        help_text="If true, /read uses read_text only; heroes without the 👽 glyph get a denial line "
        "and never see the alien text. look/inspect still use inspect_text.",
    )
    map_reveal_minutes = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="For kind=map: duration of full visited-map reveal in this area.",
    )
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
    unlocks_exit_secondary = models.ForeignKey(
        RoomExit,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="interactable_unlocks_secondary",
        help_text="Optional return leg: must be the mutual opposite of unlocks_exit (B→A if primary is A→B).",
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


class MonsterTemplate(models.Model):
    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=200)
    spawn_cooldown_minutes = models.PositiveSmallIntegerField(default=5)
    level = models.PositiveSmallIntegerField(default=1)
    max_hp = models.PositiveSmallIntegerField(default=5)
    damage_min = models.PositiveSmallIntegerField(default=1)
    damage_max = models.PositiveSmallIntegerField(default=3)
    moves = models.PositiveSmallIntegerField(
        default=0,
        help_text="Added to d100 for initiative (0 if not set).",
    )
    xp_value = models.PositiveIntegerField(default=5)
    gold_min = models.PositiveIntegerField(default=0)
    gold_max = models.PositiveIntegerField(default=3)
    loot_table = models.JSONField(default=list, blank=True)
    quest_drops = models.JSONField(
        default=list,
        blank=True,
        help_text="Quest-only drop rows (separate from loot_table). Each row may include quest_state_id, item_slug/item_id, per_kill_qty, chance.",
    )
    armor = models.PositiveSmallIntegerField(
        default=0,
        help_text="Physical mitigation when this monster is hit.",
    )
    accuracy = models.SmallIntegerField(
        default=0,
        help_text="WeaponAccuracy term when this monster attacks.",
    )
    penetration = models.PositiveSmallIntegerField(default=0)
    crit_chance_bonus_pct = models.SmallIntegerField(
        default=0,
        help_text="Percentage points added to crit chance (same semantics as Item).",
    )
    crit_damage_bonus = models.FloatField(
        default=0.0,
        help_text="Added as percentage points to crit multiplier (10 = +0.10x).",
    )
    dodge_reduction = models.SmallIntegerField(default=0)
    dodge_ignore = models.SmallIntegerField(default=0)
    description = models.TextField(blank=True)
    hidden_description = models.TextField(blank=True)
    lore_dc = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Look/inspect: hero needs d100+Smarts (encumbered) ≥ this DC for hidden text; null uses template level.",
    )
    attack_weapon_label = models.CharField(
        max_length=120,
        blank=True,
        help_text="Optional flavor for monster hit lines (e.g. claws, rusty blade).",
    )
    attack_verb = models.CharField(
        max_length=80,
        blank=True,
        help_text="Optional verb for strikes/misses (e.g. bites, claws, slashes). Empty = default text.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class MonsterInstance(models.Model):
    template = models.ForeignKey(
        MonsterTemplate,
        on_delete=models.CASCADE,
        related_name="instances",
    )
    current_room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="monster_instances",
    )
    lair_room = models.ForeignKey(
        Room,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lair_spawned_instances",
    )
    engaged_character = models.ForeignKey(
        Character,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="monsters_engaged",
    )
    pursuit_target_character = models.ForeignKey(
        Character,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="monsters_pursuing",
    )
    pursuit_path = models.JSONField(default=list, blank=True)
    cur_hp = models.PositiveSmallIntegerField(default=1)
    max_hp = models.PositiveSmallIntegerField(default=1)
    next_action_at = models.DateTimeField(null=True, blank=True)
    next_pursuit_at = models.DateTimeField(null=True, blank=True)
    monster_strike_pending = models.BooleanField(
        default=False,
        help_text="Legacy field; kept for migrations. Combat no longer uses a separate wind-up tick.",
    )
    xp_contribution = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(fields=["current_room"]),
            models.Index(fields=["next_action_at"]),
            models.Index(fields=["next_pursuit_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.template.name}@{self.current_room_id}"


class RoomGoldPile(models.Model):
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="gold_piles",
    )
    amount_remaining = models.PositiveIntegerField()
    label = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]


class QffIneffectiveInput(models.Model):
    """Commands that parse as unknown and produce 'nothing happens.' (staff review)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="qff_ineffective_inputs",
    )
    user_email = models.CharField(max_length=254)
    raw_line = models.TextField()
    room = models.ForeignKey(
        Room,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="qff_ineffective_inputs",
        help_text="Room the character was in when the command was issued (may be null if deleted).",
    )
    room_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="Snapshot of room name at log time (for display even if room is renamed).",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user_email!r} @ {self.created_at}"
