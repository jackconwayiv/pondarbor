"""Shared QFF gameplay constants."""

# New characters: [`views._starting_room`] tries these hubs in order, then first room by PK.
# Multiple area slugs cover hyphen vs underscore and minor import/DM differences.
DEFAULT_START_AREA_SLUGS = ("survivors-camp", "survivors_camp")
DEFAULT_START_ROOM_NAME = "Village Brown"
DEFAULT_START_ROOM_SLUG = "village-brown"
# If area slug in DB does not match, still find the hub by display name + room name (case-insensitive).
DEFAULT_START_AREA_FALLBACK_NAMES = ("Survivors Camp",)

LEGACY_START_AREA_SLUGS = ("village-of-ort",)
LEGACY_START_ROOM_NAME = "Village Well"
LEGACY_START_ROOM_SLUG = "village-well"
LEGACY_START_AREA_FALLBACK_NAMES = ("Village of Ort",)

PRESENCE_MINUTES = 5
# Heroes with last_activity older than this are "inactive" in the HUD (still listed).
AFK_LOBBY_KICK_MINUTES = 10
SAY_MAX_LEN = 200
# Floor items: only removable by neglect after this long on the floor (since last drop).
FLOOR_ITEM_MIN_AGE_BEFORE_DELETE_MINUTES = 5

# Monsters / combat (see QFF plan)
COMBAT_ROUND_SECONDS = 6
PURSUIT_STEP_SECONDS = 2
MONSTER_SENSE_ADJACENT_DC = 50
XP_PER_LEVEL = 100

# Unarmed hero: weapon rating when main hand has no damage.
UNARMED_WEAPON_RATING = 1

# Death: keep equipped item if roll_d100() <= this percent cap (1 + guts // 8, max 25).
GUTS_EQUIPMENT_KEEP_GUTS_DIVISOR = 8
GUTS_EQUIPMENT_KEEP_MAX_PCT = 25
