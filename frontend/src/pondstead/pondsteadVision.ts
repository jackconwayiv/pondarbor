import { visionChebyshevRadiusForPlayer } from "./pondsteadWonders";
import type { ParsedMap, MapCell } from "./types";
import type { UnitStack } from "./pondsteadUnits";

/** Local human / primary client player id (multiplayer will add others). */
export const PONDSTEAD_LOCAL_PLAYER_ID = 0;

/**
 * King-distance (Chebyshev): orthogonal and diagonal steps both count as 1.
 * Vision radius 3 = every cell with max(|Δr|,|Δc|) ≤ 3 from a source.
 */
export const PONDSTEAD_VISION_CHEBYSHEV = 3;

/** Row-major cell id (matches {@link pondsteadCellKey} in `pondsteadDay`). */
export function pondsteadVisionCellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

export type TileVisionMode = "hidden" | "terrain" | "full";

export function mapCellBuildingOwner(c: MapCell): number {
  return c.buildingOwnerId ?? PONDSTEAD_LOCAL_PLAYER_ID;
}

export function mapCellConstructionOwner(c: MapCell): number {
  return c.constructionOwnerId ?? mapCellBuildingOwner(c);
}

function stackOwner(s: UnitStack): number {
  return s.ownerId ?? PONDSTEAD_LOCAL_PLAYER_ID;
}

/**
 * Cells currently in line-of-sight from the given player's units and completed or in-progress
 * structures they own on the map.
 */
export function computeVisibleCellKeys(
  map: ParsedMap,
  stacks: UnitStack[],
  playerId: number,
): Set<string> {
  const sources: { row: number; col: number }[] = [];
  const R = visionChebyshevRadiusForPlayer(map, playerId);

  for (let r = 0; r < map.height; r++) {
    for (let c = 0; c < map.width; c++) {
      const cell = map.cells[r]![c]!;
      if (cell.building !== "none" && mapCellBuildingOwner(cell) === playerId) {
        sources.push({ row: r, col: c });
      }
      if (cell.constructionTarget != null && mapCellConstructionOwner(cell) === playerId) {
        sources.push({ row: r, col: c });
      }
    }
  }

  for (const s of stacks) {
    if (stackOwner(s) === playerId) {
      sources.push({ row: s.row, col: s.col });
    }
  }

  const out = new Set<string>();
  for (const src of sources) {
    for (let dr = -R; dr <= R; dr++) {
      for (let dc = -R; dc <= R; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) > R) continue;
        const r = src.row + dr;
        const c = src.col + dc;
        if (r >= 0 && r < map.height && c >= 0 && c < map.width) {
          out.add(pondsteadVisionCellKey(r, c));
        }
      }
    }
  }
  return out;
}

/**
 * Union keys into a copy of `revealed` (typically LOS into persistent fog memory).
 * Pondstead commits that union into `revealedCellKeys` only when the **day ends** (start of the
 * next calendar day). A separate “scouted today” set accumulates live LOS for that commit only;
 * it is **not** merged into fog rendering during the turn, so hidden tiles stay gray until the
 * next day’s reveal pass.
 *
 * **Undo:** snapshots include both committed `revealed` and same-day scout keys so undo cannot
 * widen fog for free.
 */
export function mergeVisibleIntoRevealed(visibleKeys: ReadonlySet<string>, revealed: ReadonlySet<string>): Set<string> {
  const next = new Set(revealed);
  for (const k of visibleKeys) {
    next.add(k);
  }
  return next;
}

export function tileVisionMode(isRevealed: boolean, isVisible: boolean): TileVisionMode {
  if (!isRevealed) return "hidden";
  if (isVisible) return "full";
  return "terrain";
}
