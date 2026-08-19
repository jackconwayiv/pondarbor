/**
 * Color palette used for the user-checkbox calendar filter. Colors are
 * assigned by position in the people list (display order), cycling once we
 * run past the 10-color palette. Checking or unchecking a person does not
 * reassign anyone else's color; an unchecked swatch is simply hidden.
 *
 * Each entry is a Chakra-friendly color name plus a fallback CSS string for
 * components that need to set raw CSS (e.g. inline styles or boxShadow).
 * The Chakra theme tokens used by the rest of the app (lilypad/sky/...) only
 * cover a subset of these visually-distinct colors, so we use the full
 * default Chakra palette here.
 */
export type UserColorKey =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "cyan"
  | "blue"
  | "purple"
  | "pink"
  | "brown"
  | "gray";

export const USER_COLOR_ORDER: readonly UserColorKey[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "blue",
  "purple",
  "pink",
  "brown",
  "gray",
] as const;

/** Solid CSS color used for the day bars and checkbox swatches. */
export const USER_COLOR_HEX: Record<UserColorKey, string> = {
  red: "#e53e3e",
  orange: "#dd6b20",
  yellow: "#d69e2e",
  green: "#38a169",
  cyan: "#0bc5ea",
  blue: "#3182ce",
  purple: "#805ad5",
  pink: "#d53f8c",
  brown: "#8b5a2b",
  gray: "#718096",
};

/** A high-contrast text color for use on top of the solid color above. */
export const USER_COLOR_TEXT_ON: Record<UserColorKey, string> = {
  red: "white",
  orange: "white",
  yellow: "black",
  green: "white",
  cyan: "black",
  blue: "white",
  purple: "white",
  pink: "white",
  brown: "white",
  gray: "white",
};

/**
 * Color assigned to a user from their position in the people list.
 * Returns `null` when the user is not in the list.
 */
export function colorAssignedToUser(
  userId: number,
  allUserIdsInDisplayOrder: readonly number[],
): UserColorKey | null {
  const idx = allUserIdsInDisplayOrder.indexOf(userId);
  if (idx < 0) return null;
  return USER_COLOR_ORDER[idx % USER_COLOR_ORDER.length];
}

/**
 * Color to paint for a currently-visible (checked) user. Unchecked users
 * keep their assignment via {@link colorAssignedToUser} but this returns
 * `null` so callers skip drawing them.
 */
export function colorForCheckedUser(
  userId: number,
  checkedUserIds: readonly number[],
  allUserIdsInDisplayOrder: readonly number[],
): UserColorKey | null {
  if (!checkedUserIds.includes(userId)) return null;
  return colorAssignedToUser(userId, allUserIdsInDisplayOrder);
}
