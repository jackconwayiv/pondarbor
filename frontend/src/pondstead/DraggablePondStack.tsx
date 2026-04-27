import type { CSSProperties, SyntheticEvent } from "react";
import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Box, Button, Text, VStack } from "@chakra-ui/react";

import { AppModal } from "../components/AppModal";
import {
  MILITARY_BUILD_ACTION_LABEL,
  militaryBuildOptionsOnCell,
  WORKER_BUILD_ACTION_LABEL,
  WORKER_WONDER_BUILD_ACTION_LABEL,
  workerCivicBuildOptionsOnCell,
  workerWonderBuildOptionsOnCell,
} from "./pondsteadBuild";
import { PONDSTEAD_LOCAL_PLAYER_ID } from "./pondsteadVision";
import {
  canAfford,
  formatBuildCostPill,
  getBuildCostForTarget,
  insufficientBuildResourcesMessage,
  type PlaceBuildResult,
  type ResourcePurse,
} from "./pondsteadBuildingCosts";
import {
  canAffordOneFullAction,
  noActionsRemainingMessage,
  outOfActionsTodayNotice,
  stackMarchStatusLine,
} from "./pondsteadHudMetrics";
import {
  PONDSTEAD_DND_STACK,
  type PondsteadUnitKind,
  type UnitStack,
  stackAriaLabel,
  unitEmoji,
  unitKindLabel,
} from "./pondsteadUnits";
import type { BuildingKind, MapCell, ParsedMap } from "./types";

