/**
 * App shell tab chrome aligned with Community Closet: pill triggers, bottom border
 * on the list row, teal fill when selected. Selected labels use a light color on
 * teal (not black / not `teal.contrast`).
 */
import { APP_TRANSITIONS } from "./motion";

export const APP_SHELL_TAB_SELECTED_FG = "white" as const;

const TAB_ON_TEAL = {
  bg: "teal.solid" as const,
  color: APP_SHELL_TAB_SELECTED_FG,
};

/** Spread on `Tabs.Trigger` together with `value` (and optional overrides). */
export const APP_SHELL_TAB_TRIGGER_PROPS = {
  borderRadius: "full",
  px: "3",
  py: "2",
  fontWeight: "semibold" as const,
  _selected: TAB_ON_TEAL,
  _hover: { bg: "bg.muted" },
  transition: APP_TRANSITIONS.backgroundStandard,
} as const;

/**
 * Primary shell tab bar (e.g. Closet, Quotes) — under the intro card, full width;
 * uses sticky + panel background so content scrolls beneath.
 */
export const APP_SHELL_TAB_LIST_PROPS = {
  px: { base: "2", md: "2" } as const,
  py: "2",
  borderBottomWidth: "1px",
  borderColor: "border",
  gap: "2",
  w: "100%",
  flexWrap: "wrap" as const,
  alignItems: "center" as const,
  position: "sticky" as const,
  top: "0",
  zIndex: "sticky",
  bg: "bg.panel",
} as const;

/**
 * Second-level tab row inside a tab panel, modal, or in-card (no sticky).
 */
export const APP_SHELL_TAB_LIST_NESTED_PROPS = {
  borderBottomWidth: "1px",
  borderColor: "border",
  gap: "2",
  w: "100%",
  flexWrap: "wrap" as const,
  alignItems: "center" as const,
  py: "2",
  bg: "bg.subtle",
} as const;

/**
 * In-card / below-heading tab row: nested bar with no side padding.
 */
export const APP_SHELL_TAB_LIST_INSET_PROPS = {
  ...APP_SHELL_TAB_LIST_NESTED_PROPS,
  px: 0,
} as const;

/**
 * Plan sub-tabs under Meal (`Weekly | Templates | …`), aligned with the outer shell tab row.
 */
export const APP_SHELL_TAB_LIST_MEAL_INNER_PROPS = {
  ...APP_SHELL_TAB_LIST_NESTED_PROPS,
  px: { base: "2", md: "2" } as const,
} as const;
