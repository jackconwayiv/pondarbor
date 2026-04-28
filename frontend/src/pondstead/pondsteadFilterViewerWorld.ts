/**
 * Produce a viewer-safe snapshot — strips hidden enemy stacks and scrubs unseen enemy structures.
 * Mirrors {@link computeVisibleCellKeys} for current LOS plus persistent revealed terrain.
 */

import type { PondsteadServerWorldSnapshot } from "./pondsteadServerSync";
import { computeVisibleCellKeys, mapCellBuildingOwner, mapCellConstructionOwner, pondsteadVisionCellKey } from "./pondsteadVision";
import type { MapCell, ParsedMap } from "./types";
import type { UnitStack } from "./pondsteadUnits";

function scrubMapForViewer(map: ParsedMap, viewerSeat: number, visible: Set<string>, revealed: Set<string>): ParsedMap {
  const cells: MapCell[][] = map.cells.map((row, r) =>
    row.map((cell, c): MapCell => {
      const key = pondsteadVisionCellKey(r, c);
      const ownerB = cell.building === "none" ? null : mapCellBuildingOwner(cell);
      const constrOwner = cell.constructionTarget != null ? mapCellConstructionOwner(cell) : null;
      let next = cell;
      if ((ownerB != null && ownerB !== viewerSeat) || (constrOwner != null && constrOwner !== viewerSeat)) {
        if (visible.has(key)) return next;
        if (revealed.has(key)) {
          next = {
            ...next,
            building: "none",
            buildingOwnerId: undefined,
            buildingCondition: undefined,
            constructionTarget: undefined,
            constructionOwnerId: undefined,
            constructionBorrowedUnitKind: undefined,
            constructionNightsLeft: undefined,
          };
          return next;
        }
        return {
          ...next,
          symbol: "G",
          ground: "grass",
          resource: "none",
          building: "none",
          buildingOwnerId: undefined,
          buildingCondition: undefined,
          constructionTarget: undefined,
          constructionOwnerId: undefined,
          constructionBorrowedUnitKind: undefined,
          constructionNightsLeft: undefined,
        };
      }
      return next;
    }),
  );
  return { ...map, cells };
}

/** Filter server-authoritative snapshot for the requesting seat (does not mutate input). */
export function filterWorldSnapshotForViewer(
  snapshot: PondsteadServerWorldSnapshot,
  viewerSeat: number,
): PondsteadServerWorldSnapshot {
  const vis = computeVisibleCellKeys(snapshot.map, snapshot.stacks, viewerSeat);
  const revealedArr = snapshot.revealedBySeat[String(viewerSeat)] ?? [];
  const revealed = new Set(revealedArr);

  const stacks: UnitStack[] = snapshot.stacks.filter((st) => {
    const owner = st.ownerId ?? 0;
    if (owner === viewerSeat) return true;
    const k = pondsteadVisionCellKey(st.row, st.col);
    return vis.has(k);
  });

  const map = scrubMapForViewer(snapshot.map, viewerSeat, vis, revealed);

  return {
    ...snapshot,
    map,
    stacks,
  };
}
