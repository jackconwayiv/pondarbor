"""Shared QFF gameplay constants."""

# New characters: [`views._starting_room`] tries these in order, then first room by PK.
DEFAULT_START_AREA_SLUG = "survivors-camp"
DEFAULT_START_ROOM_NAME = "Village Brown"
LEGACY_START_AREA_SLUG = "village-of-ort"
LEGACY_START_ROOM_NAME = "Village Well"

PRESENCE_MINUTES = 5
SAY_MAX_LEN = 200
# Floor items: only removable by neglect after this long on the floor (since last drop).
FLOOR_ITEM_MIN_AGE_BEFORE_DELETE_MINUTES = 5

# Monsters / combat (see QFF plan)
COMBAT_ROUND_SECONDS = 6
PURSUIT_STEP_SECONDS = 2
MONSTER_SENSE_ADJACENT_DC = 50
XP_PER_LEVEL = 100
