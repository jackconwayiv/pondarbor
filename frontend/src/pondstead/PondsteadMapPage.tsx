import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  pointerWithin,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Box, Stack, Text } from "@chakra-ui/react";

import { AppModal } from "../components/AppModal";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useAppSession } from "../auth/AppSessionContext";
import PondsteadCommandBar from "./PondsteadCommandBar";
import PondsteadDailyReportModal, { type PondsteadDailyReport } from "./PondsteadDailyReportModal";
import { PONDSTEAD_DEFAULT_MAP_TEMPLATE } from "./defaultMapTemplate";
import {
  canAffordActionCost,
  canAffordOneFullAction,
  foodPerDayFromOrchards,
  kingMarchCapFromMap,
  maxActionsPerTurnFromMap,
  outOfActionsTodayNotice,
  pointsFromMap,
  PONDSTEAD_VICTORY_POINTS,
  populationCapFromMap,
  stackOutOfMarchMessage,
  stonePerDayFromQuarries,
  woodPerDayFromCamps,
} from "./pondsteadHudMetrics";
import { listLocalConstructionsForHud, listQueuedRecruitsForHud } from "./pondsteadHudQueue";
import {
  computeVisibleCellKeys,
  mapCellBuildingOwner,
  mergeVisibleIntoRevealed,
  PONDSTEAD_LOCAL_PLAYER_ID,
} from "./pondsteadVision";
import PondsteadMapGrid from "./PondsteadMapGrid";
import {
  buildingAllowsRecruitWorker,
  placementPrerequisitesMetForTarget,
  tryStartConstruction,
} from "./pondsteadBuild";
import { canStartWonderConstruction, hasCompletedMausoleumForOwner, isWonderBuildingKind } from "./pondsteadWonders";
import {
  advanceConstructionsAndReleaseBorrowedUnits,
  pondsteadCellKey,
  processPendingRecruitsAtDayStart,
  totalPopulationTowardCap,
  type PendingRecruits,
} from "./pondsteadDay";
import {
  applyCost,
  canAfford,
  getBuildCostForTarget,
  getRecruitCostForNextUnit,
  PONDSTEAD_STARTING_RESOURCES,
  type PlaceBuildResult,
  type ResourcePurse,
} from "./pondsteadBuildingCosts";
import {
  findFirstBuildingCell,
  findHeadquartersCell,
  parseMapTemplate,
} from "./parseMapTemplate";
import { chebyshevDistance, chebyshevMoveActionCost } from "./adjacency";
import {
  applyRecruit,
  applyStackDragEnd,
  applyStackSplit,
  classifyStackDragEnd,
  createInitialStacks,
  mergeSurvivorStackId,
  PONDSTEAD_MAX_PER_KIND_ON_TILE,
  parseDndStackId,
  parseDndTileId,
  removeOneUnitOfKindFromCell,
  stacksOnCell,
  totalKindCountOnCell,
  type PondsteadUnitKind,
  type RecruitAttemptResult,
  type UnitStack,
  unitEmoji,
  unitKindLabel,
} from "./pondsteadUnits";
import { buildingLabel } from "./terrain";
import type { BuildingKind, ParsedMap } from "./types";
import { pondsteadCornerUnitGlyphPx } from "./sizes";
import {
  capturePondsteadUndoSnapshot,
  type PondsteadUndoSnapshot,
  PONDSTEAD_UNDO_MAX_DEPTH,
  rehydratePondsteadUndoSnapshot,
} from "./pondsteadUndoSnapshot";
import { usePondsteadMapZoom } from "./usePondsteadMapZoom";
import type { PondsteadViewMode } from "./viewModes";

function parseDefaultPondsteadMap(): ParsedMap {
  return parseMapTemplate(PONDSTEAD_DEFAULT_MAP_TEMPLATE);
}

function createDefaultPondsteadStacks(m: ParsedMap): UnitStack[] {
  const h = findHeadquartersCell(m) ?? { row: 4, col: 4 };
  const camp = findFirstBuildingCell(m, "camp");
  const orchard = findFirstBuildingCell(m, "orchard");
  return createInitialStacks(h, camp, orchard);
}

function initialPondsteadRevealedCells(): Set<string> {
  const m = parseDefaultPondsteadMap();
  const s = createDefaultPondsteadStacks(m);
  return mergeVisibleIntoRevealed(
    computeVisibleCellKeys(m, s, PONDSTEAD_LOCAL_PLAYER_ID),
    new Set(),
  );
}

