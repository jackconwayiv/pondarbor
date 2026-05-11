/** Member planets table: hidden rows (full chart data unchanged elsewhere). */
export const ZODIAC_MEMBER_PLANET_EXCLUDE_KEYS = new Set([
  "ceres",
  "pallas",
  "juno",
  "vesta",
  "lilith",
]);

/** Member aspects tab: keep only aspects touching at least one of these bodies. */
export const ZODIAC_ASPECT_ANCHOR_BODIES = new Set([
  "sun",
  "moon",
  "ascendant",
  "mercury",
  "venus",
  "mars",
  "midheaven",
]);
