import { useState } from "react";
import { Box, Button, Heading, SimpleGrid, Text, VStack } from "@chakra-ui/react";

import { AppModal } from "../components/AppModal";
import { inBounds } from "./adjacency";
import {
  MILITARY_BUILD_ACTION_LABEL,
  militaryBuildOptionsOnCell,
  WORKER_BUILD_ACTION_LABEL,
  WORKER_WONDER_BUILD_ACTION_LABEL,
  workerCivicBuildOptionsOnCell,
  workerWonderBuildOptionsOnCell,
} from "./pondsteadBuild";
import {
  canAfford,
  formatBuildCostPill,
  getBuildCostForTarget,
  insufficientBuildResourcesMessage,
  type PlaceBuildResult,
  type ResourcePurse,
} from "./pondsteadBuildingCosts";
import { formatPondsteadActionPoints, stackMarchStatusLine } from "./pondsteadHudMetrics";
import {
  classifyStackDragEnd,
  marchAdjacentStepCostOrNull,
  type PondsteadUnitKind,
  type UnitStack,
  unitKindLabel,
} from "./pondsteadUnits";
import { PONDSTEAD_LOCAL_PLAYER_ID } from "./pondsteadVision";
import { groundStyle } from "./terrain";
import type { BuildingKind, MapCell, ParsedMap } from "./types";

/** Neutral fill when a direction is off-map (no destination tile). */
const OFF_MAP_MOVE_BUTTON_BG = "#e8e8e8";

function moveDirectionButtonBg(map: ParsedMap, toRow: number, toCol: number): string {
  if (!inBounds(toRow, toCol, map.width, map.height)) return OFF_MAP_MOVE_BUTTON_BG;
  return groundStyle(map.cells[toRow]![toCol]!.ground).bg;
}

function buildKindsPlayerCanPayFor<T extends BuildingKind>(
  kinds: readonly T[],
  map: ParsedMap,
  playerResources: ResourcePurse,
  ownerId: number,
): T[] {
  return kinds.filter((b) => {
    const cost = getBuildCostForTarget(map, b, ownerId) ?? { food: 0, wood: 0, stone: 0 };
    return canAfford(playerResources, cost);
  });
}

/** Split 1 if count > 1; split 2 only if count >= 4; split 3 only if count >= 6. */
function workerSplitOptionsForCount(count: number): number[] {
  if (count <= 1) return [];
  const out: number[] = [1];
  if (count >= 4) out.push(2);
  if (count >= 6) out.push(3);
  return out;
}

const MARCH_RADIAL: readonly { dr: number; dc: number; label: string }[] = [
  { dr: -1, dc: -1, label: "NW" },
  { dr: -1, dc: 0, label: "N" },
  { dr: -1, dc: 1, label: "NE" },
  { dr: 0, dc: -1, label: "W" },
  { dr: 0, dc: 0, label: "March" },
  { dr: 0, dc: 1, label: "E" },
  { dr: 1, dc: -1, label: "SW" },
  { dr: 1, dc: 0, label: "S" },
  { dr: 1, dc: 1, label: "SE" },
];

