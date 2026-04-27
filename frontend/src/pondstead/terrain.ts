import type { BuildingKind, GroundKind } from "./types";

/** Open grass; same fill for S/W/F and other grass-like resource tiles. */
const GRASS_BG = "#e6efd4";

/** Tile background fill. Black grid lines are drawn on the map grid, not per-terrain. */
export function groundStyle(ground: GroundKind): { bg: string } {
  switch (ground) {
    case "grass":
    case "berry":
    case "reed":
      return { bg: GRASS_BG };
    case "marsh":
      return { bg: "#cde5d8" };
    case "water":
      return { bg: "#c5e2f2" };
    default: {
      const _x: never = ground;
      return _x;
    }
  }
}

export const RESOURCE_EMOJI: Record<"stone" | "wood" | "food", string> = {
  stone: "🪨",
  wood: "🪵",
  food: "🫐",
};

const BUILDING_LABEL: Record<Exclude<BuildingKind, "none">, string> = {
  hq: "Headquarters",
  orchard: "Orchard",
  camp: "Camp",
  quarry: "Quarry",
  granary: "Granary",
  sawmill: "Sawmill",
  masonYard: "Mason’s Yard",
  wall: "Wall",
  barracks: "Barracks",
  lighthouse: "Lighthouse",
  colossus: "Colossus",
  mausoleum: "Mausoleum",
  pyramid: "Pyramid",
  academy: "Academy",
};

const BUILDING_MODAL_TITLE: Record<Exclude<BuildingKind, "none">, string> = {
  hq: "Headquarters Building Actions",
  orchard: "Orchard Building Actions",
  camp: "Camp Building Actions",
  quarry: "Quarry Building Actions",
  granary: "Granary Building Actions",
  sawmill: "Sawmill Building Actions",
  masonYard: "Mason’s Yard Building Actions",
  wall: "Wall",
  barracks: "Barracks Building Actions",
  lighthouse: "Lighthouse",
  colossus: "Colossus",
  mausoleum: "Mausoleum",
  pyramid: "Pyramid",
  academy: "Academy",
};

export function buildingLabel(b: Exclude<BuildingKind, "none">): string {
  return BUILDING_LABEL[b];
}

export function buildingModalTitle(b: Exclude<BuildingKind, "none">): string {
  return BUILDING_MODAL_TITLE[b];
}
