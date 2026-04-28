import { buildingLabel } from "./terrain";
import type { PondsteadDailyReport } from "./PondsteadDailyReportModal";
import { resolveDayStartCombat, type CombatRng } from "./pondsteadCombat";
import {
  advanceConstructionsAndReleaseBorrowedUnits,
  processPendingRecruitsAtDayStart,
  type PendingRecruits,
} from "./pondsteadDay";
import {
  foodPerDayFromOrchardsForOwner,
  pointsFromMapForOwner,
  stonePerDayFromQuarriesForOwner,
  woodPerDayFromCampsForOwner,
} from "./pondsteadHudMetrics";
import {
  computeVisibleCellKeys,
  mergeVisibleIntoRevealed,
} from "./pondsteadVision";
import { unitKindLabel } from "./pondsteadUnits";
import type { ResourcePurse } from "./pondsteadBuildingCosts";
import type { BuildingKind, ParsedMap } from "./types";
import type { UnitStack } from "./pondsteadUnits";

function seatsFromNewDaySync(sync: PondsteadNewDaySync): readonly number[] {
  const ids = new Set<number>();
  for (const k of Object.keys(sync.pursesBySeat)) ids.add(Number(k));
  for (const k of Object.keys(sync.revealedBySeat ?? {})) ids.add(Number(k));
  for (const k of Object.keys(sync.scoutedTodayBySeat ?? {})) ids.add(Number(k));
  for (const k of Object.keys(sync.bonusPointsBySeat ?? {})) ids.add(Number(k));
  const arr = Array.from(ids)
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);
  return arr.length > 0 ? arr : [0, 1];
}

export type PondsteadNewDaySync = {
  map: ParsedMap;
  stacks: UnitStack[];
  recruitQueues: PendingRecruits;
  pursesBySeat: Record<number, ResourcePurse>;
  revealedBySeat: Record<number, Set<string>>;
  scoutedTodayBySeat: Record<number, Set<string>>;
  bonusPointsBySeat: Record<number, number>;
};

export type PondsteadNewDayPipelineResult = {
  map: ParsedMap;
  stacks: UnitStack[];
  recruitQueues: PendingRecruits;
  pursesBySeat: Record<number, ResourcePurse>;
  bonusPointsBySeat: Record<number, number>;
  revealedBySeat: Record<number, Set<string>>;
  nextDay: number;
  /** @deprecated Prefer dailyReportsBySeat; same as entry for incomeReportSeat. */
  dailyReport: PondsteadDailyReport;
  /** JSON-friendly keys "0","1",… for server logs. */
  dailyReportsBySeat: Record<string, PondsteadDailyReport>;
};

/**
 * Pure calendar advance: combat → constructions → recruits → income → fog merge.
 * Used by the map page and optionally by a Node helper for the Django bridge.
 */
export function runPondsteadCommitNewDayPipeline(args: {
  sync: PondsteadNewDaySync;
  currentDay: number;
  /** Seat whose income lines appear in the daily report (the local human). */
  incomeReportSeat: number;
  playerName: string;
  /** Optional display names per seat for multi-report logs (defaults West/East). */
  playerNamesBySeat?: Record<number, string>;
  rng: CombatRng;
}): PondsteadNewDayPipelineResult {
  const { sync, currentDay, incomeReportSeat, playerName, playerNamesBySeat, rng } = args;
  const seats = seatsFromNewDaySync(sync);

  const names: Record<number, string> = {};
  const defaultLabel = (s: number) => (s % 2 === 0 ? "West" : "East");
  for (const s of seats) {
    names[s] = playerNamesBySeat?.[s] ?? defaultLabel(s);
  }

  const combat = resolveDayStartCombat(sync.map, sync.stacks, rng);
  const m0 = combat.map;
  const s0 = combat.stacks;
  const q0 = sync.recruitQueues;

  const nextRevealed: Record<number, Set<string>> = {};
  for (const seat of seats) {
    const liveAtEnd = computeVisibleCellKeys(m0, s0, seat);
    const scoutUnion = mergeVisibleIntoRevealed(liveAtEnd, sync.scoutedTodayBySeat[seat] ?? new Set());
    nextRevealed[seat] = mergeVisibleIntoRevealed(scoutUnion, sync.revealedBySeat[seat] ?? new Set());
  }

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

  const nextDay = currentDay + 1;

  const nextBonus: Record<number, number> = { ...sync.bonusPointsBySeat };
  for (const [k, v] of Object.entries(combat.pointsAwarded)) {
    const id = Number(k);
    nextBonus[id] = (nextBonus[id] ?? 0) + v;
  }

  const nextPurses: Record<number, ResourcePurse> = {};
  for (const seat of seats) {
    nextPurses[seat] = { ...(sync.pursesBySeat[seat] ?? { food: 0, wood: 0, stone: 0 }) };
  }

  for (const seat of seats) {
    const f = foodPerDayFromOrchardsForOwner(s1, m1, seat);
    const w = woodPerDayFromCampsForOwner(s1, m1, seat);
    const st = stonePerDayFromQuarriesForOwner(s1, m1, seat);
    nextPurses[seat] = {
      food: nextPurses[seat]!.food + f,
      wood: nextPurses[seat]!.wood + w,
      stone: nextPurses[seat]!.stone + st,
    };
  }

  const dailyReportsBySeat: Record<string, PondsteadDailyReport> = {};
  for (const seat of seats) {
    const fg = foodPerDayFromOrchardsForOwner(s1, m1, seat);
    const wg = woodPerDayFromCampsForOwner(s1, m1, seat);
    const sg = stonePerDayFromQuarriesForOwner(s1, m1, seat);
    const scoreboard = seats.map((ssi) => ({
      seatIndex: ssi,
      displayName: names[ssi] ?? `Seat ${ssi}`,
      points: pointsFromMapForOwner(m1, ssi) + (nextBonus[ssi] ?? 0),
    }));
    dailyReportsBySeat[String(seat)] = {
      welcomeDay: nextDay,
      playerName: names[seat] ?? `Seat ${seat}`,
      viewerSeat: seat,
      foodGained: fg,
      woodGained: wg,
      stoneGained: sg,
      recruits,
      completedBuildings: completed.map((c) => ({ label: c.label })),
      stillBuilding: stillBuilding.map((s) => ({ label: s.label, nightsLeft: s.nightsLeft })),
      combatLines: combat.combatLines,
      globalHeadlines: combat.combatLines,
      scoreboard,
    };
  }

  const dailyReport: PondsteadDailyReport = {
    ...dailyReportsBySeat[String(incomeReportSeat)]!,
    playerName,
    viewerSeat: incomeReportSeat,
  };

  return {
    map: m1,
    stacks: s1,
    recruitQueues: q1,
    pursesBySeat: nextPurses,
    bonusPointsBySeat: nextBonus,
    revealedBySeat: nextRevealed,
    nextDay,
    dailyReport,
    dailyReportsBySeat,
  };
}
