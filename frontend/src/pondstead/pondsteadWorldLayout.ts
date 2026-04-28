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

/** Stitch any number of maps of equal height left-to-right (seat 0 west → higher east). */
export function stitchMapsHorizontallyMany(parts: ParsedMap[]): ParsedMap {
  if (parts.length === 0) throw new Error("stitchMapsHorizontallyMany: empty");
  let acc = parts[0]!;
  for (let i = 1; i < parts.length; i++) {
    acc = stitchMapsHorizontally(acc, parts[i]!);
  }
  return acc;
}

/**
 * Default 2P map: P0 region columns 0..8 (identity template), P1 columns 9..17 (same template rotated 180°).
 * Shared vertical seam between global columns 8 and 9.
 */
export function buildDefaultTwoPlayerHorizontalMap(templateText: string = PONDSTEAD_DEFAULT_MAP_TEMPLATE): ParsedMap {
  return buildNHPlayerHorizontalMap(2, templateText);
}

/**
 * Stitch N adjacent 9-column segments: even seats identity template, odd seats rotated 180°
 * (mirrors legacy 2P layout when n=2).
 */
export function buildNHPlayerHorizontalMap(
  seatCount: number,
  templateText: string = PONDSTEAD_DEFAULT_MAP_TEMPLATE,
): ParsedMap {
  const n = Math.max(2, Math.min(6, Math.floor(seatCount)));
  const baseTemplate = parseMapTemplate(templateText);
  const segments: ParsedMap[] = [];
  for (let seat = 0; seat < n; seat++) {
    const piece = seat % 2 === 0 ? baseTemplate : rotateParsedMap180(baseTemplate);
    segments.push(withUniformBuildingOwners(piece, seat));
  }
  return stitchMapsHorizontallyMany(segments);
}

/** Initial stacks for every seat on an N-seat stitched map (HQ / camp / orchard per owner). */
export function createInitialStacksForMap(map: ParsedMap, seatCount: number): UnitStack[] {
  const stacks: UnitStack[] = [];
  const n = Math.max(2, Math.min(6, Math.floor(seatCount)));
  for (let seat = 0; seat < n; seat++) {
    const hq = findFirstBuildingCellForOwner(map, "hq", seat);
    if (!hq) throw new Error(`Pondstead map: missing HQ for seat ${seat}`);
    const camp = findFirstBuildingCellForOwner(map, "camp", seat);
    const orchard = findFirstBuildingCellForOwner(map, "orchard", seat);
    stacks.push(...createInitialStacks(hq, camp, orchard, seat));
  }
  return stacks;
}

/** @deprecated Prefer {@link createInitialStacksForMap}. */
export function createTwoPlayerInitialStacks(map: ParsedMap): UnitStack[] {
  return createInitialStacksForMap(map, 2);
}

export type TwoPlayerFreshState = {
  map: ParsedMap;
  stacks: UnitStack[];
  pursesBySeat: Record<number, ResourcePurse>;
  revealedBySeat: Record<number, Set<string>>;
};

/** Map, stacks, starting purses, and per-seat fog after initial vision pass. Default n=2. */
export function createFreshTwoPlayerPondsteadState(): TwoPlayerFreshState {
  return createFreshPondsteadStateForSeatCount(2);
}

export function createFreshPondsteadStateForSeatCount(seatCount: number): TwoPlayerFreshState {
  const n = Math.max(2, Math.min(6, Math.floor(seatCount)));
  const map = buildNHPlayerHorizontalMap(n);
  const stacks = createInitialStacksForMap(map, n);
  const pursesBySeat: Record<number, ResourcePurse> = {};
  const revealedBySeat: Record<number, Set<string>> = {};
  for (let seat = 0; seat < n; seat++) {
    pursesBySeat[seat] = { ...PONDSTEAD_STARTING_RESOURCES };
    revealedBySeat[seat] = mergeVisibleIntoRevealed(
      computeVisibleCellKeys(map, stacks, seat),
      new Set(),
    );
  }
  return { map, stacks, pursesBySeat, revealedBySeat };
}
