import type { ReactNode } from "react";
import { Grid } from "@chakra-ui/react";

import PondsteadTile from "./PondsteadTile";
import type { ResourcePurse, PlaceBuildResult } from "./pondsteadBuildingCosts";
import { pondsteadCellKey, type PendingRecruits } from "./pondsteadDay";
import type { PondsteadUnitKind, RecruitAttemptResult, UnitStack } from "./pondsteadUnits";
import { tileVisionMode } from "./pondsteadVision";
import type { BuildingKind, ParsedMap } from "./types";

export default function PondsteadMapGrid({
  map,
  cellSizePx,
  stacks,
  recruitQueues,
  playerResources,
  recruitUsedWorkerSlotKeys,
  onSplit,
  onRecruit,
  onPlaceBuilding,
  onMarch,
  stackMovementUsed,
  revealedCellKeys,
  visibleCellKeys,
  viewerPlayerId,
  interactionLocked,
}: {
  map: ParsedMap;
  cellSizePx: number;
  stacks: UnitStack[];
  recruitQueues: PendingRecruits;
  playerResources: ResourcePurse;
  recruitUsedWorkerSlotKeys: ReadonlySet<string>;
  stackMovementUsed: Readonly<Record<string, number>>;
  revealedCellKeys: ReadonlySet<string>;
  visibleCellKeys: ReadonlySet<string>;
  /** Human controlling the UI (hotseat / client seat). */
  viewerPlayerId: number;
  /** When true (e.g. end-of-day pending), tile stacks/buildings are non-interactive. */
  interactionLocked: boolean;
  onSplit: (stackId: string, splitCount: number) => void;
  onRecruit: (row: number, col: number, kind: PondsteadUnitKind) => RecruitAttemptResult;
  onPlaceBuilding: (
    row: number,
    col: number,
    unitKind: PondsteadUnitKind,
    target: BuildingKind,
  ) => PlaceBuildResult;
  onMarch: (stackId: string, toRow: number, toCol: number) => void;
}) {
  const { width, height, cells } = map;
  const c = `${cellSizePx}px`;
  const tiles: ReactNode[] = [];
  for (let r = 0; r < height; r++) {
    for (let cIdx = 0; cIdx < width; cIdx++) {
      const cell = cells[r]![cIdx]!;
      const key = pondsteadCellKey(r, cIdx);
      const tileVision = tileVisionMode(revealedCellKeys.has(key), visibleCellKeys.has(key));
      tiles.push(
        <PondsteadTile
          key={key}
          cell={cell}
          map={map}
          cellSizePx={cellSizePx}
          row={r}
          col={cIdx}
          stacks={stacks}
          recruitQueues={recruitQueues}
          playerResources={playerResources}
          recruitUsedWorkerSlotKeys={recruitUsedWorkerSlotKeys}
          tileVision={tileVision}
          stackMovementUsed={stackMovementUsed}
          viewerPlayerId={viewerPlayerId}
          interactionLocked={interactionLocked}
          onSplit={onSplit}
          onRecruit={onRecruit}
          onPlaceBuilding={onPlaceBuilding}
          onMarch={onMarch}
          revealedCellKeys={revealedCellKeys}
        />,
      );
    }
  }

  return (
    <Grid
      display="grid"
      templateColumns={`repeat(${width}, minmax(${c}, ${c}))`}
      autoRows={`minmax(${c}, auto)`}
      gap="0"
      w="max-content"
      maxW="none"
      borderTop="1px solid #000"
      borderLeft="1px solid #000"
    >
      {tiles}
    </Grid>
  );
}
