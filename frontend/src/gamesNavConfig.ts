export type GameNavItem = {
  to: string;
  label: string;
  emoji: string;
};

/** Shared game icon list for home/explore tiles. */
export const GAME_NAV_ITEMS: GameNavItem[] = [
  { to: "/clicker", label: "PondClicker", emoji: "🪷" },
  { to: "/whatif", label: "WhatIf", emoji: "🎲" },
  { to: "/estates", label: "Estates", emoji: "🏰" },
  {
    to: "/qff",
    label: "Quest For Fat IV (demo)",
    emoji: "⚔️",
  },
];

/** Staff-only game tiles (not shown on the home grid for non-staff). */
export const GAMES_MENU_STAFF_ITEMS: GameNavItem[] = [
  { to: "/harbor", label: "Harbormaster", emoji: "⚓" },
  { to: "/squalls", label: "Squalls & Shanties", emoji: "⛵" },
];

const STAFF_ONLY_GAME_PATHS = new Set(["/qff", "/harbor", "/squalls"]);

/** Hidden from non-staff on home/explore (like Meal Maestro in app nav). */
export function visibleGameNavItems(isStaff: boolean): GameNavItem[] {
  return GAME_NAV_ITEMS.filter(
    (item) => !STAFF_ONLY_GAME_PATHS.has(item.to) || isStaff,
  );
}

export function canOpenGameTile(to: string, isAuthenticated: boolean): boolean {
  if (
    to === "/estates" ||
    to === "/clicker" ||
    to === "/qff" ||
    to === "/harbor" ||
    to === "/squalls"
  ) {
    return isAuthenticated;
  }
  return true;
}
