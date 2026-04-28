import type { ResourcePurse } from "./pondsteadBuildingCosts";
import type { PendingRecruits } from "./pondsteadDay";
import type { ParsedMap } from "./types";
import type { UnitStack } from "./pondsteadUnits";
import { seatIndicesFromOptionalRecord } from "./pondsteadSeatKeyed";
import type { PondsteadServerWorldSnapshot } from "./pondsteadServerSync";

export type HydratedWorldState = {
  map: ParsedMap;
  stacks: UnitStack[];
  recruitQueues: PendingRecruits;
  pursesBySeat: Record<number, ResourcePurse>;
  bonusPointsBySeat: Record<number, number>;
  revealedBySeat: Record<number, Set<string>>;
  scoutedTodayBySeat: Record<number, Set<string>>;
  stackMovementBySeat?: Record<number, Record<string, number>>;
  recruitUsedThisDay?: Set<string>;
  day?: number;
};

export function hydrateWorldFromServerSnapshot(
  w: PondsteadServerWorldSnapshot,
  options?: { maxSeats?: number },
): HydratedWorldState {
  const seats = seatIndicesFromOptionalRecord(w.pursesBySeat ?? w.bonusPointsBySeat, options?.maxSeats);

  const pursesBySeat: Record<number, ResourcePurse> = {};
  const bonusPointsBySeat: Record<number, number> = {};
  const revealedBySeat: Record<number, Set<string>> = {};
  const scoutedTodayBySeat: Record<number, Set<string>> = {};

  for (const s of seats) {
    const ks = String(s);
    pursesBySeat[s] = {
      ...(w.pursesBySeat[ks] ?? { food: 0, wood: 0, stone: 0 }),
    };
    bonusPointsBySeat[s] = w.bonusPointsBySeat?.[ks] ?? 0;
    revealedBySeat[s] = new Set(w.revealedBySeat?.[ks] ?? []);
    scoutedTodayBySeat[s] = new Set(w.scoutedTodayBySeat?.[ks] ?? []);
  }

  const base: HydratedWorldState = {
    map: w.map,
    stacks: w.stacks,
    recruitQueues: (w.recruitQueues ?? {}) as PendingRecruits,
    pursesBySeat,
    bonusPointsBySeat,
    revealedBySeat,
    scoutedTodayBySeat,
  };
  if (w.stackMovementBySeat) {
    base.stackMovementBySeat = {};
    for (const s of seats) {
      base.stackMovementBySeat[s] = { ...(w.stackMovementBySeat[String(s)] ?? {}) };
    }
  }
  if (w.recruitUsedThisDayKeys != null) {
    base.recruitUsedThisDay = new Set(w.recruitUsedThisDayKeys);
  }
  if (typeof w.day === "number") {
    base.day = w.day;
  }
  return base;
}
