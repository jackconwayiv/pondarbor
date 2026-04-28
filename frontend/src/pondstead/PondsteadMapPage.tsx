import { Box, Link, Stack, Text } from "@chakra-ui/react";

import { AppModal } from "../components/AppModal";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, useParams } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondsteadCommandBar from "./PondsteadCommandBar";
import PondsteadDailyReportModal, { type PondsteadDailyReport } from "./PondsteadDailyReportModal";
import { runPondsteadCommitNewDayPipeline } from "./pondsteadCommitNewDayPipeline";
import {
  foodPerDayFromOrchardsForOwner,
  kingMarchCapFromMap,
  pointsFromMapForOwner,
  PONDSTEAD_VICTORY_POINTS,
  populationCapForOwner,
  stackOutOfMarchMessage,
  stonePerDayFromQuarriesForOwner,
  totalPopulationTowardCapForOwner,
  woodPerDayFromCampsForOwner,
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
import { pondsteadCellKey, type PendingRecruits } from "./pondsteadDay";
import {
  applyCost,
  canAfford,
  getBuildCostForTarget,
  getRecruitCostForNextUnit,
  PONDSTEAD_STARTING_RESOURCES,
  type PlaceBuildResult,
  type ResourcePurse,
} from "./pondsteadBuildingCosts";
import { findFirstBuildingCellForOwner } from "./parseMapTemplate";
import {
  applyRecruit,
  applyStackDragEnd,
  applyStackSplit,
  classifyStackDragEnd,
  marchAdjacentStepCostOrNull,
  mergeSurvivorStackId,
  PONDSTEAD_MAX_PER_KIND_ON_TILE,
  removeOneUnitOfKindFromCell,
  stacksOnCell,
  totalKindCountOnCell,
  type PondsteadUnitKind,
  type RecruitAttemptResult,
  type UnitStack,
} from "./pondsteadUnits";
import type { BuildingKind, ParsedMap } from "./types";
import { fetchPondsteadGameBootstrap } from "./pondsteadApi";
import {
  persistPondsteadPatchWorld,
  persistPondsteadServerUndo,
  pondsteadServerSyncEnabled,
  serializeWorldForServer,
} from "./pondsteadServerSync";
import {
  clonePursesLoose,
  cloneSeatKeyedMovement,
  cloneSeatKeyedSets,
} from "./pondsteadSeatKeyed";
import { createFreshPondsteadStateForSeatCount } from "./pondsteadWorldLayout";
import { usePondsteadMapZoom } from "./usePondsteadMapZoom";
import type { PondsteadViewMode } from "./viewModes";
import {
  capturePondsteadUndoSnapshot,
  type PondsteadUndoSnapshot,
  PONDSTEAD_UNDO_MAX_DEPTH,
  rehydratePondsteadUndoSnapshot,
} from "./pondsteadUndoSnapshot";
import { hydrateWorldFromServerSnapshot } from "./pondsteadWorldHydrate";

function readMySeatFromEnv(): number {
  const v = parseInt(String(import.meta.env.VITE_PONDSTEAD_MY_SEAT ?? "0").trim(), 10);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

function emptyStackMovementForSeatRecord(
  purses: Record<number, ResourcePurse>,
): Record<number, Record<string, number>> {
  const o: Record<number, Record<string, number>> = {};
  for (const k of Object.keys(purses).map(Number)) {
    if (!Number.isFinite(k)) continue;
    o[k] = {};
  }
  return o;
}

function emptyScoutedForSeatRecord(purses: Record<number, ResourcePurse>): Record<number, Set<string>> {
  const o: Record<number, Set<string>> = {};
  for (const k of Object.keys(purses).map(Number)) {
    if (!Number.isFinite(k)) continue;
    o[k] = new Set();
  }
  return o;
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
  const { campaignId: campaignIdParam } = useParams<{ campaignId?: string }>();
  const resolvedCampaignId =
    (campaignIdParam && campaignIdParam.trim()) ||
    (import.meta.env.VITE_PONDSTEAD_GAME_ID as string | undefined)?.trim() ||
    null;

  const fresh = useMemo(() => createFreshPondsteadStateForSeatCount(2), []);
  const [mySeat, setMySeat] = useState<number>(() => readMySeatFromEnv());

  const [map, setMap] = useState<ParsedMap>(() => fresh.map);
  const [recruitQueues, setRecruitQueues] = useState<PendingRecruits>({});
  const [day, setDay] = useState(1);
  const endDaySyncRef = useRef({
    map: fresh.map,
    stacks: fresh.stacks,
    recruitQueues: {} as PendingRecruits,
    revealedBySeat: cloneSeatKeyedSets(fresh.revealedBySeat),
    scoutedTodayBySeat: emptyScoutedForSeatRecord(fresh.pursesBySeat),
    pursesBySeat: clonePursesLoose(fresh.pursesBySeat),
    bonusPointsBySeat: Object.fromEntries(
      Object.keys(fresh.pursesBySeat).map((k) => [Number(k), 0]),
    ) as Record<number, number>,
  });
  const [stacks, setStacks] = useState<UnitStack[]>(() => fresh.stacks);
  const hq = useMemo(
    () => findFirstBuildingCellForOwner(map, "hq", mySeat),
    [map, mySeat],
  );
  const [viewMode, setViewMode] = useState<PondsteadViewMode>("medium");
  const [recruitUsedThisDay, setRecruitUsedThisDay] = useState<Set<string>>(() => new Set());
  const [playerPurses, setPlayerPurses] = useState<Record<number, ResourcePurse>>(() =>
    clonePursesLoose(fresh.pursesBySeat),
  );
  const [pinchScale, setPinchScale] = useState(1);
  const [awaitingNewDayConfirm, setAwaitingNewDayConfirm] = useState(false);
  const { viewportRef, cellSizePx } = usePondsteadMapZoom(viewMode, pinchScale, setPinchScale);
  const didInitialHqScroll = useRef(false);
  const [revealedBySeat, setRevealedBySeat] = useState<Record<number, Set<string>>>(() =>
    cloneSeatKeyedSets(fresh.revealedBySeat),
  );
  const [scoutedTodayBySeat, setScoutedTodayBySeat] = useState<Record<number, Set<string>>>(() =>
    emptyScoutedForSeatRecord(fresh.pursesBySeat),
  );
  const [mapPointerHint, setMapPointerHint] = useState<"march" | null>(null);
  const mapPointerHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stackMovementBySeat, setStackMovementBySeat] = useState<Record<number, Record<string, number>>>(() =>
    emptyStackMovementForSeatRecord(fresh.pursesBySeat),
  );
  const [bonusPointsBySeat, setBonusPointsBySeat] = useState<Record<number, number>>(() =>
    Object.fromEntries(Object.keys(fresh.pursesBySeat).map((k) => [Number(k), 0])) as Record<number, number>,
  );
  const { sessionUser, getApiAccessToken } = useAppSession();
  const dayRef = useRef(day);
  const mySeatRef = useRef(mySeat);
  const serverRevisionRef = useRef(0);
  const pendingServerPatchRef = useRef(false);
  const undoStackRef = useRef<PondsteadUndoSnapshot[]>([]);
  const [undoStackLen, setUndoStackLen] = useState(0);
  const bumpUndoUi = useCallback(() => {
    setUndoStackLen(undoStackRef.current.length);
  }, []);
  const canUndo = undoStackLen > 0;
  const undoCaptureRef = useRef({
    map: fresh.map,
    stacks: fresh.stacks,
    recruitQueues: {} as PendingRecruits,
    revealedBySeat: cloneSeatKeyedSets(fresh.revealedBySeat),
    scoutedTodayBySeat: emptyScoutedForSeatRecord(fresh.pursesBySeat),
    pursesBySeat: clonePursesLoose(fresh.pursesBySeat),
    bonusPointsBySeat: Object.fromEntries(
      Object.keys(fresh.pursesBySeat).map((k) => [Number(k), 0]),
    ) as Record<number, number>,
    day: 1,
    stackMovementBySeat: emptyStackMovementForSeatRecord(fresh.pursesBySeat),
    recruitUsedThisDay: new Set<string>(),
  });
  useEffect(() => {
    dayRef.current = day;
  }, [day]);
  useEffect(() => {
    mySeatRef.current = mySeat;
  }, [mySeat]);

  useLayoutEffect(() => {
    undoCaptureRef.current = {
      map,
      stacks,
      recruitQueues,
      revealedBySeat: cloneSeatKeyedSets(revealedBySeat),
      scoutedTodayBySeat: cloneSeatKeyedSets(scoutedTodayBySeat),
      pursesBySeat: clonePursesLoose(playerPurses),
      bonusPointsBySeat: { ...bonusPointsBySeat },
      day,
      stackMovementBySeat: cloneSeatKeyedMovement(stackMovementBySeat),
      recruitUsedThisDay: new Set(recruitUsedThisDay),
    };
  }, [
    map,
    stacks,
    recruitQueues,
    revealedBySeat,
    scoutedTodayBySeat,
    playerPurses,
    bonusPointsBySeat,
    day,
    stackMovementBySeat,
    recruitUsedThisDay,
  ]);

  const [dailyReport, setDailyReport] = useState<PondsteadDailyReport | null>(null);
  const [victoryModalDismissed, setVictoryModalDismissed] = useState(false);

  const pushUndoSnapshot = useCallback(() => {
    const c = undoCaptureRef.current;
    const snap = capturePondsteadUndoSnapshot({
      map: c.map,
      stacks: c.stacks,
      recruitQueues: c.recruitQueues,
      revealedBySeat: c.revealedBySeat,
      scoutedTodayBySeat: c.scoutedTodayBySeat,
      pursesBySeat: c.pursesBySeat,
      bonusPointsBySeat: c.bonusPointsBySeat,
      day: c.day,
      stackMovementBySeat: c.stackMovementBySeat,
      recruitUsedThisDayKeys: c.recruitUsedThisDay,
    });
    const next = [...undoStackRef.current, snap];
    if (next.length > PONDSTEAD_UNDO_MAX_DEPTH) next.splice(0, next.length - PONDSTEAD_UNDO_MAX_DEPTH);
    undoStackRef.current = next;
    bumpUndoUi();
    if (pondsteadServerSyncEnabled(resolvedCampaignId)) {
      pendingServerPatchRef.current = true;
    }
  }, [bumpUndoUi, resolvedCampaignId]);

  const handleUndo = useCallback(() => {
    if (pondsteadServerSyncEnabled(resolvedCampaignId)) {
      void (async () => {
        try {
          const token = await getApiAccessToken();
          const out = await persistPondsteadServerUndo({
            accessToken: token,
            expectedRevision: serverRevisionRef.current,
            campaignId: resolvedCampaignId,
          });
          if (!out) return;
          serverRevisionRef.current = out.revision;
          const hw = hydrateWorldFromServerSnapshot(out.world);
          setMap(hw.map);
          setStacks(hw.stacks);
          setRecruitQueues(hw.recruitQueues);
          setPlayerPurses(hw.pursesBySeat);
          setBonusPointsBySeat(hw.bonusPointsBySeat);
          setRevealedBySeat(hw.revealedBySeat);
          setScoutedTodayBySeat(hw.scoutedTodayBySeat);
          if (hw.stackMovementBySeat) setStackMovementBySeat(hw.stackMovementBySeat);
          if (hw.recruitUsedThisDay) setRecruitUsedThisDay(hw.recruitUsedThisDay);
          if (typeof hw.day === "number") setDay(hw.day);
          else if (typeof out.current_day === "number") setDay(out.current_day);
          const seat = mySeatRef.current;
          undoStackRef.current = (out.undo_stacks_by_seat[String(seat)] ?? []) as PondsteadUndoSnapshot[];
          bumpUndoUi();
        } catch (e) {
          console.error(e);
        }
      })();
      return;
    }
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const snap = stack[stack.length - 1]!;
    undoStackRef.current = stack.slice(0, -1);
    const r = rehydratePondsteadUndoSnapshot(snap);
    setMap(r.map);
    setStacks(r.stacks);
    setRecruitQueues(r.recruitQueues);
    setRevealedBySeat(r.revealedBySeat);
    setScoutedTodayBySeat(r.scoutedTodayBySeat);
    setPlayerPurses(r.pursesBySeat);
    setBonusPointsBySeat(r.bonusPointsBySeat);
    setDay(r.day);
    setStackMovementBySeat(r.stackMovementBySeat);
    setRecruitUsedThisDay(r.recruitUsedThisDayKeys);
    bumpUndoUi();
  }, [bumpUndoUi, resolvedCampaignId, getApiAccessToken]);

  useEffect(() => {
    if (!pondsteadServerSyncEnabled(resolvedCampaignId)) return;
    const gid = resolvedCampaignId;
    if (!gid) return;
    const uid = sessionUser?.user.id;
    if (uid == null) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getApiAccessToken();
        const j = await fetchPondsteadGameBootstrap(token, Number(gid));
        if (cancelled) return;
        serverRevisionRef.current = j.revision;
        const hw = hydrateWorldFromServerSnapshot(j.world, {
          maxSeats: Math.max(2, j.players?.length ?? 2),
        });
        setMap(hw.map);
        setStacks(hw.stacks);
        setRecruitQueues(hw.recruitQueues);
        setPlayerPurses(hw.pursesBySeat);
        setBonusPointsBySeat(hw.bonusPointsBySeat);
        setRevealedBySeat(hw.revealedBySeat);
        setScoutedTodayBySeat(hw.scoutedTodayBySeat);
        if (hw.stackMovementBySeat) setStackMovementBySeat(hw.stackMovementBySeat);
        if (hw.recruitUsedThisDay) setRecruitUsedThisDay(hw.recruitUsedThisDay);
        setDay(hw.day ?? j.current_day);
        const mine = j.players.find((p) => p.user_id === uid);
        const seat =
          typeof j.my_seat_index === "number"
            ? j.my_seat_index
            : mine != null
              ? mine.seat_index
              : 0;
        setMySeat(seat);
        undoStackRef.current = (j.undo_stacks_by_seat[String(seat)] ?? []) as PondsteadUndoSnapshot[];
        bumpUndoUi();
        if (j.calendar_auto_new_day) {
          const rep = j.calendar_daily_reports_by_seat?.[String(seat)];
          if (rep) setDailyReport(rep);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionUser, resolvedCampaignId, bumpUndoUi, getApiAccessToken]);

  useLayoutEffect(() => {
    if (!pendingServerPatchRef.current || !pondsteadServerSyncEnabled(resolvedCampaignId)) return;
    pendingServerPatchRef.current = false;
    const c = undoCaptureRef.current;
    const world = serializeWorldForServer({
      map: c.map,
      stacks: c.stacks,
      recruitQueues: c.recruitQueues,
      pursesBySeat: c.pursesBySeat,
      bonusPointsBySeat: c.bonusPointsBySeat,
      revealedBySeat: c.revealedBySeat,
      scoutedTodayBySeat: c.scoutedTodayBySeat,
      stackMovementBySeat: c.stackMovementBySeat,
      recruitUsedThisDay: c.recruitUsedThisDay,
      day: c.day,
    });
    const mine = undoStackRef.current.map((s) => structuredClone(s));
    const undoStacksBySeat: Record<string, unknown[]> = { [String(mySeat)]: mine as unknown[] };
    void (async () => {
      try {
        const token = await getApiAccessToken();
        const rev = await persistPondsteadPatchWorld({
          accessToken: token,
          world,
          undoStacksBySeat,
          expectedRevision: serverRevisionRef.current,
          campaignId: resolvedCampaignId,
        });
        if (rev != null) serverRevisionRef.current = rev;
      } catch (e) {
        console.error(e);
      }
    })();
  }, [
    getApiAccessToken,
    map,
    stacks,
    recruitQueues,
    revealedBySeat,
    scoutedTodayBySeat,
    playerPurses,
    bonusPointsBySeat,
    day,
    stackMovementBySeat,
    recruitUsedThisDay,
    resolvedCampaignId,
    mySeat,
  ]);

  const revealedCellKeys = revealedBySeat[mySeat] ?? new Set();
  const stackMovementUsed = stackMovementBySeat[mySeat] ?? {};

  const flashMapPointerHint = useCallback((kind: "march") => {
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

  const foodPerDay = useMemo(
    () => foodPerDayFromOrchardsForOwner(stacks, map, mySeat),
    [map, stacks, mySeat],
  );
  const woodPerDay = useMemo(
    () => woodPerDayFromCampsForOwner(stacks, map, mySeat),
    [map, stacks, mySeat],
  );
  const stonePerDay = useMemo(
    () => stonePerDayFromQuarriesForOwner(stacks, map, mySeat),
    [map, stacks, mySeat],
  );
  const totalPopulation = useMemo(
    () => totalPopulationTowardCapForOwner(stacks, map, recruitQueues, mySeat),
    [stacks, map, recruitQueues, mySeat],
  );
  const populationCap = useMemo(() => populationCapForOwner(map, mySeat), [map, mySeat]);
  const points = useMemo(
    () => pointsFromMapForOwner(map, mySeat) + (bonusPointsBySeat[mySeat] ?? 0),
    [map, mySeat, bonusPointsBySeat],
  );
  const gameWon = points >= PONDSTEAD_VICTORY_POINTS;

  useEffect(() => {
    if (points < PONDSTEAD_VICTORY_POINTS) setVictoryModalDismissed(false);
  }, [points]);
  const hudQueuedRecruits = useMemo(
    () => listQueuedRecruitsForHud(map, recruitQueues, mySeat),
    [map, recruitQueues, mySeat],
  );
  const hudLocalConstructions = useMemo(
    () => listLocalConstructionsForHud(map, mySeat),
    [map, mySeat],
  );
  const currentFood = playerPurses[mySeat]?.food ?? PONDSTEAD_STARTING_RESOURCES.food;
  const currentWood = playerPurses[mySeat]?.wood ?? PONDSTEAD_STARTING_RESOURCES.wood;
  const currentStone = playerPurses[mySeat]?.stone ?? PONDSTEAD_STARTING_RESOURCES.stone;
  const playerResources: ResourcePurse = useMemo(
    () => ({ food: currentFood, wood: currentWood, stone: currentStone }),
    [currentFood, currentWood, currentStone],
  );

  const seatKeysForPurses = useMemo(
    () =>
      Object.keys(playerPurses)
        .map(Number)
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b),
    [playerPurses],
  );

  const liveVisibleBySeat = useMemo(() => {
    const out: Record<number, Set<string>> = {};
    for (const s of seatKeysForPurses) {
      out[s] = computeVisibleCellKeys(map, stacks, s);
    }
    return out;
  }, [map, stacks, seatKeysForPurses]);

  const liveVisibleCellKeys = liveVisibleBySeat[mySeat] ?? new Set();

  useEffect(() => {
    setScoutedTodayBySeat((prev) => {
      const next: Record<number, Set<string>> = {};
      for (const s of seatKeysForPurses) {
        next[s] = mergeVisibleIntoRevealed(liveVisibleBySeat[s]!, prev[s] ?? new Set());
      }
      return next;
    });
  }, [liveVisibleBySeat, seatKeysForPurses]);

  useLayoutEffect(() => {
    endDaySyncRef.current = {
      map,
      stacks,
      recruitQueues,
      revealedBySeat: cloneSeatKeyedSets(revealedBySeat),
      scoutedTodayBySeat: cloneSeatKeyedSets(scoutedTodayBySeat),
      pursesBySeat: clonePursesLoose(playerPurses),
      bonusPointsBySeat: { ...bonusPointsBySeat },
    };
  }, [map, stacks, recruitQueues, revealedBySeat, scoutedTodayBySeat, playerPurses, bonusPointsBySeat]);

  const handleEndDayOrResume = useCallback(() => {
    if (gameWon) return;
    setAwaitingNewDayConfirm((v) => !v);
  }, [gameWon]);

  const handleCommitNewDay = useCallback(() => {
    if (gameWon) return;
    if (pondsteadServerSyncEnabled(resolvedCampaignId)) return;
    undoStackRef.current = [];
    bumpUndoUi();
    const sync = endDaySyncRef.current;
    const playerName =
      sessionUser?.profile.display_name?.trim() || sessionUser?.user.username || "Player";
    const out = runPondsteadCommitNewDayPipeline({
      sync: {
        map: sync.map,
        stacks: sync.stacks,
        recruitQueues: sync.recruitQueues,
        pursesBySeat: sync.pursesBySeat,
        revealedBySeat: sync.revealedBySeat,
        scoutedTodayBySeat: sync.scoutedTodayBySeat,
        bonusPointsBySeat: sync.bonusPointsBySeat,
      },
      currentDay: dayRef.current,
      incomeReportSeat: mySeatRef.current,
      playerName,
      rng: Math.random,
    });
    setMap(out.map);
    setStacks(out.stacks);
    setRecruitQueues(out.recruitQueues);
    setPlayerPurses(out.pursesBySeat);
    setBonusPointsBySeat(out.bonusPointsBySeat);
    setDailyReport(out.dailyReport);
    const sk = Object.keys(out.pursesBySeat)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    setStackMovementBySeat(Object.fromEntries(sk.map((s) => [s, {}])) as Record<number, Record<string, number>>);
    setRecruitUsedThisDay(new Set());
    setRevealedBySeat(out.revealedBySeat);
    setScoutedTodayBySeat(
      Object.fromEntries(sk.map((s) => [s, new Set<string>()])) as Record<number, Set<string>>,
    );
    setDay(out.nextDay);
    setAwaitingNewDayConfirm(false);
  }, [sessionUser, gameWon, bumpUndoUi, resolvedCampaignId]);

  const onPlaceBuilding = useCallback(
    (row: number, col: number, unitKind: PondsteadUnitKind, target: BuildingKind): PlaceBuildResult => {
      if (gameWon) return { ok: false, reason: "invalid" };
      if (awaitingNewDayConfirm) return { ok: false, reason: "invalid" };
      const cost = getBuildCostForTarget(map, target);
      if (!cost) return { ok: false, reason: "invalid" };
      const builders = stacksOnCell(stacks, row, col)
        .filter((s) => s.kind === unitKind)
        .sort((a, b) => a.id.localeCompare(b.id));
      const constructionOwnerId = builders[0]?.ownerId ?? PONDSTEAD_LOCAL_PLAYER_ID;
      if (constructionOwnerId !== mySeat) return { ok: false, reason: "invalid" };
      const purse = playerPurses[constructionOwnerId] ?? PONDSTEAD_STARTING_RESOURCES;
      if (!canAfford(purse, cost)) return { ok: false, reason: "insufficient" };
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
      const after = applyCost(purse, cost);
      pushUndoSnapshot();
      setMap(nextMap);
      setStacks(nextStacks);
      setPlayerPurses((prev) => ({ ...prev, [constructionOwnerId]: after }));
      return { ok: true };
    },
    [awaitingNewDayConfirm, gameWon, map, stacks, mySeat, playerPurses, pushUndoSnapshot],
  );

  const handleMarch = useCallback(
    (stackId: string, toRow: number, toCol: number) => {
      if (gameWon) return;
      if (awaitingNewDayConfirm) return;
      const dragged = stacks.find((s) => s.id === stackId);
      if (!dragged) return;
      const moverOwnerId = dragged.ownerId ?? PONDSTEAD_LOCAL_PLAYER_ID;
      if (moverOwnerId !== mySeat) return;
      const moverRevealed = revealedBySeat[moverOwnerId] ?? new Set<string>();
      const marchCap = kingMarchCapFromMap(map, moverOwnerId);
      const outcome = classifyStackDragEnd(
        stacks,
        stackId,
        toRow,
        toCol,
        map,
        moverRevealed,
        stackMovementBySeat[moverOwnerId] ?? {},
        marchCap,
      );
      if (outcome === "invalid" || outcome === "noop") return;
      if (outcome === "out_of_march") {
        flashMapPointerHint("march");
        return;
      }
      const stepCost =
        marchAdjacentStepCostOrNull(
          map,
          dragged.row,
          dragged.col,
          toRow,
          toCol,
          moverRevealed,
          moverOwnerId,
        ) ?? 0;
      const next = applyStackDragEnd(
        stacks,
        stackId,
        toRow,
        toCol,
        map,
        moverRevealed,
        stackMovementBySeat[moverOwnerId] ?? {},
        marchCap,
      );
      if (!next) return;
      pushUndoSnapshot();
      setStacks(next);
      const updateUsed = (fn: (prev: Record<string, number>) => Record<string, number>) => {
        setStackMovementBySeat((all) => ({
          ...all,
          [moverOwnerId]: fn(all[moverOwnerId] ?? {}),
        }));
      };
      if (outcome === "move") {
        updateUsed((prev) => ({
          ...prev,
          [stackId]: (prev[stackId] ?? 0) + stepCost,
        }));
      } else if (outcome === "merge") {
        const keepId = mergeSurvivorStackId(stacks, stackId, toRow, toCol);
        if (keepId != null) {
          updateUsed((prev) => {
            const uKeep = prev[keepId] ?? 0;
            const uDrag = prev[stackId] ?? 0;
            const nextUsed = { ...prev };
            delete nextUsed[stackId];
            nextUsed[keepId] = Math.max(uKeep, uDrag + stepCost);
            return nextUsed;
          });
        }
      } else if (outcome === "merge_same_cell") {
        const keepId = mergeSurvivorStackId(stacks, stackId, toRow, toCol);
        if (keepId != null) {
          updateUsed((prev) => {
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
      awaitingNewDayConfirm,
      gameWon,
      flashMapPointerHint,
      map,
      mySeat,
      pushUndoSnapshot,
      revealedBySeat,
      stackMovementBySeat,
      stacks,
    ],
  );

  const onSplit = useCallback(
    (stackId: string, splitCount: number) => {
      if (gameWon) return;
      if (awaitingNewDayConfirm) return;
      const splitOwner = stacks.find((s) => s.id === stackId)?.ownerId ?? PONDSTEAD_LOCAL_PLAYER_ID;
      if (splitOwner !== mySeat) return;
      const beforeIds = new Set(stacks.map((s) => s.id));
      const next = applyStackSplit(stacks, stackId, splitCount);
      if (!next) return;
      const newStack = next.find((s) => !beforeIds.has(s.id));
      pushUndoSnapshot();
      setStacks(next);
      if (newStack) {
        const owner = splitOwner;
        setStackMovementBySeat((all) => {
          const prev = all[owner] ?? {};
          const u = prev[stackId] ?? 0;
          if (prev[newStack.id] === u) return all;
          return { ...all, [owner]: { ...prev, [newStack.id]: u } };
        });
      }
    },
    [awaitingNewDayConfirm, gameWon, mySeat, pushUndoSnapshot, stacks],
  );

  const onRecruit = useCallback(
    (row: number, col: number, kind: PondsteadUnitKind): RecruitAttemptResult => {
      if (gameWon) return "locked";
      if (awaitingNewDayConfirm) return "locked";
      const key = pondsteadCellKey(row, col);
      if (recruitQueues[key] !== undefined) return "recruit_pending";
      const workerDailyKey = `${key}:worker`;
      if (kind === "worker" && recruitUsedThisDay.has(workerDailyKey)) return "already_recruited_today";

      const cellAt = map.cells[row]![col]!;
      const buildingOwner = mapCellBuildingOwner(cellAt);
      if (buildingOwner !== mySeat) return "locked";
      const purse = playerPurses[buildingOwner] ?? PONDSTEAD_STARTING_RESOURCES;
      const popCap = populationCapForOwner(map, buildingOwner);

      if (totalPopulationTowardCapForOwner(stacks, map, recruitQueues, buildingOwner) >= popCap) {
        return "population";
      }
      if (totalKindCountOnCell(stacks, row, col, kind) >= PONDSTEAD_MAX_PER_KIND_ON_TILE) {
        return "tile";
      }
      const cost = getRecruitCostForNextUnit(stacks, kind, recruitQueues, map);
      if (!canAfford(purse, cost)) return "insufficient";

      const bk = cellAt.building;
      const instantWorker =
        kind === "worker" &&
        bk !== "none" &&
        buildingAllowsRecruitWorker(bk as Exclude<BuildingKind, "none">) &&
        hasCompletedMausoleumForOwner(map, buildingOwner) &&
        !recruitUsedThisDay.has(workerDailyKey);

      if (instantWorker) {
        const after = applyCost(purse, cost);
        const applied = applyRecruit(stacks, row, col, kind, popCap, buildingOwner);
        if (!applied) return "population";
        pushUndoSnapshot();
        setStacks(applied);
        setPlayerPurses((prev) => ({ ...prev, [buildingOwner]: after }));
        setRecruitUsedThisDay((prev) => {
          const next = new Set(prev);
          next.add(workerDailyKey);
          return next;
        });
        return "ok";
      }

      const after = applyCost(purse, cost);
      pushUndoSnapshot();
      setRecruitQueues((q) => ({ ...q, [key]: kind }));
      setPlayerPurses((prev) => ({ ...prev, [buildingOwner]: after }));
      return "ok";
    },
    [
      awaitingNewDayConfirm,
      gameWon,
      map,
      mySeat,
      playerPurses,
      pushUndoSnapshot,
      recruitQueues,
      recruitUsedThisDay,
      stacks,
    ],
  );

  useEffect(() => {
    setPinchScale(1);
  }, [viewMode]);

  useLayoutEffect(() => {
    didInitialHqScroll.current = false;
  }, [mySeat]);

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
  }, [cellSizePx, hq, map.height, map.width, viewportRef, mySeat]);

  return (
    <Stack flex="1" minH="0" minW={0} w="100%" gap="0" align="stretch" position="relative">
      {resolvedCampaignId ? (
        <Box px={{ base: "2", md: "3" }} py="1" borderBottomWidth="1px" borderColor="border" bg="bg.subtle">
          <Text fontSize="xs" color="fg.muted">
            <Link asChild variant="underline" color="fg.muted">
              <RouterLink to={`/pondstead/campaign/${resolvedCampaignId}`}>Campaign lobby</RouterLink>
            </Link>
            {" · "}
            <Link asChild variant="underline" color="fg.muted">
              <RouterLink to="/pondstead/campaigns">All campaigns</RouterLink>
            </Link>
          </Text>
        </Box>
      ) : null}
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
        showLegacyDayControls={
          !(resolvedCampaignId != null && pondsteadServerSyncEnabled(resolvedCampaignId))
        }
        awaitingNewDayConfirm={awaitingNewDayConfirm}
        onEndDayOrResume={handleEndDayOrResume}
        onStartNewDay={handleCommitNewDay}
        onUndo={handleUndo}
        canUndo={canUndo}
        undoCount={undoStackLen}
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
                {stackOutOfMarchMessage()}
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
              <PondsteadMapGrid
                map={map}
                cellSizePx={cellSizePx}
                stacks={stacks}
                recruitQueues={recruitQueues}
                playerResources={playerResources}
                recruitUsedWorkerSlotKeys={recruitUsedThisDay}
                stackMovementUsed={stackMovementUsed}
                revealedCellKeys={revealedCellKeys}
                visibleCellKeys={liveVisibleCellKeys}
                viewerPlayerId={mySeat}
                interactionLocked={awaitingNewDayConfirm || gameWon}
                onSplit={onSplit}
                onRecruit={onRecruit}
                onPlaceBuilding={onPlaceBuilding}
                onMarch={handleMarch}
              />
            ) : null}
          </Box>
        </Box>
      </Box>
    </Stack>
  );
}
