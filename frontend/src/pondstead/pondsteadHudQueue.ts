import { mapCellBuildingOwner, mapCellConstructionOwner, PONDSTEAD_LOCAL_PLAYER_ID } from "./pondsteadVision";
import { pondsteadCellKey, type PendingRecruits } from "./pondsteadDay";
import { unitKindLabel, type PondsteadUnitKind } from "./pondsteadUnits";
import { buildingLabel } from "./terrain";
import type { BuildingKind, MapCell, ParsedMap } from "./types";

/** Fallback for HUD if `constructionNightsLeft` is missing (legacy). */
export const PONDSTEAD_CONSTRUCTION_DAYS_REMAINING = 1 as const;

export type QueuedRecruitHud = {
  cellKey: string;
  kind: PondsteadUnitKind;
  kindLabel: string;
  /** Building the recruit is queued for (e.g. Orchard). */
  atBuildingLabel: string;
};

/**
 * Recruits pending at start of next day, for the command bar. Skips bad keys; omits if building missing.
 */
export function listQueuedRecruitsForHud(
  map: ParsedMap,
  queues: PendingRecruits,
  playerId: number = PONDSTEAD_LOCAL_PLAYER_ID,
): QueuedRecruitHud[] {
  const out: QueuedRecruitHud[] = [];
  for (const key of Object.keys(queues).sort()) {
    const kind = queues[key];
    if (kind === undefined) continue;
    const [row, col] = key.split("-").map(Number);
    if (!Number.isFinite(row) || !Number.isFinite(col)) continue;
    if (row < 0 || col < 0 || row >= map.height || col >= map.width) continue;
    const cell = map.cells[row]![col]!;
    if (cell.building === "none" || mapCellBuildingOwner(cell) !== playerId) continue;
    out.push({
      cellKey: pondsteadCellKey(row, col),
      kind,
      kindLabel: unitKindLabel(kind),
      atBuildingLabel: buildingLabel(cell.building as Exclude<BuildingKind, "none">),
    });
  }
  return out;
}

export type LocalConstructionHud = {
  cellKey: string;
  target: BuildingKind;
  targetLabel: string;
  /** End-day turns until complete; currently always 1. */
  daysRemaining: number;
};

/**
 * In-progress sites owned by {@link playerId} for the command bar.
 */
export function listLocalConstructionsForHud(
  map: ParsedMap,
  playerId: number = PONDSTEAD_LOCAL_PLAYER_ID,
): LocalConstructionHud[] {
  const out: LocalConstructionHud[] = [];
  for (let r = 0; r < map.height; r++) {
    for (let c = 0; c < map.width; c++) {
      const cell: MapCell = map.cells[r]![c]!;
      if (cell.constructionTarget == null) continue;
      if (mapCellConstructionOwner(cell) !== playerId) continue;
      const t = cell.constructionTarget;
      out.push({
        cellKey: pondsteadCellKey(r, c),
        target: t,
        targetLabel: buildingLabel(t as Exclude<BuildingKind, "none">),
        daysRemaining: cell.constructionNightsLeft ?? PONDSTEAD_CONSTRUCTION_DAYS_REMAINING,
      });
    }
  }
  return out;
}
