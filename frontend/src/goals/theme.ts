/** Summer-camp palette scoped to Goal-Getter (not global tokens). */
export const GOALS_THEME = {
  lakeBlue: "#2E6F9E",
  lakeLight: "#A8D4E8",
  pineGreen: "#2D6A4F",
  pineLight: "#B7E4C7",
  gold: "#D4A017",
  goldLight: "#F5E6A8",
  cabinRed: "#B84A3A",
  canvas: "#F4F9F4",
  /** Earned patch (period or goal complete). */
  patchGoldBg: "#F7E7B8",
  patchGoldBorder: "#C9A227",
  /** Incomplete ongoing (continuous) patch. */
  patchOngoingBg: "#D4EDDA",
  patchOngoingBorder: "#2D6A4F",
  /** Incomplete completable (one-time) patch. */
  patchCompletableBg: "#D6EAF5",
  patchCompletableBorder: "#2E6F9E",
  /** Incomplete chore patch. */
  patchChoreBg: "#FFE8CC",
  patchChoreBorder: "#E07A2F",
  /** Paused or neutral fallback. */
  patchSilverBg: "#E8EDF2",
  patchSilverBorder: "#8B9AAB",
  /** Desktop badge stats card (matches app navy + soft gray). */
  cardBodyBg: "#F3F4F6",
  cardBodyBorder: "#0B2545",
  patchBorder: "#1B4332",
  textOnLight: "#1B3A2F",
  textMuted: "#4A6B5C",
  socketEmpty: "#C5CDD6",
  socketEmptyBorder: "#8B9AAB",
  socketFilled: "#D4A017",
} as const;

/** Stats-tab “Add checkpoint” trigger. Hover only deepens blue. */
export const GOAL_ADD_MILESTONE_BUTTON_PROPS = {
  border: "2px solid",
  borderColor: GOALS_THEME.lakeBlue,
  bg: GOALS_THEME.lakeLight,
  color: GOALS_THEME.textOnLight,
  fontWeight: "semibold",
  _hover: { bg: "#92c5e0" },
} as const;
