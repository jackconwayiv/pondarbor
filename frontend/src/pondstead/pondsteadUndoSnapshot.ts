import type { PendingRecruits } from "./pondsteadDay";
import type { UnitStack } from "./pondsteadUnits";
import type { ParsedMap } from "./types";

export const PONDSTEAD_UNDO_MAX_DEPTH = 32;

/**
 * A single point in time the player can return to. Every field is required so undo cannot
 * partially rewind (which would re-open fog-of-war exploits around {@link mergeVisibleIntoRevealed}).
 * Older snapshots may omit `scoutedTodayCellKeys`; treat as empty.
 */
export type PondsteadUndoSnapshot = {
  map: ParsedMap;
  stacks: UnitStack[];
  recruitQueues: PendingRecruits;
  /** Serialized set for cloning */
  revealedCellKeys: string[];
  /** Cells unioned from LOS during the current day (before end-day commit into `revealedCellKeys`). */
  scoutedTodayCellKeys?: string[];
  currentFood: number;
  currentWood: number;
  currentStone: number;
  day: number;
  /** Chebyshev squares this stack has marched today (id → used, max 3 per id). */
  stackMovementUsed?: Record<string, number>;
  /** Building tiles that already used their one instant worker recruit today (Mausoleum). */
  recruitUsedThisDayKeys?: string[];
};

export function capturePondsteadUndoSnapshot(args: {
  map: ParsedMap;
  stacks: UnitStack[];
  recruitQueues: PendingRecruits;
  revealedCellKeys: Set<string>;
  scoutedTodayCellKeys: Set<string>;
  currentFood: number;
  currentWood: number;
  currentStone: number;
  day: number;
  stackMovementUsed: Readonly<Record<string, number>>;
  recruitUsedThisDayKeys: ReadonlySet<string>;
}): PondsteadUndoSnapshot {
  return {
    map: structuredClone(args.map),
    stacks: structuredClone(args.stacks),
    recruitQueues: { ...args.recruitQueues },
    revealedCellKeys: Array.from(args.revealedCellKeys).sort(),
    scoutedTodayCellKeys: Array.from(args.scoutedTodayCellKeys).sort(),
    currentFood: args.currentFood,
    currentWood: args.currentWood,
    currentStone: args.currentStone,
    day: args.day,
    stackMovementUsed: { ...args.stackMovementUsed },
    recruitUsedThisDayKeys: Array.from(args.recruitUsedThisDayKeys).sort(),
  };
}

/**
 * Rehydrate snapshot for React state. Returns a new `Set` for revealed keys; map/stacks are
 * the cloned copies from the snapshot (already deep-cloned in {@link capturePondsteadUndoSnapshot}).
 */
export function rehydratePondsteadUndoSnapshot(s: PondsteadUndoSnapshot) {
  return {
    map: s.map,
    stacks: s.stacks,
    recruitQueues: { ...s.recruitQueues },
    revealedCellKeys: new Set(s.revealedCellKeys),
    scoutedTodayCellKeys: new Set(s.scoutedTodayCellKeys ?? []),
    currentFood: s.currentFood,
    currentWood: s.currentWood,
    currentStone: s.currentStone,
    day: s.day,
    stackMovementUsed: { ...(s.stackMovementUsed ?? {}) },
    recruitUsedThisDayKeys: new Set(s.recruitUsedThisDayKeys ?? []),
  };
}