function buildKindsPlayerCanPayFor<T extends BuildingKind>(
  kinds: readonly T[],
  map: ParsedMap,
  playerResources: ResourcePurse,
  canSpendAction: boolean,
): T[] {
  if (!canSpendAction) return [];
  return kinds.filter((b) => {
    const cost = getBuildCostForTarget(map, b) ?? { food: 0, wood: 0, stone: 0 };
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

export default function DraggablePondStack({
  cell,
  map,
  stack,
  fontPx,
  playerResources,
  actionsRemaining,
  marchSpent,
  kingMarchCap,
  interactionLocked,
  onSplit,
  onPlaceBuilding,
}: {
  cell: MapCell;
  map: ParsedMap;
  stack: UnitStack;
  fontPx: number;
  playerResources: ResourcePurse;
  actionsRemaining: number;
  /** Chebyshev squares this stack has marched so far today. */
  marchSpent: number;
  /** Daily Chebyshev march budget for this stack (Colossus may raise it). */
  kingMarchCap: number;
  interactionLocked: boolean;
  onSplit: (stackId: string, splitCount: number) => void;
  onPlaceBuilding: (unitKind: PondsteadUnitKind, target: BuildingKind) => PlaceBuildResult;
}) {
  const [open, setOpen] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: PONDSTEAD_DND_STACK(stack.id),
    disabled: interactionLocked,
  });
  const style: CSSProperties = {
    ...(isDragging
      ? { opacity: 0.22, transform: transform ? CSS.Translate.toString(transform) : undefined }
      : {}),
  };

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
  const canSpendAction = canAffordOneFullAction(actionsRemaining);
  const workerCivicAffordable = buildKindsPlayerCanPayFor(workerCivicOnCell, map, playerResources, canSpendAction);
  const wonderAffordable = buildKindsPlayerCanPayFor(workerWonderOnCell, map, playerResources, canSpendAction);
  const militaryAffordable = buildKindsPlayerCanPayFor(militaryOnCell, map, playerResources, canSpendAction);
  const hasPlacementBuild =
    stack.kind === "worker"
      ? workerCivicOnCell.length + workerWonderOnCell.length + militaryOnCell.length > 0
      : militaryOnCell.length > 0;
  const hasBuild =
    stack.kind === "worker"
      ? workerCivicAffordable.length + wonderAffordable.length + militaryAffordable.length > 0
      : militaryAffordable.length > 0;
  const hasSplit = splitOptions.length > 0;

  const actionsTitle = `${unitKindLabel(stack.kind)} Unit Actions`;
  const numPx = Math.max(8, Math.floor(fontPx * 0.5));

  const onModalOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setBuildError(null);
  };

  const tryBuild = (unitKind: PondsteadUnitKind, target: BuildingKind) => {
    const r = onPlaceBuilding(unitKind, target);
    if (r.ok) {
      setBuildError(null);
      setOpen(false);
    } else if (r.reason === "insufficient") {
      setBuildError(insufficientBuildResourcesMessage());
    } else if (r.reason === "no_actions") {
      setBuildError(noActionsRemainingMessage());
    } else if (r.reason === "prerequisites") {
      setBuildError(
        "You need more of your own completed buildings before you can build that here.",
      );
    } else {
      setBuildError("This build is not available here.");
    }
  };

  const stopDndFromSeeingUnitTap = (e: SyntheticEvent) => {
    e.stopPropagation();
  };

  const handlePx = Math.max(10, Math.floor(fontPx * 0.38));

  return (
    <Box
      ref={setNodeRef}
      position="relative"
      zIndex={2}
      flex="0 0 auto"
      maxW="min(48%, calc(50% - 0.1rem))"
      display="flex"
      flexDirection="row"
      alignItems="stretch"
      gap="0"
      style={style}
    >
      <Button
        type="button"
        variant="ghost"
        flex="1"
        minW="0"
        p="0.1rem"
        minH="1rem"
        h="auto"
        fontSize={`${fontPx}px`}
        lineHeight="1.15"
        borderRadius="sm"
        borderTopRightRadius="0"
        borderBottomRightRadius="0"
        bg="white/25"
        borderWidth="1px"
        borderColor="black/12"
        borderRightWidth="0"
        _hover={{ bg: "white/40" }}
        disabled={interactionLocked}
        cursor={interactionLocked ? "not-allowed" : "pointer"}
        aria-label={stackAriaLabel(stack.kind, stack.count)}
        aria-haspopup="dialog"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        gap="0.05rem"
        onPointerDown={stopDndFromSeeingUnitTap}
        onTouchStart={stopDndFromSeeingUnitTap}
        onClick={() => setOpen(true)}
      >
        <Text as="span" fontSize={`${fontPx}px`} lineHeight="1">
          {unitEmoji(stack.kind)}
        </Text>
        <Text as="span" fontSize={`${numPx}px`} fontWeight="semibold" lineHeight="1" textAlign="center">
          {stack.count}
        </Text>
      </Button>
      <Box
        {...listeners}
        {...attributes}
        aria-label="Drag unit to another tile"
        title="Drag to move"
        flexShrink={0}
        display="flex"
        alignItems="center"
        justifyContent="center"
        w="0.65rem"
        alignSelf="stretch"
        borderTopRightRadius="sm"
        borderBottomRightRadius="sm"
        bg="white/18"
        borderWidth="1px"
        borderColor="black/12"
        borderLeftWidth="1px"
        cursor={interactionLocked ? "not-allowed" : isDragging ? "grabbing" : "grab"}
        touchAction="none"
        opacity={interactionLocked ? 0.45 : 1}
        pointerEvents={interactionLocked ? "none" : "auto"}
        _hover={interactionLocked ? {} : { bg: "white/32" }}
        userSelect="none"
      >
        <Text as="span" aria-hidden fontSize={`${handlePx}px`} lineHeight="1" color="fg.muted">
          ⋮
        </Text>
      </Box>
      <AppModal open={open} onOpenChange={onModalOpenChange} title={actionsTitle} size="md">
        <VStack align="stretch" gap="3" pt="1">
          <Text fontSize="xs" color="fg.muted" textAlign="center">
            {stackMarchStatusLine(marchSpent, kingMarchCap)}
          </Text>
          {!canAffordOneFullAction(actionsRemaining) ? (
            <Text fontSize="xs" color="fg.muted" textAlign="center" fontStyle="italic">
              {outOfActionsTodayNotice()}
            </Text>
          ) : null}
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
                    setOpen(false);
                  }}
                >
                  Split {k}
                </Button>
              ))}
            </VStack>
          ) : null}
          {hasSplit && hasPlacementBuild && !hasBuild ? (
            <Text fontSize="xs" color="fg.muted" textAlign="center">
              No builds on this tile that you can afford right now.
            </Text>
          ) : null}
          {hasBuild ? (
            <VStack
              align="stretch"
              gap="2"
              borderTopWidth={hasSplit ? "1px" : 0}
              borderColor="border.subtle"
              pt={hasSplit ? 2 : 0}
            >
              {stack.kind === "worker"
                ? workerCivicAffordable.map((b) => {
                    const cost = getBuildCostForTarget(map, b) ?? { food: 0, wood: 0, stone: 0 };
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
                    const cost = getBuildCostForTarget(map, b) ?? { food: 0, wood: 0, stone: 0 };
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
                    const cost = getBuildCostForTarget(map, b) ?? { food: 0, wood: 0, stone: 0 };
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
                    const cost = getBuildCostForTarget(map, b) ?? { food: 0, wood: 0, stone: 0 };
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
          {!hasSplit && !hasBuild ? (
            <Text fontSize="sm" color="fg.muted" textAlign="center" pt="1">
              {hasPlacementBuild
                ? "Nothing you can afford to build on this tile (check resources and actions)."
                : "No unit actions on this tile."}
            </Text>
          ) : null}
        </VStack>
      </AppModal>
    </Box>
  );
}
