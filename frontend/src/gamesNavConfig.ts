export type GameNavItem = {
  to: string;
  label: string;
  emoji: string;
};

/** Shared game icon list used on Home and Games lobby (order matches home grid). */
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

/** Staff-only tiles on the Games lobby (not shown on the home grid). */
export const GAMES_MENU_STAFF_ITEMS: GameNavItem[] = [
  { to: "/harbor", label: "Harbormaster", emoji: "⚓" },
];

const STAFF_ONLY_GAME_PATHS = new Set(["/qff", "/harbor"]);

/** Hidden from non-staff on home and Games lobby (like Meal Maestro in app nav). */
export function visibleGameNavItems(isStaff: boolean): GameNavItem[] {
  return GAME_NAV_ITEMS.filter(
    (item) => !STAFF_ONLY_GAME_PATHS.has(item.to) || isStaff,
  );
}

/** Games lobby grid: shared games plus staff-only extras (e.g. Harbormaster). */
export function visibleGamesMenuItems(isStaff: boolean): GameNavItem[] {
  return [
    ...visibleGameNavItems(isStaff),
    ...(isStaff ? GAMES_MENU_STAFF_ITEMS : []),
  ];
}

export function canOpenGameTile(to: string, isAuthenticated: boolean): boolean {
  if (
    to === "/estates" ||
    to === "/clicker" ||
    to === "/qff" ||
    to === "/harbor"
  ) {
    return isAuthenticated;
  }
  return true;
}