export default function PondsteadUnitActionsModal({
  stack,
  cell,
  map,
  gameStacks,
  stackMovementUsed,
  playerResources,
  kingMarchCap,
  open,
  onOpenChange,
  onSplit,
  onPlaceBuilding,
  onMarch,
  revealedCellKeys,
}: {
  stack: UnitStack;
  cell: MapCell;
  map: ParsedMap;
  gameStacks: UnitStack[];
  stackMovementUsed: Readonly<Record<string, number>>;
  playerResources: ResourcePurse;
  kingMarchCap: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSplit: (stackId: string, splitCount: number) => void;
  onPlaceBuilding: (unitKind: PondsteadUnitKind, target: BuildingKind) => PlaceBuildResult;
  onMarch: (stackId: string, toRow: number, toCol: number) => void;
  revealedCellKeys: ReadonlySet<string>;
}) {
  const [buildError, setBuildError] = useState<string | null>(null);

  const splitOptions =
    stack.kind === "worker"
      ? workerSplitOptionsForCount(stack.count)
      : (() => {
          const m = Math.min(3, stack.count - 1);
          return m >= 1 ? Array.from({ length: m }, (_, i) => i + 1) : [];
        })();

  const stackOwnerId = stack.ownerId ?? PONDSTEAD_LOCAL_PLAYER_ID;
  const workerCivicOnCell =
    stack.kind === "worker" ? workerCivicBuildOptionsOnCell(map, cell, stackOwnerId) : [];
  const workerWonderOnCell =
    stack.kind === "worker" ? workerWonderBuildOptionsOnCell(map, cell, stackOwnerId) : [];
  const militaryOnCell = militaryBuildOptionsOnCell(map, cell, stackOwnerId);
  const workerCivicAffordable = buildKindsPlayerCanPayFor(workerCivicOnCell, map, playerResources, stackOwnerId);
  const wonderAffordable = buildKindsPlayerCanPayFor(workerWonderOnCell, map, playerResources, stackOwnerId);
  const militaryAffordable = buildKindsPlayerCanPayFor(militaryOnCell, map, playerResources, stackOwnerId);
  const hasBuild =
    stack.kind === "worker"
      ? workerCivicAffordable.length + wonderAffordable.length + militaryAffordable.length > 0
      : militaryAffordable.length > 0;
  const hasSplit = splitOptions.length > 0;
  const marchSpent = stackMovementUsed[stack.id] ?? 0;

  const actionsTitle = `${unitKindLabel(stack.kind)} Unit Actions`;

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (next) setBuildError(null);
  };

  const tryBuild = (unitKind: PondsteadUnitKind, target: BuildingKind) => {
    const r = onPlaceBuilding(unitKind, target);
    if (r.ok) {
      setBuildError(null);
      onOpenChange(false);
    } else if (r.reason === "insufficient") {
      setBuildError(insufficientBuildResourcesMessage());
    } else if (r.reason === "prerequisites") {
      setBuildError(
        "You need more of your own completed buildings before you can build that here.",
      );
    } else {
      setBuildError("This build is not available here.");
    }
  };

  return (
    <AppModal open={open} onOpenChange={handleOpenChange} title={actionsTitle} size="md">
      <VStack align="stretch" gap="3" pt="1">
        <SimpleGrid columns={3} gap="1" w="100%">
          {MARCH_RADIAL.map((dir) => {
            if (dir.label === "March") {
              return (
                <Box
                  key="march-center"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  minH="3.25rem"
                  borderRadius="md"
                  bg="white"
                  borderWidth="1px"
                  borderColor="blackAlpha.160"
                  px="1"
                  py="1"
                >
                  <Text
                    fontSize="xs"
                    color="fg"
                    textAlign="center"
                    lineHeight="snug"
                    fontWeight="medium"
                    whiteSpace="pre-line"
                  >
                    {stackMarchStatusLine(marchSpent, kingMarchCap)}
                  </Text>
                </Box>
              );
            }
            const toRow = stack.row + dir.dr;
            const toCol = stack.col + dir.dc;
            const moverOwnerId = stack.ownerId ?? PONDSTEAD_LOCAL_PLAYER_ID;
            const stepCost = marchAdjacentStepCostOrNull(
              map,
              stack.row,
              stack.col,
              toRow,
              toCol,
              revealedCellKeys,
              moverOwnerId,
            );
            const outcome =
              stepCost != null
                ? classifyStackDragEnd(
                    gameStacks,
                    stack.id,
                    toRow,
                    toCol,
                    map,
                    revealedCellKeys,
                    stackMovementUsed,
                    kingMarchCap,
                  )
                : "invalid";
            const marchUsed = stackMovementUsed[stack.id] ?? 0;
            const marchLeft = kingMarchCap - marchUsed;
            const marchOk = stepCost != null && stepCost <= marchLeft + 1e-6;
            const enabled = stepCost != null && (outcome === "move" || outcome === "merge") && marchOk;
            const destBg = moveDirectionButtonBg(map, toRow, toCol);

            return (
              <Button
                key={dir.label}
                type="button"
                size="xs"
                variant="outline"
                colorPalette="lilypad"
                minH="3.25rem"
                h="auto"
                py="1"
                px="1"
                fontWeight="normal"
                lineHeight="1.15"
                bg={destBg}
                borderColor="blackAlpha.280"
                color="fg"
                _hover={
                  enabled
                    ? { bg: destBg, filter: "brightness(0.97)", borderColor: "blackAlpha.400" }
                    : undefined
                }
                _disabled={{ bg: destBg, opacity: 0.45, cursor: "not-allowed" }}
                disabled={!enabled}
                onClick={() => onMarch(stack.id, toRow, toCol)}
              >
                <Text as="span" fontSize="xs" textAlign="center">
                  {dir.label}
                  {stepCost != null ? ` (${formatPondsteadActionPoints(stepCost)} moves)` : ""}
                </Text>
              </Button>
            );
          })}
        </SimpleGrid>
        {buildError != null ? (
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
            {buildError}
          </Text>
        ) : null}
        {hasSplit ? (
          <VStack align="stretch" gap="2">
            <Heading as="h3" size="sm" fontWeight="semibold">
              Split
            </Heading>
            {splitOptions.map((k) => (
              <Button
                key={k}
                type="button"
                size="sm"
                variant="outline"
                colorPalette="lilypad"
                w="100%"
                onClick={() => {
                  onSplit(stack.id, k);
                  onOpenChange(false);
                }}
              >
                Split {k}
              </Button>
            ))}
          </VStack>
        ) : null}
        {hasBuild ? (
          <VStack
            align="stretch"
            gap="2"
            borderTopWidth={hasSplit ? "1px" : 0}
            borderColor="border.subtle"
            pt={hasSplit ? 2 : 0}
          >
            <Heading as="h3" size="sm" fontWeight="semibold">
              Build
            </Heading>
            {stack.kind === "worker"
              ? workerCivicAffordable.map((b) => {
                  const cost = getBuildCostForTarget(map, b, stackOwnerId) ?? { food: 0, wood: 0, stone: 0 };
                  return (
                    <Button
                      key={b}
                      type="button"
                      size="sm"
                      variant="outline"
                      colorPalette="lilypad"
                      w="100%"
                      onClick={() => tryBuild("worker", b)}
                    >
                      {WORKER_BUILD_ACTION_LABEL[b]} — {formatBuildCostPill(cost)}
                    </Button>
                  );
                })
              : null}
            {stack.kind === "worker"
              ? wonderAffordable.map((b) => {
                  const cost = getBuildCostForTarget(map, b, stackOwnerId) ?? { food: 0, wood: 0, stone: 0 };
                  return (
                    <Button
                      key={`wonder-${b}`}
                      type="button"
                      size="sm"
                      variant="outline"
                      colorPalette="lilypad"
                      w="100%"
                      onClick={() => tryBuild("worker", b)}
                    >
                      {WORKER_WONDER_BUILD_ACTION_LABEL[b]} — {formatBuildCostPill(cost)} (3d)
                    </Button>
                  );
                })
              : null}
            {stack.kind === "worker"
              ? militaryAffordable.map((b) => {
                  const cost = getBuildCostForTarget(map, b, stackOwnerId) ?? { food: 0, wood: 0, stone: 0 };
                  return (
                    <Button
                      key={`w-${b}`}
                      type="button"
                      size="sm"
                      variant="outline"
                      colorPalette="lilypad"
                      w="100%"
                      onClick={() => tryBuild("worker", b)}
                    >
                      {MILITARY_BUILD_ACTION_LABEL[b]} — {formatBuildCostPill(cost)}
                    </Button>
                  );
                })
              : null}
            {stack.kind === "soldier"
              ? militaryAffordable.map((b) => {
                  const cost = getBuildCostForTarget(map, b, stackOwnerId) ?? { food: 0, wood: 0, stone: 0 };
                  return (
                    <Button
                      key={`s-${b}`}
                      type="button"
                      size="sm"
                      variant="outline"
                      colorPalette="lilypad"
                      w="100%"
                      onClick={() => tryBuild("soldier", b)}
                    >
                      {MILITARY_BUILD_ACTION_LABEL[b]} — {formatBuildCostPill(cost)}
                    </Button>
                  );
                })
              : null}
          </VStack>
        ) : null}
      </VStack>
    </AppModal>
  );
}
