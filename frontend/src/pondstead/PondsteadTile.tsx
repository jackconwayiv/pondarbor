import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Box, Button, Text, VStack } from "@chakra-ui/react";

import { AppModal } from "../components/AppModal";
import DraggablePondStack from "./DraggablePondStack";
import PondsteadUnitActionsModal from "./PondsteadUnitActionsModal";
import { kingMarchCapFromMap, recruitPopulationCapMessage } from "./pondsteadHudMetrics";
import {
  recruitBlockedMessage,
  sortStacksForDisplay,
  stackCanStartAdjacentMarchToday,
  stacksOnCell,
  type PondsteadUnitKind,
  type RecruitAttemptResult,
  type UnitStack,
  unitEmoji,
  unitKindLabel,
} from "./pondsteadUnits";
import {
  buildingAllowsRecruitSoldier,
  buildingAllowsRecruitWorker,
} from "./pondsteadBuild";
import { hasCompletedMausoleumForOwner } from "./pondsteadWonders";
import {
  pondsteadCellKey,
  recruitPendingInQueueMessage,
  type PendingRecruits,
} from "./pondsteadDay";
import {
  canAfford,
  formatBuildCostPill,
  getRecruitCostForNextUnit,
  insufficientRecruitResourcesMessage,
  type PlaceBuildResult,
  type ResourcePurse,
} from "./pondsteadBuildingCosts";
import { pondsteadResourceLayerGlyphPx, pondsteadUnitStackGlyphPx } from "./sizes";
import { buildingLabel, buildingModalTitle, groundStyle, RESOURCE_EMOJI } from "./terrain";
import type { BuildingKind, MapCell, ParsedMap } from "./types";
import {
  mapCellBuildingOwner,
  mapCellConstructionOwner,
  PONDSTEAD_LOCAL_PLAYER_ID,
  type TileVisionMode,
} from "./pondsteadVision";

const GRID_LINE = "1px solid #000";

/** Unrevealed tiles: dark gray (not near-black) so the grid still reads as open to exploration. */
const HIDDEN_TILE_BG = "#3a3a3a";

/** After building name when a recruit is queued for this tile. */
const PENDING_RECRUIT_BADGE = "⏱️";

