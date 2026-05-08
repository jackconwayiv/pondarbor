export type GameNavItem = {
  to: string;
  label: string;
  emoji: string;
};

/** Shared game icon list used on Home and Games lobby. */
export const GAME_NAV_ITEMS: GameNavItem[] = [
  { to: "/clicker", label: "PondClicker", emoji: "🪷" },
  { to: "/whatif", label: "WhatIf", emoji: "🎲" },
  {
    to: "/qff",
    label: "Quest For Fat IV (demo)",
    emoji: "⚔️",
  },
];

export function canOpenGameTile(to: GameNavItem["to"], isAuthenticated: boolean): boolean {
  if (to === "/clicker" || to === "/qff") return isAuthenticated;
  return true;
}
