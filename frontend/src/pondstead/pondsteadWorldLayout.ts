import { PONDSTEAD_STARTING_RESOURCES, type ResourcePurse } from "./pondsteadBuildingCosts";
import { PONDSTEAD_DEFAULT_MAP_TEMPLATE } from "./defaultMapTemplate";
import { createInitialStacks, type UnitStack } from "./pondsteadUnits";
import type { MapCell, ParsedMap } from "./types";
import { computeVisibleCellKeys, mergeVisibleIntoRevealed } from "./pondsteadVision";
import { findFirstBuildingCellForOwner, parseMapTemplate } from "./parseMapTemplate";

function cloneCell(c: MapCell): MapCell {
  return structuredClone(c);
}

/** Rotate the map 180°: global cell (r,c) comes from base (H-1-r, W-1-c). */
export function rotateParsedMap180(map: ParsedMap): ParsedMap {
  const H = map.height;
  const W = map.width;
  const cells: MapCell[][] = [];
  for (let r = 0; r < H; r++) {
    const row: MapCell[] = [];
    for (let c = 0; c < W; c++) {
      row.push(cloneCell(map.cells[H - 1 - r]![W - 1 - c]!));
    }
    cells.push(row);
  }
  return { width: W, height: H, cells };
}

/** Set {@link MapCell.buildingOwnerId} on every non-`none` building cell. */
export function withUniformBuildingOwners(map: ParsedMap, ownerId: number): ParsedMap {
  const cells = map.cells.map((row) =>
    row.map((cell) => {
      if (cell.building === "none") return cell;
      return { ...cell, buildingOwnerId: ownerId };
    }),
  );
  return { ...map, cells };
}

/** Concatenate two maps of equal height horizontally: `left` then `right`. */
export function stitchMapsHorizontally(left: ParsedMap, right: ParsedMap): ParsedMap {
  if (left.height !== right.height) {
    throw new Error(`stitchMapsHorizontally: height mismatch ${left.height} vs ${right.height}`);
  }
  const H = left.height;
  const W = left.width + right.width;
  const cells: MapCell[][] = [];
  for (let r = 0; r < H; r++) {
    const row: MapCell[] = [
      ...left.cells[r]!.map(cloneCell),
      ...right.cells[r]!.map(cloneCell),
    ];
    cells.push(row);
  }
  return { width: W, height: H, cells };
}

/**
 * Default 2P map: P0 region columns 0..8 (identity template), P1 columns 9..17 (same template rotated 180°).
 * Shared vertical seam between global columns 8 and 9.
 */
export function buildDefaultTwoPlayerHorizontalMap(templateText: string = PONDSTEAD_DEFAULT_MAP_TEMPLATE): ParsedMap {
  const base = parseMapTemplate(templateText);
  const left = withUniformBuildingOwners(base, 0);
  const rotated = rotateParsedMap180(base);
  const right = withUniformBuildingOwners(rotated, 1);
  return stitchMapsHorizontally(left, right);
}

/** Initial stacks for both seats on a stitched 2P map (HQ / camp / orchard per owner). */
export function createTwoPlayerInitialStacks(map: ParsedMap): UnitStack[] {
  const stacks: UnitStack[] = [];
  for (const seat of [0, 1] as const) {
    const hq = findFirstBuildingCellForOwner(map, "hq", seat);
    if (!hq) throw new Error(`Pondstead 2P map: missing HQ for seat ${seat}`);
    const camp = findFirstBuildingCellForOwner(map, "camp", seat);
    const orchard = findFirstBuildingCellForOwner(map, "orchard", seat);
    stacks.push(...createInitialStacks(hq, camp, orchard, seat));
  }
  return stacks;
}

export type TwoPlayerFreshState = {
  map: ParsedMap;
  stacks: UnitStack[];
  pursesBySeat: Record<number, ResourcePurse>;
  revealedBySeat: Record<number, Set<string>>;
};

/** Map, stacks, starting purses, and per-seat fog after initial vision pass. */
export function createFreshTwoPlayerPondsteadState(): TwoPlayerFreshState {
  const map = buildDefaultTwoPlayerHorizontalMap();
  const stacks = createTwoPlayerInitialStacks(map);
  const pursesBySeat: Record<number, ResourcePurse> = {
    0: { ...PONDSTEAD_STARTING_RESOURCES },
    1: { ...PONDSTEAD_STARTING_RESOURCES },
  };
  const revealedBySeat: Record<number, Set<string>> = {
    0: mergeVisibleIntoRevealed(computeVisibleCellKeys(map, stacks, 0), new Set()),
    1: mergeVisibleIntoRevealed(computeVisibleCellKeys(map, stacks, 1), new Set()),
  };
  return { map, stacks, pursesBySeat, revealedBySeat };
}