function centerScrollOnHq(
  el: HTMLDivElement,
  hq: { row: number; col: number },
  cellSizePx: number,
): void {
  const vw = el.clientWidth;
  const vh = el.clientHeight;
  if (vw < 1 || vh < 1) return;
  const cx = (hq.col + 0.5) * cellSizePx;
  const cy = (hq.row + 0.5) * cellSizePx;
  const maxL = Math.max(0, el.scrollWidth - vw);
  const maxT = Math.max(0, el.scrollHeight - vh);
  el.scrollLeft = Math.max(0, Math.min(maxL, cx - vw / 2));
  el.scrollTop = Math.max(0, Math.min(maxT, cy - vh / 2));
}

export default function PondsteadMapPage() {
  const [map, setMap] = useState(parseDefaultPondsteadMap);
  const [recruitQueues, setRecruitQueues] = useState<PendingRecruits>({});
  const [day, setDay] = useState(1);
  const endDaySyncRef = useRef({
    map: parseDefaultPondsteadMap(),
    stacks: [] as UnitStack[],
    recruitQueues: {} as PendingRecruits,
    revealedCellKeys: new Set<string>(),
    scoutedTodayCellKeys: new Set<string>(),
  });
  const [stacks, setStacks] = useState<UnitStack[]>(() => createDefaultPondsteadStacks(parseDefaultPondsteadMap()));
  const hq = useMemo(() => findHeadquartersCell(map), [map]);
  const [viewMode, setViewMode] = useState<PondsteadViewMode>("medium");
  const [actionsRemaining, setActionsRemaining] = useState(() =>
    maxActionsPerTurnFromMap(parseDefaultPondsteadMap()),
  );
  const [recruitUsedThisDay, setRecruitUsedThisDay] = useState<Set<string>>(() => new Set());
  const [currentFood, setCurrentFood] = useState(PONDSTEAD_STARTING_RESOURCES.food);
  const [currentWood, setCurrentWood] = useState(PONDSTEAD_STARTING_RESOURCES.wood);
  const [currentStone, setCurrentStone] = useState(PONDSTEAD_STARTING_RESOURCES.stone);
  const [pinchScale, setPinchScale] = useState(1);
  /** After “End day”, map actions are locked until “Resume day” or “Start new day”. */
  const [awaitingNewDayConfirm, setAwaitingNewDayConfirm] = useState(false);
  const { viewportRef, cellSizePx } = usePondsteadMapZoom(viewMode, pinchScale, setPinchScale);
  const didInitialHqScroll = useRef(false);
  const [revealedCellKeys, setRevealedCellKeys] = useState(initialPondsteadRevealedCells);
  /** LOS cells seen this day; merged into `revealedCellKeys` only when the day ends. */
  const [scoutedTodayCellKeys, setScoutedTodayCellKeys] = useState(() => new Set<string>());
  const [activeDragStackId, setActiveDragStackId] = useState<string | null>(null);
  const [mapPointerHint, setMapPointerHint] = useState<"actions" | "march" | null>(null);
  const mapPointerHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stackMovementUsed, setStackMovementUsed] = useState<Record<string, number>>({});
  const undoStackRef = useRef<PondsteadUndoSnapshot[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const canUndo = undoCount > 0;
  const { sessionUser } = useAppSession();
  const dayRef = useRef(day);
  useEffect(() => {
    dayRef.current = day;
  }, [day]);
  const [dailyReport, setDailyReport] = useState<PondsteadDailyReport | null>(null);
  const [victoryModalDismissed, setVictoryModalDismissed] = useState(false);

  const flashMapPointerHint = useCallback((kind: "actions" | "march") => {
    if (mapPointerHintTimeoutRef.current) {
      clearTimeout(mapPointerHintTimeoutRef.current);
    }
    setMapPointerHint(kind);
    mapPointerHintTimeoutRef.current = setTimeout(() => {
      setMapPointerHint(null);
      mapPointerHintTimeoutRef.current = null;
    }, 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (mapPointerHintTimeoutRef.current) {
        clearTimeout(mapPointerHintTimeoutRef.current);
      }
    };
  }, []);

  const activeDragStack = activeDragStackId ? stacks.find((s) => s.id === activeDragStackId) : undefined;

  const foodPerDay = useMemo(() => foodPerDayFromOrchards(stacks, map), [map, stacks]);
  const woodPerDay = useMemo(() => woodPerDayFromCamps(stacks, map), [map, stacks]);
  const stonePerDay = useMemo(() => stonePerDayFromQuarries(stacks, map), [map, stacks]);
  const totalPopulation = useMemo(
    () => totalPopulationTowardCap(stacks, map, recruitQueues),
    [stacks, map, recruitQueues],
  );
  const populationCap = useMemo(() => populationCapFromMap(map), [map]);
  const points = useMemo(() => pointsFromMap(map), [map]);
  const actionCapPerTurn = useMemo(() => maxActionsPerTurnFromMap(map), [map]);
  const gameWon = points >= PONDSTEAD_VICTORY_POINTS;

  useEffect(() => {
    if (points < PONDSTEAD_VICTORY_POINTS) setVictoryModalDismissed(false);
  }, [points]);
  const hudQueuedRecruits = useMemo(
    () => listQueuedRecruitsForHud(map, recruitQueues, PONDSTEAD_LOCAL_PLAYER_ID),
    [map, recruitQueues],
  );
  const hudLocalConstructions = useMemo(
    () => listLocalConstructionsForHud(map, PONDSTEAD_LOCAL_PLAYER_ID),
    [map],
  );
  const playerResources: ResourcePurse = useMemo(
    () => ({ food: currentFood, wood: currentWood, stone: currentStone }),
    [currentFood, currentWood, currentStone],
  );

  const pushUndoSnapshot = useCallback(() => {
    const snap = capturePondsteadUndoSnapshot({
      map,
      stacks,
      recruitQueues,
      revealedCellKeys,
      scoutedTodayCellKeys,
      currentFood,
      currentWood,
      currentStone,
      actionsRemaining,
      day,
      stackMovementUsed,
      recruitUsedThisDayKeys: recruitUsedThisDay,
    });
    undoStackRef.current = [...undoStackRef.current, snap].slice(-PONDSTEAD_UNDO_MAX_DEPTH);
    setUndoCount(undoStackRef.current.length);
  }, [
    map,
    stacks,
    recruitQueues,
    revealedCellKeys,
    scoutedTodayCellKeys,
    currentFood,
    currentWood,
    currentStone,
    actionsRemaining,
    day,
    stackMovementUsed,
    recruitUsedThisDay,
  ]);

  const handleUndo = useCallback(() => {
    const st = undoStackRef.current;
    if (st.length === 0) return;
    const snap = st[st.length - 1]!;
    undoStackRef.current = st.slice(0, -1);
    setUndoCount(undoStackRef.current.length);
    setActiveDragStackId(null);
    const a = rehydratePondsteadUndoSnapshot(snap);
    setMap(a.map);
    setStacks(a.stacks);
    setRecruitQueues(a.recruitQueues);
    setRevealedCellKeys(a.revealedCellKeys);
    setScoutedTodayCellKeys(a.scoutedTodayCellKeys);
    setCurrentFood(a.currentFood);
    setCurrentWood(a.currentWood);
    setCurrentStone(a.currentStone);
    setActionsRemaining(a.actionsRemaining);
    setDay(a.day);
    setStackMovementUsed(a.stackMovementUsed);
    setRecruitUsedThisDay(a.recruitUsedThisDayKeys);
  }, []);

  /** Current LOS from units/buildings; only drives “full” vs terrain during the turn (not hidden↔revealed). */
  const liveVisibleCellKeys = useMemo(
    () => computeVisibleCellKeys(map, stacks, PONDSTEAD_LOCAL_PLAYER_ID),
    [map, stacks],
  );

  /**
   * Bookkeeping only: union of live LOS over the day. Merged into `revealedCellKeys` at end of day;
   * not used for rendering (so fog does not clear mid-turn).
   */
  useEffect(() => {
    setScoutedTodayCellKeys((prev) => mergeVisibleIntoRevealed(liveVisibleCellKeys, prev));
  }, [liveVisibleCellKeys]);

  useLayoutEffect(() => {
    endDaySyncRef.current = {
      map,
      stacks,
      recruitQueues,
      revealedCellKeys,
      scoutedTodayCellKeys,
    };
  }, [map, stacks, recruitQueues, revealedCellKeys, scoutedTodayCellKeys]);

  const handleEndDayOrResume = useCallback(() => {
    if (gameWon) return;
    setAwaitingNewDayConfirm((v) => !v);
  }, [gameWon]);

  const handleCommitNewDay = useCallback(() => {
    if (gameWon) return;
    const sync = endDaySyncRef.current;
    const { map: m0, stacks: s0, recruitQueues: q0 } = sync;
    const foodGained = foodPerDayFromOrchards(s0, m0);
    const woodGained = woodPerDayFromCamps(s0, m0);
    const stoneGained = stonePerDayFromQuarries(s0, m0);
    const liveAtEndOfDay = computeVisibleCellKeys(m0, s0, PONDSTEAD_LOCAL_PLAYER_ID);
    const scoutUnion = mergeVisibleIntoRevealed(liveAtEndOfDay, sync.scoutedTodayCellKeys);
    const nextRevealed = mergeVisibleIntoRevealed(scoutUnion, sync.revealedCellKeys);
    undoStackRef.current = [];
    setUndoCount(0);
    const {
      map: m1,
      stacks: sAfterConstruction,
      completed,
      stillBuilding,
    } = advanceConstructionsAndReleaseBorrowedUnits(m0, s0);
    const { stacks: s1, queues: q1 } = processPendingRecruitsAtDayStart(m1, sAfterConstruction, q0);

    const recruits: PondsteadDailyReport["recruits"] = [];
    for (const key of Object.keys(q0)) {
      if (q1[key] !== undefined) continue;
      const kind = q0[key];
      if (kind === undefined) continue;
      const [row, col] = key.split("-").map(Number);
      const cell = m1.cells[row]?.[col];
      if (!cell || cell.building === "none") continue;
      recruits.push({
        kindLabel: unitKindLabel(kind),
        buildingLabel: buildingLabel(cell.building as Exclude<BuildingKind, "none">),
      });
    }

    const nextDay = dayRef.current + 1;
    const playerName =
      sessionUser?.profile.display_name?.trim() || sessionUser?.user.username || "Player";

    setDailyReport({
      welcomeDay: nextDay,
      playerName,
      foodGained,
      woodGained,
      stoneGained,
      recruits,
      completedBuildings: completed.map((c) => ({ label: c.label })),
      stillBuilding: stillBuilding.map((s) => ({ label: s.label, nightsLeft: s.nightsLeft })),
    });

    setMap(m1);
    setStacks(s1);
    setRecruitQueues(q1);
    setCurrentFood((f) => f + foodGained);
    setCurrentWood((w) => w + woodGained);
    setCurrentStone((s) => s + stoneGained);
    setActionsRemaining(maxActionsPerTurnFromMap(m1));
    setStackMovementUsed({});
    setRecruitUsedThisDay(new Set());
    setRevealedCellKeys(nextRevealed);
    setScoutedTodayCellKeys(new Set());
    setDay(nextDay);
    setAwaitingNewDayConfirm(false);
  }, [sessionUser, gameWon]);

  const onPlaceBuilding = useCallback(
    (row: number, col: number, unitKind: PondsteadUnitKind, target: BuildingKind): PlaceBuildResult => {
      if (gameWon) return { ok: false, reason: "no_actions" };
      if (awaitingNewDayConfirm) return { ok: false, reason: "no_actions" };
      if (!canAffordOneFullAction(actionsRemaining)) return { ok: false, reason: "no_actions" };
      const cost = getBuildCostForTarget(map, target);
      if (!cost) return { ok: false, reason: "invalid" };
      const purse = { food: currentFood, wood: currentWood, stone: currentStone };
      if (!canAfford(purse, cost)) return { ok: false, reason: "insufficient" };
      const builders = stacksOnCell(stacks, row, col)
        .filter((s) => s.kind === unitKind)
        .sort((a, b) => a.id.localeCompare(b.id));
      const constructionOwnerId = builders[0]?.ownerId ?? PONDSTEAD_LOCAL_PLAYER_ID;
      if (isWonderBuildingKind(target)) {
        const cell = map.cells[row]![col]!;
        if (!canStartWonderConstruction(map, cell, constructionOwnerId, target)) {
          return { ok: false, reason: "prerequisites" };
        }
      } else if (!placementPrerequisitesMetForTarget(map, target, constructionOwnerId)) {
        return { ok: false, reason: "prerequisites" };
      }
      const nextStacks = removeOneUnitOfKindFromCell(stacks, row, col, unitKind);
      if (!nextStacks) return { ok: false, reason: "invalid" };
      const nextMap = tryStartConstruction(map, row, col, unitKind, target, constructionOwnerId);
      if (!nextMap) return { ok: false, reason: "invalid" };
      pushUndoSnapshot();
      const after = applyCost(purse, cost);
      setMap(nextMap);
      setStacks(nextStacks);
      setCurrentFood(after.food);
      setCurrentWood(after.wood);
      setCurrentStone(after.stone);
      setActionsRemaining((a) => Math.max(0, a - 1));
      return { ok: true };
    },
    [actionsRemaining, awaitingNewDayConfirm, gameWon, map, pushUndoSnapshot, stacks, currentFood, currentWood, currentStone],
  );

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragStackId(parseDndStackId(event.active.id));
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (gameWon) return;
      if (awaitingNewDayConfirm) return;
      const { active, over } = event;
      setActiveDragStackId(null);
      if (!over) return;
      const stackId = parseDndStackId(active.id);
      if (!stackId) return;
      const to = parseDndTileId(over.id);
      if (!to) return;
      const dragged = stacks.find((s) => s.id === stackId);
      if (!dragged) return;
      const marchCap = kingMarchCapFromMap(map, dragged.ownerId ?? PONDSTEAD_LOCAL_PLAYER_ID);
      const outcome = classifyStackDragEnd(
        stacks,
        stackId,
        to.row,
        to.col,
        map.width,
        map.height,
        stackMovementUsed,
        marchCap,
      );
      if (outcome === "invalid" || outcome === "noop") return;
      if (outcome === "out_of_march") {
        flashMapPointerHint("march");
        return;
      }
      const d = chebyshevDistance(dragged, { row: to.row, col: to.col });
      const moveActionCost = chebyshevMoveActionCost(dragged, { row: to.row, col: to.col });
      if (outcome === "move") {
        if (!canAffordActionCost(actionsRemaining, moveActionCost)) {
          flashMapPointerHint("actions");
          return;
        }
      } else if (outcome === "merge") {
        if (!canAffordOneFullAction(actionsRemaining)) {
          flashMapPointerHint("actions");
          return;
        }
      }
      const next = applyStackDragEnd(
        stacks,
        stackId,
        to.row,
        to.col,
        map.width,
        map.height,
        stackMovementUsed,
        marchCap,
      );
      if (!next) return;
      pushUndoSnapshot();
      setStacks(next);
      if (outcome === "move") {
        setActionsRemaining((a) => Math.max(0, a - moveActionCost));
        setStackMovementUsed((prev) => ({
          ...prev,
          [stackId]: (prev[stackId] ?? 0) + d,
        }));
      } else if (outcome === "merge") {
        setActionsRemaining((a) => Math.max(0, a - 1));
        const keepId = mergeSurvivorStackId(stacks, stackId, to.row, to.col);
        if (keepId != null) {
          setStackMovementUsed((prev) => {
            const uKeep = prev[keepId] ?? 0;
            const uDrag = prev[stackId] ?? 0;
            const nextUsed = { ...prev };
            delete nextUsed[stackId];
            nextUsed[keepId] = Math.max(uKeep, uDrag + 1);
            return nextUsed;
          });
        }
      } else if (outcome === "merge_same_cell") {
        const keepId = mergeSurvivorStackId(stacks, stackId, to.row, to.col);
        if (keepId != null) {
          setStackMovementUsed((prev) => {
            const uKeep = prev[keepId] ?? 0;
            const uDrag = prev[stackId] ?? 0;
            const nextUsed = { ...prev };
            delete nextUsed[stackId];
            nextUsed[keepId] = Math.max(uKeep, uDrag);
            return nextUsed;
          });
        }
      }
    },
    [
      actionsRemaining,
      awaitingNewDayConfirm,
      gameWon,
      flashMapPointerHint,
      map,
      map.height,
      map.width,
      pushUndoSnapshot,
      stackMovementUsed,
      stacks,
    ],
  );

  const onDragCancel = useCallback(() => {
    setActiveDragStackId(null);
  }, []);

  const onSplit = useCallback(
    (stackId: string, splitCount: number) => {
      if (gameWon) return;
      if (awaitingNewDayConfirm) return;
      const beforeIds = new Set(stacks.map((s) => s.id));
      const next = applyStackSplit(stacks, stackId, splitCount);
      if (!next) return;
      const newStack = next.find((s) => !beforeIds.has(s.id));
      pushUndoSnapshot();
      setStacks(next);
      if (newStack) {
        setStackMovementUsed((prev) => {
          const u = prev[stackId] ?? 0;
          if (prev[newStack.id] === u) return prev;
          return { ...prev, [newStack.id]: u };
        });
      }
    },
    [awaitingNewDayConfirm, gameWon, stacks, pushUndoSnapshot],
  );

  const onRecruit = useCallback(
    (row: number, col: number, kind: PondsteadUnitKind): RecruitAttemptResult => {
      if (gameWon) return "no_actions";
      if (awaitingNewDayConfirm) return "no_actions";
      if (!canAffordOneFullAction(actionsRemaining)) return "no_actions";
      const key = pondsteadCellKey(row, col);
      if (recruitQueues[key] !== undefined) return "recruit_pending";
      const workerDailyKey = `${key}:worker`;
      if (kind === "worker" && recruitUsedThisDay.has(workerDailyKey)) return "already_recruited_today";
      if (totalPopulationTowardCap(stacks, map, recruitQueues) >= populationCap) return "population";
      if (totalKindCountOnCell(stacks, row, col, kind) >= PONDSTEAD_MAX_PER_KIND_ON_TILE) {
        return "tile";
      }
      const cost = getRecruitCostForNextUnit(stacks, kind, recruitQueues, map);
      const purse = { food: currentFood, wood: currentWood, stone: currentStone };
      if (!canAfford(purse, cost)) return "insufficient";

      const cellAt = map.cells[row]![col]!;
      const bk = cellAt.building;
      const buildingOwner = mapCellBuildingOwner(cellAt);
      const instantWorker =
        kind === "worker" &&
        bk !== "none" &&
        buildingAllowsRecruitWorker(bk as Exclude<BuildingKind, "none">) &&
        hasCompletedMausoleumForOwner(map, buildingOwner) &&
        !recruitUsedThisDay.has(workerDailyKey);

      if (instantWorker) {
        pushUndoSnapshot();
        const after = applyCost(purse, cost);
        const applied = applyRecruit(stacks, row, col, kind, populationCap, buildingOwner);
        if (!applied) return "population";
        setStacks(applied);
        setCurrentFood(after.food);
        setCurrentWood(after.wood);
        setCurrentStone(after.stone);
        setActionsRemaining((a) => Math.max(0, a - 1));
        setRecruitUsedThisDay((prev) => {
          const next = new Set(prev);
          next.add(workerDailyKey);
          return next;
        });
        return "ok";
      }

      pushUndoSnapshot();
      const after = applyCost(purse, cost);
      setRecruitQueues((q) => ({ ...q, [key]: kind }));
      setCurrentFood(after.food);
      setCurrentWood(after.wood);
      setCurrentStone(after.stone);
      setActionsRemaining((a) => Math.max(0, a - 1));
      return "ok";
    },
    [
      actionsRemaining,
      awaitingNewDayConfirm,
      gameWon,
      stacks,
      recruitQueues,
      map,
      currentFood,
      currentWood,
      currentStone,
      populationCap,
      pushUndoSnapshot,
      recruitUsedThisDay,
    ],
  );

  const dragOverlayGlyphPx = cellSizePx > 0 ? pondsteadCornerUnitGlyphPx(cellSizePx) : 12;
  const dragOverlayLabelPx = Math.max(8, Math.floor(dragOverlayGlyphPx * 0.45));

  useEffect(() => {
    setPinchScale(1);
  }, [viewMode]);

  useLayoutEffect(() => {
    if (didInitialHqScroll.current) return;
    if (cellSizePx <= 0 || !hq) return;
    const el = viewportRef.current;
    if (!el) return;

    let attempts = 0;
    const tryScroll = () => {
      if (didInitialHqScroll.current) return;
      if (el.scrollWidth < 4 && attempts < 12) {
        attempts += 1;
        requestAnimationFrame(tryScroll);
        return;
      }
      centerScrollOnHq(el, hq, cellSizePx);
      didInitialHqScroll.current = true;
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(tryScroll);
    });
  }, [cellSizePx, hq, map.height, map.width, viewportRef]);

  return (
    <Stack flex="1" minH="0" minW={0} w="100%" gap="0" align="stretch" position="relative">
      <PondsteadDailyReportModal
        report={dailyReport}
        onOpenChange={(open) => {
          if (!open) setDailyReport(null);
        }}
      />
      <AppModal
        open={gameWon && !victoryModalDismissed}
        onOpenChange={(open) => {
          if (!open) setVictoryModalDismissed(true);
        }}
        title="You win!"
        size="sm"
      >
        <Text fontSize="sm" color="fg">
          You reached {PONDSTEAD_VICTORY_POINTS} points. Thanks for playing Pondstead!
        </Text>
      </AppModal>
      <PondsteadCommandBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        day={day}
        awaitingNewDayConfirm={awaitingNewDayConfirm}
        onEndDayOrResume={handleEndDayOrResume}
        onStartNewDay={handleCommitNewDay}
        onUndo={handleUndo}
        canUndo={canUndo}
        actionsRemaining={actionsRemaining}
        actionCap={actionCapPerTurn}
        points={points}
        pointsToWin={PONDSTEAD_VICTORY_POINTS}
        gameWon={gameWon}
        totalPopulation={totalPopulation}
        populationCap={populationCap}
        currentFood={currentFood}
        foodPerDay={foodPerDay}
        currentWood={currentWood}
        woodPerDay={woodPerDay}
        currentStone={currentStone}
        stonePerDay={stonePerDay}
        queuedRecruits={hudQueuedRecruits}
        localConstructions={hudLocalConstructions}
      />
      <Box
        flex="1"
        minH="0"
        minW={0}
        w="100%"
        display="flex"
        flexDirection="column"
        px={{ base: "1.5", md: "2" }}
        py={{ base: "1.5", md: "2" }}
      >
        <Box
          position="relative"
          flex="1"
          minH="0"
          minW={0}
          w="100%"
          display="flex"
          flexDirection="column"
          borderWidth="1px"
          borderColor="border"
          borderRadius="md"
          bg="bg.subtle"
          overflow="hidden"
          boxShadow="sm"
        >
        {mapPointerHint != null ? (
          <Box
            position="absolute"
            bottom="0.35rem"
            left="50%"
            transform="translateX(-50%)"
            zIndex={90}
            px="2.5"
            py="1"
            maxW="min(22rem, calc(100% - 1.5rem))"
            borderRadius="md"
            bg="bg.subtle"
            borderWidth="1px"
            borderColor="border"
            boxShadow="sm"
            pointerEvents="none"
          >
            <Text fontSize="xs" color="fg.muted" textAlign="center" lineHeight="snug">
              {mapPointerHint === "actions" ? outOfActionsTodayNotice() : stackOutOfMarchMessage()}
            </Text>
          </Box>
        ) : null}
          <Box
            ref={viewportRef}
            flex="1"
            minH="0"
            minW={0}
            w="100%"
            h="100%"
            overflow="auto"
            overscrollBehavior="contain"
            p={{ base: "1.5", md: "2" }}
            touchAction="manipulation"
          >
            {cellSizePx > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragCancel={onDragCancel}
              >
                <PondsteadMapGrid
                  map={map}
                  cellSizePx={cellSizePx}
                  stacks={stacks}
                  recruitQueues={recruitQueues}
                  actionsRemaining={actionsRemaining}
                  playerResources={playerResources}
                  recruitUsedWorkerSlotKeys={recruitUsedThisDay}
                  stackMovementUsed={stackMovementUsed}
                  revealedCellKeys={revealedCellKeys}
                  visibleCellKeys={liveVisibleCellKeys}
                  interactionLocked={awaitingNewDayConfirm || gameWon}
                  onSplit={onSplit}
                  onRecruit={onRecruit}
                  onPlaceBuilding={onPlaceBuilding}
                />
                <DragOverlay zIndex={2000} dropAnimation={null} style={{ cursor: "grabbing" }}>
                  {activeDragStack ? (
                    <Box
                      display="inline-flex"
                      flexDirection="column"
                      alignItems="center"
                      p="0.15rem"
                      minW="1rem"
                      borderRadius="sm"
                      bg="white/90"
                      borderWidth="1px"
                      borderColor="black/20"
                      boxShadow="md"
                    >
                      <Text as="span" fontSize={`${dragOverlayGlyphPx}px`} lineHeight="1">
                        {unitEmoji(activeDragStack.kind)}
                      </Text>
                      <Text
                        as="span"
                        fontSize={`${dragOverlayLabelPx}px`}
                        fontWeight="semibold"
                        lineHeight="1.1"
                        textAlign="center"
                      >
                        {activeDragStack.count}
                      </Text>
                    </Box>
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : null}
          </Box>
        </Box>
      </Box>
    </Stack>
  );
}
