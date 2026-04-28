import type { PendingRecruits } from "./pondsteadDay";
import type { ResourcePurse } from "./pondsteadBuildingCosts";
import type { UnitStack } from "./pondsteadUnits";
import type { ParsedMap } from "./types";

export const PONDSTEAD_UNDO_MAX_DEPTH = 32;

function sortRecordKeys<T>(obj: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const k of Object.keys(obj).sort()) {
    out[k] = obj[k]!;
  }
  return out;
}

/**
 * A single point in time the player can return to. Every field is required so undo cannot
 * partially rewind (which would re-open fog-of-war exploits around {@link mergeVisibleIntoRevealed}).
 */
export type PondsteadUndoSnapshot = {
  map: ParsedMap;
  stacks: UnitStack[];
  recruitQueues: PendingRecruits;
  /** Per-seat revealed keys (`"0"`, `"1"`, …). */
  revealedBySeat: Record<string, string[]>;
  /** Per-seat LOS union for the current day (before end-day merge). */
  scoutedTodayBySeat: Record<string, string[]>;
  pursesBySeat: Record<string, ResourcePurse>;
  bonusPointsBySeat: Record<string, number>;
  day: number;
  /** Per-seat march usage (stack id → points used). */
  stackMovementBySeat: Record<string, Record<string, number>>;
  recruitUsedThisDayKeys: string[];
};

export function capturePondsteadUndoSnapshot(args: {
  map: ParsedMap;
  stacks: UnitStack[];
  recruitQueues: PendingRecruits;
  revealedBySeat: Record<number, Set<string>>;
  scoutedTodayBySeat: Record<number, Set<string>>;
  pursesBySeat: Record<number, ResourcePurse>;
  bonusPointsBySeat: Record<number, number>;
  day: number;
  stackMovementBySeat: Record<number, Record<string, number>>;
  recruitUsedThisDayKeys: ReadonlySet<string>;
}): PondsteadUndoSnapshot {
  const seatKeys = (sets: Record<number, Set<string>>): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(sets)) {
      out[String(k)] = Array.from(v).sort();
    }
    return sortRecordKeys(out);
  };
  const purses: Record<string, ResourcePurse> = {};
  for (const [k, v] of Object.entries(args.pursesBySeat)) {
    purses[String(k)] = { ...v };
  }
  const bonus: Record<string, number> = {};
  for (const [k, v] of Object.entries(args.bonusPointsBySeat)) {
    bonus[String(k)] = v;
  }
  const movement: Record<string, Record<string, number>> = {};
  for (const [seat, used] of Object.entries(args.stackMovementBySeat)) {
    movement[String(seat)] = { ...used };
  }
  return {
    map: structuredClone(args.map),
    stacks: structuredClone(args.stacks),
    recruitQueues: { ...args.recruitQueues },
    revealedBySeat: seatKeys(args.revealedBySeat),
    scoutedTodayBySeat: seatKeys(args.scoutedTodayBySeat),
    pursesBySeat: sortRecordKeys(purses),
    bonusPointsBySeat: sortRecordKeys(bonus),
    day: args.day,
    stackMovementBySeat: sortRecordKeys(movement),
    recruitUsedThisDayKeys: Array.from(args.recruitUsedThisDayKeys).sort(),
  };
}

function setsFromSeatRecord(r: Record<string, string[]>): Record<number, Set<string>> {
  const out: Record<number, Set<string>> = {};
  for (const [k, arr] of Object.entries(r)) {
    out[Number(k)] = new Set(arr);
  }
  return out;
}

function numRecordFromString(r: Record<string, number>): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(r)) {
    out[Number(k)] = v;
  }
  return out;
}

function pursesFromString(r: Record<string, ResourcePurse>): Record<number, ResourcePurse> {
  const out: Record<number, ResourcePurse> = {};
  for (const [k, v] of Object.entries(r)) {
    out[Number(k)] = { ...v };
  }
  return out;
}

function movementFromString(r: Record<string, Record<string, number>>): Record<number, Record<string, number>> {
  const out: Record<number, Record<string, number>> = {};
  for (const [k, v] of Object.entries(r)) {
    out[Number(k)] = { ...v };
  }
  return out;
}

export function rehydratePondsteadUndoSnapshot(s: PondsteadUndoSnapshot) {
  return {
    map: s.map,
    stacks: s.stacks,
    recruitQueues: { ...s.recruitQueues },
    revealedBySeat: setsFromSeatRecord(s.revealedBySeat),
    scoutedTodayBySeat: setsFromSeatRecord(s.scoutedTodayBySeat),
    pursesBySeat: pursesFromString(s.pursesBySeat),
    bonusPointsBySeat: numRecordFromString(s.bonusPointsBySeat),
    day: s.day,
    stackMovementBySeat: movementFromString(s.stackMovementBySeat),
    recruitUsedThisDayKeys: new Set(s.recruitUsedThisDayKeys),
  };
}
