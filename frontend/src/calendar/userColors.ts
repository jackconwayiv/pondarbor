/**
 * Color palette used for the user-checkbox calendar filter. Colors are
 * assigned in the order users are checked, cycling once we run past the
 * 10-color palette.
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
 * Resolve a per-user color from the ordered list of currently-checked user
 * ids. Returns `null` when the user is not in the list (so the caller can
 * skip rendering them entirely).
 */
export function colorForCheckedUser(
  userId: number,
  orderedCheckedUserIds: readonly number[],
): UserColorKey | null {
  const idx = orderedCheckedUserIds.indexOf(userId);
  if (idx < 0) return null;
  return USER_COLOR_ORDER[idx % USER_COLOR_ORDER.length];
}
