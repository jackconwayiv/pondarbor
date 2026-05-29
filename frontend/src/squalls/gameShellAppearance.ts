import type { GameLocationTypes, GameStateTypes } from "./shantiesTypes";

const SHIP_GRADIENT =
  "linear-gradient(180deg, #FFFFFF 0%, #BEE3F8 50%, #4A3728 100%)";
const SAILING_GRADIENT =
  "linear-gradient(180deg, #BEE3F8 0%, #1A365D 100%)";
const ISLAND_GRADIENT =
  "linear-gradient(180deg, #BEE3F8 0%, #9AE6B4 50%, #FAF089 100%)";
const DUNGEON_GRADIENT =
  "linear-gradient(180deg, #4A5568 0%, #2D3748 50%, #1A202C 100%)";
const COMBAT_GRADIENT =
  "linear-gradient(180deg, #E8A87C 0%, #E2E8F0 100%)";
const LOBBY_GRADIENT =
  "linear-gradient(180deg, #90CDF4 0%, #68D391 100%)";

/** Leading (top) stop of each scene gradient — used as the fade backdrop color. */
export function getSceneTopColor(
  gameState: GameStateTypes,
  location: GameLocationTypes,
): string {
  if (gameState === "lobby") return "#90CDF4";
  if (gameState === "battle") return "#E8A87C";
  if (location === "dungeon") return "#4A5568";
  if (location === "island") return "#BEE3F8";
  if (gameState === "sail" || gameState === "event") return "#BEE3F8";
  return "#FFFFFF";
}

export function getShellAppearance(
  gameState: GameStateTypes,
  location: GameLocationTypes,
): { background: string; color: string } {
  if (gameState === "lobby") {
    return { background: LOBBY_GRADIENT, color: "gray.900" };
  }

  if (gameState === "battle") {
    return { background: COMBAT_GRADIENT, color: "gray.900" };
  }

  if (location === "island") {
    return { background: ISLAND_GRADIENT, color: "gray.900" };
  }

  if (location === "dungeon") {
    return { background: DUNGEON_GRADIENT, color: "gray.100" };
  }

  if (gameState === "sail" || gameState === "event") {
    return { background: SAILING_GRADIENT, color: "gray.900" };
  }

  return { background: SHIP_GRADIENT, color: "gray.900" };
}
