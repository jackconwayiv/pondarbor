import type { ResourcePurse } from "./pondsteadBuildingCosts";
import type { PendingRecruits } from "./pondsteadDay";
import type { ParsedMap } from "./types";
import type { UnitStack } from "./pondsteadUnits";
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

export function hydrateWorldFromServerSnapshot(w: PondsteadServerWorldSnapshot): HydratedWorldState {
  const purse = (k: 0 | 1): ResourcePurse => ({
    ...(w.pursesBySeat[String(k)] ?? { food: 0, wood: 0, stone: 0 }),
  });
  const base: HydratedWorldState = {
    map: w.map,
    stacks: w.stacks,
    recruitQueues: (w.recruitQueues ?? {}) as PendingRecruits,
    pursesBySeat: { 0: purse(0), 1: purse(1) },
    bonusPointsBySeat: {
      0: w.bonusPointsBySeat?.["0"] ?? 0,
      1: w.bonusPointsBySeat?.["1"] ?? 0,
    },
    revealedBySeat: {
      0: new Set(w.revealedBySeat?.["0"] ?? []),
      1: new Set(w.revealedBySeat?.["1"] ?? []),
    },
    scoutedTodayBySeat: {
      0: new Set(w.scoutedTodayBySeat?.["0"] ?? []),
      1: new Set(w.scoutedTodayBySeat?.["1"] ?? []),
    },
  };
  if (w.stackMovementBySeat) {
    base.stackMovementBySeat = {
      0: { ...(w.stackMovementBySeat["0"] ?? {}) },
      1: { ...(w.stackMovementBySeat["1"] ?? {}) },
    };
  }
  if (w.recruitUsedThisDayKeys != null) {
    base.recruitUsedThisDay = new Set(w.recruitUsedThisDayKeys);
  }
  if (typeof w.day === "number") {
    base.day = w.day;
  }
  return base;
}
