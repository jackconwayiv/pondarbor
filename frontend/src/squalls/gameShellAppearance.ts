import type {
  GameLocationTypes,
  GameStateTypes,
  IndoorAreaKind,
} from "./shantiesTypes";
const SEA_BACKDROP = "#BFDFFF";
const ISLAND_BACKDROP = "#C8E1C0";
const COMBAT_BACKDROP = "#9D2B33";
const PORT_BACKDROP = "#F4EEE1";
const DUNGEON_BACKDROP = "#143E75";

function layerWorldBackground(base: string): string {
  return `radial-gradient(circle at 22% 8%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 44%), radial-gradient(circle at 50% 120%, rgba(0,0,0,0.13) 0%, rgba(0,0,0,0) 60%), ${base}`;
}

function getCombatGradient(
  location: GameLocationTypes,
  dungeonKind?: IndoorAreaKind | null,
): string {
  if (location === "island") {
    return `linear-gradient(180deg, ${COMBAT_BACKDROP} 0%, #B33D46 72%, ${ISLAND_BACKDROP} 100%)`;
  }
  if (location === "port") {
    return `linear-gradient(180deg, ${COMBAT_BACKDROP} 0%, #B33D46 72%, ${PORT_BACKDROP} 100%)`;
  }
  if (location === "dungeon") {
    return dungeonKind === "wreck"
      ? `linear-gradient(180deg, ${COMBAT_BACKDROP} 0%, #B33D46 70%, #0D4D67 100%)`
      : `linear-gradient(180deg, ${COMBAT_BACKDROP} 0%, #B33D46 70%, ${DUNGEON_BACKDROP} 100%)`;
  }
  return `linear-gradient(180deg, ${COMBAT_BACKDROP} 0%, #B33D46 72%, ${SEA_BACKDROP} 100%)`;
}

/** Leading (top) stop of each scene gradient — used as the fade backdrop color. */
export function getSceneTopColor(
  gameState: GameStateTypes,
  location: GameLocationTypes,
  dungeonKind?: IndoorAreaKind | null,
): string {
  if (gameState === "lobby") return SEA_BACKDROP;
  if (gameState === "battle") return COMBAT_BACKDROP;
  if (gameState === "levelUp") return PORT_BACKDROP;
  if (location === "dungeon") {
    return dungeonKind === "wreck" ? "#0E4D6A" : DUNGEON_BACKDROP;
  }
  if (location === "port") return PORT_BACKDROP;
  if (location === "island") return ISLAND_BACKDROP;
  if (gameState === "sail" || gameState === "event") return SEA_BACKDROP;
  return SEA_BACKDROP;
}

export function getShellAppearance(
  gameState: GameStateTypes,
  location: GameLocationTypes,
  dungeonKind?: IndoorAreaKind | null,
): { background: string; color: string } {
  if (gameState === "lobby") {
    return {
      background: layerWorldBackground(
        `linear-gradient(180deg, ${SEA_BACKDROP} 0%, #A7D2F6 100%)`,
      ),
      color: "gray.900",
    };
  }

  if (gameState === "battle") {
    return {
      background: layerWorldBackground(getCombatGradient(location, dungeonKind)),
      color: "gray.50",
    };
  }

  if (gameState === "levelUp") {
    return {
      background: layerWorldBackground(
        `linear-gradient(180deg, ${PORT_BACKDROP} 0%, #E8E0CF 100%)`,
      ),
      color: "gray.900",
    };
  }

  if (location === "island") {
    return {
      background: layerWorldBackground(
        `linear-gradient(180deg, ${ISLAND_BACKDROP} 0%, #B5D9A8 100%)`,
      ),
      color: "gray.900",
    };
  }

  if (location === "port") {
    return {
      background: layerWorldBackground(
        `linear-gradient(180deg, ${PORT_BACKDROP} 0%, #E8E0CF 100%)`,
      ),
      color: "gray.900",
    };
  }

  if (location === "dungeon") {
    return {
      background: layerWorldBackground(
        dungeonKind === "wreck"
          ? `linear-gradient(180deg, ${DUNGEON_BACKDROP} 0%, #0E4D6A 100%)`
          : `linear-gradient(180deg, ${DUNGEON_BACKDROP} 0%, #0C325E 100%)`,
      ),
      color: "gray.50",
    };
  }

  if (gameState === "sail" || gameState === "event") {
    return {
      background: layerWorldBackground(
        `linear-gradient(180deg, ${SEA_BACKDROP} 0%, #A7D2F6 100%)`,
      ),
      color: "gray.900",
    };
  }

  return {
    background: layerWorldBackground(
      `linear-gradient(180deg, ${SEA_BACKDROP} 0%, #A7D2F6 100%)`,
    ),
    color: "gray.900",
  };
}