function ConstructionSiteCard({
  target,
  labelPx,
  interactionLocked,
}: {
  target: Exclude<BuildingKind, "none">;
  labelPx: number;
  interactionLocked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const namePx = Math.max(6, Math.min(12, labelPx - 1));
  const label = buildingLabel(target);
  return (
    <Box
      flex="1"
      minH="0"
      minW="0"
      w="100%"
      h="100%"
      display="flex"
      flexDir="column"
      borderRadius="md"
      borderStyle="dashed"
      borderWidth="2px"
      borderColor="fg.muted"
      bg="bg.subtle"
      overflow="hidden"
    >
      <Button
        type="button"
        variant="ghost"
        flex="1"
        minH="0"
        minW="0"
        w="100%"
        h="100%"
        p="0.15rem"
        borderRadius="md"
        fontWeight="normal"
        color="fg.muted"
        disabled={interactionLocked}
        aria-label={`Construction site: ${label}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Text
          as="span"
          fontSize={`${namePx}px`}
          fontStyle="italic"
          textAlign="center"
          lineHeight="snug"
        >
          {label}
        </Text>
      </Button>
      <AppModal open={open} onOpenChange={setOpen} title={label} size="sm">
        <Text fontSize="sm" color="fg.muted" textAlign="center" pt="1">
          Under construction. Ready next day.
        </Text>
      </AppModal>
    </Box>
  );
}

function BuildingWithCommand({
  label,
  "aria-label": aria,
  labelPx,
  modalTitle,
  building,
  recruitRow,
  recruitCol,
  stacks,
  recruitQueues,
  playerResources,
  queuedRecruitKind,
  onRecruit,
  interactionLocked,
  map,
  recruitUsedWorkerSlotKeys,
}: {
  label: string;
  "aria-label": string;
  labelPx: number;
  modalTitle: string;
  building: Exclude<BuildingKind, "none">;
  recruitRow: number;
  recruitCol: number;
  stacks: UnitStack[];
  recruitQueues: PendingRecruits;
  playerResources: ResourcePurse;
  queuedRecruitKind: PondsteadUnitKind | undefined;
  onRecruit: (row: number, col: number, kind: PondsteadUnitKind) => RecruitAttemptResult;
  interactionLocked: boolean;
  map: ParsedMap;
  recruitUsedWorkerSlotKeys: ReadonlySet<string>;
}) {
  const [open, setOpen] = useState(false);
  const [recruitError, setRecruitError] = useState<
    | null
    | { type: "population" }
    | { type: "tile"; kind: PondsteadUnitKind }
    | { type: "insufficient" }
    | { type: "recruit_pending" }
    | { type: "already_recruited_today" }
    | { type: "locked" }
  >(null);
  const onModalOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setRecruitError(null);
  };
  const recruitWorker = () => {
    const r = onRecruit(recruitRow, recruitCol, "worker");
    if (r === "ok") {
      setRecruitError(null);
      setOpen(false);
    } else if (r === "population") {
      setRecruitError({ type: "population" });
    } else if (r === "insufficient") {
      setRecruitError({ type: "insufficient" });
    } else if (r === "recruit_pending") {
      setRecruitError({ type: "recruit_pending" });
    } else if (r === "already_recruited_today") {
      setRecruitError({ type: "already_recruited_today" });
    } else if (r === "locked") {
      setRecruitError({ type: "locked" });
    } else {
      setRecruitError({ type: "tile", kind: "worker" });
    }
  };
  const recruitSoldier = () => {
    const r = onRecruit(recruitRow, recruitCol, "soldier");
    if (r === "ok") {
      setRecruitError(null);
      setOpen(false);
    } else if (r === "population") {
      setRecruitError({ type: "population" });
    } else if (r === "insufficient") {
      setRecruitError({ type: "insufficient" });
    } else if (r === "recruit_pending") {
      setRecruitError({ type: "recruit_pending" });
    } else if (r === "already_recruited_today") {
      setRecruitError({ type: "already_recruited_today" });
    } else if (r === "locked") {
      setRecruitError({ type: "locked" });
    } else {
      setRecruitError({ type: "tile", kind: "soldier" });
    }
  };
  const workerRecruitCost = getRecruitCostForNextUnit(stacks, "worker", recruitQueues, map);
  const soldierRecruitCost = getRecruitCostForNextUnit(stacks, "soldier", recruitQueues, map);
  const canPayWorker = canAfford(playerResources, workerRecruitCost);
  const canPaySoldier = canAfford(playerResources, soldierRecruitCost);
  const canRecruitWorker = buildingAllowsRecruitWorker(building);
  const canRecruitSoldier = buildingAllowsRecruitSoldier(building);
  const recruitTile = map.cells[recruitRow]![recruitCol]!;
  const recruitBuildingOwner = mapCellBuildingOwner(recruitTile);
  const mausoleumInstantWorkers = hasCompletedMausoleumForOwner(map, recruitBuildingOwner);
  const workerDailyRecruitKey = `${pondsteadCellKey(recruitRow, recruitCol)}:worker`;
  const workerRecruitSpentToday = recruitUsedWorkerSlotKeys.has(workerDailyRecruitKey);
  const recruitErrorText =
    recruitError == null
      ? null
      : recruitError.type === "population"
        ? recruitPopulationCapMessage()
        : recruitError.type === "insufficient"
          ? insufficientRecruitResourcesMessage()
          : recruitError.type === "recruit_pending"
            ? recruitPendingInQueueMessage()
            : recruitError.type === "already_recruited_today"
              ? "This building already recruited a worker today."
              : recruitError.type === "locked"
                ? "The map is locked (end of day or game over)."
                : recruitBlockedMessage(recruitError.kind);
  const recruitBlockedByQueue = queuedRecruitKind !== undefined;

  return (
    <Box flex="1" minH="0" minW="0" w="100%" h="100%" display="flex" flexDir="column">
      <Button
        type="button"
        w="100%"
        h="100%"
        minH="0"
        minW="0"
        flex="1"
        p="0.3rem"
        fontSize={`${labelPx}px`}
        fontWeight="semibold"
        lineHeight="snug"
        textAlign="center"
        whiteSpace="normal"
        color="fg"
        bg="bg"
        borderWidth="1px"
        borderStyle={recruitBlockedByQueue ? "dashed" : "solid"}
        borderColor="border"
        borderRadius="md"
        boxShadow="sm"
        aria-label={aria}
        aria-haspopup="dialog"
        disabled={interactionLocked}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <AppModal open={open} onOpenChange={onModalOpenChange} title={modalTitle} size="sm">
        <VStack align="stretch" gap="3" pt="1">
          {recruitBlockedByQueue ? (
            <Text fontSize="sm" color="fg.muted" fontStyle="italic" textAlign="center">
              Queued: {unitKindLabel(queuedRecruitKind!)} {unitEmoji(queuedRecruitKind!)} — spawns at
              start of next day. Further recruitment is blocked until then.
            </Text>
          ) : null}
          {canRecruitWorker || canRecruitSoldier ? (
            <Text fontSize="sm" color="fg.muted" textAlign="center">
              {mausoleumInstantWorkers && canRecruitWorker
                ? "Workers you buy here appear immediately (once per building per day). Soldiers still arrive at the start of the next day."
                : "Purchased recruits are queued and appear at the start of the next day."}
            </Text>
          ) : (
            <Text fontSize="sm" color="fg.muted" textAlign="center">
              No recruitment from this building.
            </Text>
          )}
          {recruitErrorText != null ? (
            <Text
              fontSize="sm"
              color="fg.error"
              textAlign="center"
              borderWidth="1px"
              borderColor="border.error"
              borderRadius="md"
              px="2"
              py="2"
              role="alert"
            >
              {recruitErrorText}
            </Text>
          ) : null}
          {canRecruitWorker ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              colorPalette="lilypad"
              disabled={!canPayWorker || recruitBlockedByQueue || workerRecruitSpentToday}
              onClick={recruitWorker}
            >
              Recruit {unitKindLabel("worker")} {unitEmoji("worker")} —{" "}
              {formatBuildCostPill(workerRecruitCost)}
            </Button>
          ) : null}
          {canRecruitSoldier ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              colorPalette="lilypad"
              disabled={!canPaySoldier || recruitBlockedByQueue}
              onClick={recruitSoldier}
            >
              Recruit {unitKindLabel("soldier")} {unitEmoji("soldier")} —{" "}
              {formatBuildCostPill(soldierRecruitCost)}
            </Button>
          ) : null}
        </VStack>
      </AppModal>
    </Box>
  );
}

function ResourceBackgroundLayer({ kind, cellSizePx }: { kind: "stone" | "wood" | "food"; cellSizePx: number }) {
  const em = pondsteadResourceLayerGlyphPx(cellSizePx);
  return (
    <Text
      as="span"
      position="absolute"
      top="0.1rem"
      right="0.1rem"
      zIndex={0}
      fontSize={`${em}px`}
      lineHeight="1"
      userSelect="none"
      pointerEvents="none"
      aria-hidden
    >
      {RESOURCE_EMOJI[kind]}
    </Text>
  );
}

export default function PondsteadTile({
  cell,
  map,
  cellSizePx,
  row,
  col,
  stacks,
  recruitQueues,
  playerResources,
  recruitUsedWorkerSlotKeys,
  tileVision,
  stackMovementUsed,
  interactionLocked,
  onSplit,
  onRecruit,
  onPlaceBuilding,
  onMarch,
  revealedCellKeys,
}: {
  cell: MapCell;
  map: ParsedMap;
  cellSizePx: number;
  row: number;
  col: number;
  stacks: UnitStack[];
  recruitQueues: PendingRecruits;
  playerResources: ResourcePurse;
  recruitUsedWorkerSlotKeys: ReadonlySet<string>;
  tileVision: TileVisionMode;
  stackMovementUsed: Readonly<Record<string, number>>;
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
  revealedCellKeys: ReadonlySet<string>;
}) {
  const localPlayerId = PONDSTEAD_LOCAL_PLAYER_ID;
  const groundBg = groundStyle(cell.ground).bg;
  const pos = `r${row} c${col}`;
  const t = `${cellSizePx}px`;
  const unitStackFontPx = pondsteadUnitStackGlyphPx(cellSizePx);
  const labelPx = Math.max(7, Math.min(14, cellSizePx * 0.09));
  /** Must match flex `gap` on the unit row: `calc((100% - 2 * gap) / 3)` is three slots per line. */
  const unitRowGap = "0.12rem";
  const unitStackSlotMaxW = `calc((100% - 2 * ${unitRowGap}) / 3)`;

  const showEnemyIntel = tileVision === "full";
  const unitsHere = sortStacksForDisplay(
    stacksOnCell(stacks, row, col).filter((s) => {
      if (tileVision === "hidden") return false;
      if (showEnemyIntel) return true;
      return (s.ownerId ?? localPlayerId) === localPlayerId;
    }),
  );
  const [unitModalStackId, setUnitModalStackId] = useState<string | null>(null);
  const unitModalStack = unitModalStackId
    ? unitsHere.find((s) => s.id === unitModalStackId)
    : undefined;

  useEffect(() => {
    if (unitModalStackId != null && unitModalStack === undefined) {
      setUnitModalStackId(null);
    }
  }, [unitModalStackId, unitModalStack]);

  const queuedRecruitKind = recruitQueues[pondsteadCellKey(row, col)];

  const showBuilding =
    tileVision !== "hidden" &&
    cell.building !== "none" &&
    (showEnemyIntel || mapCellBuildingOwner(cell) === localPlayerId);

  const showConstruction =
    tileVision !== "hidden" &&
    cell.constructionTarget != null &&
    cell.constructionTarget !== "none" &&
    (showEnemyIntel || mapCellConstructionOwner(cell) === localPlayerId);

  const buildingPlaced = cell.building !== "none" ? cell.building : null;
  const buildingName = buildingPlaced != null ? buildingLabel(buildingPlaced) : "";
  const buildingButtonLabel =
    buildingPlaced != null
      ? queuedRecruitKind !== undefined
        ? `${buildingName} ${PENDING_RECRUIT_BADGE}`
        : buildingName
      : "";
  const buildingButtonAria =
    buildingPlaced != null
      ? queuedRecruitKind !== undefined
        ? `${buildingName} at ${pos}, queued recruit`
        : `${buildingName} at ${pos}`
      : "";

  const resourceLayer: ReactNode =
    tileVision !== "hidden" && cell.resource !== "none" ? (
      <ResourceBackgroundLayer kind={cell.resource} cellSizePx={cellSizePx} />
    ) : null;

  const constructionBlock =
    showConstruction && cell.constructionTarget != null && cell.constructionTarget !== "none" ? (
      <ConstructionSiteCard
        target={cell.constructionTarget}
        labelPx={labelPx}
        interactionLocked={interactionLocked}
      />
    ) : null;

  const buildingBlock =
    showBuilding && buildingPlaced != null ? (
      <BuildingWithCommand
        label={buildingButtonLabel}
        labelPx={labelPx}
        modalTitle={buildingModalTitle(buildingPlaced)}
        building={buildingPlaced}
        recruitRow={row}
        recruitCol={col}
        stacks={stacks}
        recruitQueues={recruitQueues}
        playerResources={playerResources}
        queuedRecruitKind={queuedRecruitKind}
        onRecruit={onRecruit}
        interactionLocked={interactionLocked}
        map={map}
        recruitUsedWorkerSlotKeys={recruitUsedWorkerSlotKeys}
        aria-label={buildingButtonAria}
      />
    ) : null;

  const tileBg = tileVision === "hidden" ? HIDDEN_TILE_BG : groundBg;
  const tileAria =
    tileVision === "hidden"
      ? `Unrevealed map tile ${pos}`
      : tileVision === "terrain"
        ? `Map tile ${pos} (remembered terrain)`
        : `Map tile ${pos}`;

  return (
    <Box
      position="relative"
      minW={t}
      minH={t}
      w={t}
      h={t}
      flexShrink={0}
      p="0.2rem"
      borderRight={GRID_LINE}
      borderBottom={GRID_LINE}
      bg={tileBg}
      role="img"
      aria-label={tileAria}
      display="flex"
      flexDirection="column"
      gap="0.1rem"
    >
      <Box
        position="relative"
        zIndex={1}
        flex="1"
        minH="0"
        minW="0"
        w="100%"
        overflow="hidden"
        display="flex"
        flexDirection="row"
        flexWrap="wrap"
        alignContent="flex-start"
        alignItems="flex-start"
        justifyContent="flex-start"
        gap={unitRowGap}
      >
        {resourceLayer}
        {unitsHere.map((st) => (
          <DraggablePondStack
            key={st.id}
            stack={st}
            fontPx={unitStackFontPx}
            slotMaxW={unitStackSlotMaxW}
            interactionLocked={interactionLocked}
            noAdjacentMovesRemaining={
              !stackCanStartAdjacentMarchToday(stackMovementUsed, st.id, kingMarchCapFromMap(map, st.ownerId ?? localPlayerId))
            }
            onOpenUnitActions={() => setUnitModalStackId(st.id)}
          />
        ))}
      </Box>
      <Box flex="1" minH="0" minW="0" w="100%" display="flex" flexDir="column">
        {constructionBlock}
        {buildingBlock}
      </Box>
      {unitModalStack != null ? (
        <PondsteadUnitActionsModal
          key={unitModalStack.id}
          stack={unitModalStack}
          cell={cell}
          map={map}
          gameStacks={stacks}
          stackMovementUsed={stackMovementUsed}
          playerResources={playerResources}
          kingMarchCap={kingMarchCapFromMap(map, unitModalStack.ownerId ?? PONDSTEAD_LOCAL_PLAYER_ID)}
          open
          onOpenChange={(next) => {
            if (!next) setUnitModalStackId(null);
          }}
          onSplit={onSplit}
          onPlaceBuilding={(unitKind, target) => onPlaceBuilding(row, col, unitKind, target)}
          onMarch={onMarch}
          revealedCellKeys={revealedCellKeys}
        />
      ) : null}
    </Box>
  );
}
