import {
  DENIZENS,
  getOwnedDenizenCount,
  nextDenizenCost,
  type DenizenDef,
} from "./denizens";
import { getMutationLevel } from "./mutagens";
import { getSpecialtyDef, type SpecialtyEffect } from "./specialties";

export type SimulationOutput = {
  energyPerSecond: number;
  clickValue: number;
  denizenEps: Record<string, number>;
};

/** Stub for future Conditions / Prestige / Weather. */
export function globalEpsBoost(
  effects: SpecialtyEffect[],
): number {
  let bonusPercent = 0;
  for (const e of effects) {
    if (e.type === "production_percent") {
      bonusPercent += e.percent;
    }
  }
  return 1 + bonusPercent / 100;
}

function countNonRippleObjects(ownedDenizens: Record<string, number>): number {
  let total = 0;
  for (const def of DENIZENS) {
    if (def.id === "ripples") continue;
    total += getOwnedDenizenCount(ownedDenizens, def.id);
  }
  return total;
}

function ownedSpecialtyEffects(
  ownedSpecialties: Record<number, boolean>,
): SpecialtyEffect[] {
  const out: SpecialtyEffect[] = [];
  for (const [rawId, owned] of Object.entries(ownedSpecialties)) {
    if (!owned) continue;
    const id = Number(rawId);
    const def = getSpecialtyDef(id);
    if (def) out.push(def.effect);
  }
  return out;
}

function rippleEfficiencyMultiplier(effects: SpecialtyEffect[]): number {
  let mult = 1;
  for (const e of effects) {
    if (e.type === "double_click_and_denizen" && e.denizenId === "ripples") {
      mult *= 2;
    }
    if (e.type === "double_denizen" && e.denizenId === "ripples") {
      mult *= 2;
    }
  }
  return mult;
}

function denizenEfficiencyMultiplier(
  denizenId: string,
  effects: SpecialtyEffect[],
): number {
  let mult = 1;
  for (const e of effects) {
    if (e.type === "double_click_and_denizen" && e.denizenId === denizenId) {
      mult *= 2;
    }
    if (e.type === "double_denizen" && e.denizenId === denizenId) {
      mult *= 2;
    }
  }
  return mult;
}

/** Additive energy per non-Ripple object when Concentric Rings (and mults) are owned. */
function concentricRingsBonusPerNonRipple(effects: SpecialtyEffect[]): number {
  const hasRings = effects.some((e) => e.type === "concentric_rings");
  if (!hasRings) return 0;
  let mult = 1;
  for (const e of effects) {
    if (e.type === "concentric_rings_mult") mult *= e.factor;
  }
  return 0.1 * mult;
}

function epsForDenizen(
  def: DenizenDef,
  owned: number,
  effects: SpecialtyEffect[],
  nonRippleCount: number,
  mutationLevel: number,
): number {
  if (owned <= 0) return 0;
  const effMult =
    denizenEfficiencyMultiplier(def.id, effects) * globalEpsBoost(effects);
  let perCopy = def.baseEps * effMult;
  if (def.id === "ripples") {
    perCopy += concentricRingsBonusPerNonRipple(effects) * nonRippleCount;
  }
  if (mutationLevel > 0) {
    perCopy *= 1 + mutationLevel / 100;
  }
  return owned * perCopy;
}

/** EpS contributed by a single copy at current owned counts and specialties. */
export function denizenEpsPerCopy(
  def: DenizenDef,
  ownedDenizens: Record<string, number>,
  ownedSpecialties: Record<number, boolean>,
  denizenMutationLevels: Record<string, number> = {},
): number {
  const effects = ownedSpecialtyEffects(ownedSpecialties);
  const nonRippleCount = countNonRippleObjects(ownedDenizens);
  const mutationLevel = getMutationLevel(denizenMutationLevels, def.id);
  const owned = getOwnedDenizenCount(ownedDenizens, def.id);
  if (owned > 0) {
    return epsForDenizen(def, owned, effects, nonRippleCount, mutationLevel) / owned;
  }
  return epsForDenizen(def, 1, effects, nonRippleCount, mutationLevel);
}

/** Per-denizen EpS per copy for shop tooltips — one specialty scan for the whole map. */
export function denizenPerCopyEpsMap(
  ownedDenizens: Record<string, number>,
  ownedSpecialties: Record<number, boolean>,
  denizenMutationLevels: Record<string, number> = {},
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const def of DENIZENS) {
    map[def.id] = denizenEpsPerCopy(
      def,
      ownedDenizens,
      ownedSpecialties,
      denizenMutationLevels,
    );
  }
  return map;
}

export function simulateGame(
  ownedDenizens: Record<string, number>,
  ownedSpecialties: Record<number, boolean>,
  denizenMutationLevels: Record<string, number> = {},
): SimulationOutput {
  const effects = ownedSpecialtyEffects(ownedSpecialties);
  const nonRippleCount = countNonRippleObjects(ownedDenizens);
  const denizenEps: Record<string, number> = {};
  let energyPerSecond = 0;

  for (const def of DENIZENS) {
    const owned = getOwnedDenizenCount(ownedDenizens, def.id);
    const mutationLevel = getMutationLevel(denizenMutationLevels, def.id);
    const eps = epsForDenizen(
      def,
      owned,
      effects,
      nonRippleCount,
      mutationLevel,
    );
    denizenEps[def.id] = eps;
    energyPerSecond += eps;
  }

  const clickMult = rippleEfficiencyMultiplier(effects) * globalEpsBoost(effects);
  const ringsBonus =
    concentricRingsBonusPerNonRipple(effects) * nonRippleCount;
  const clickValue = Math.max(0, (1 + ringsBonus) * clickMult);

  return { energyPerSecond, clickValue, denizenEps };
}

export function marginalEpsIfBuyDenizen(
  def: DenizenDef,
  ownedDenizens: Record<string, number>,
  ownedSpecialties: Record<number, boolean>,
  denizenMutationLevels: Record<string, number> = {},
): number {
  const cur = simulateGame(
    ownedDenizens,
    ownedSpecialties,
    denizenMutationLevels,
  );
  const owned = getOwnedDenizenCount(ownedDenizens, def.id);
  if (nextDenizenCost(def, owned) === null) return 0;
  const next = simulateGame(
    { ...ownedDenizens, [def.id]: owned + 1 },
    ownedSpecialties,
    denizenMutationLevels,
  );
  return next.energyPerSecond - cur.energyPerSecond;
}

export function marginalEpsIfBuySpecialty(
  specialtyId: number,
  ownedDenizens: Record<string, number>,
  ownedSpecialties: Record<number, boolean>,
  denizenMutationLevels: Record<string, number> = {},
): number {
  if (ownedSpecialties[specialtyId]) return 0;
  const cur = simulateGame(
    ownedDenizens,
    ownedSpecialties,
    denizenMutationLevels,
  );
  const next = simulateGame(ownedDenizens, {
    ...ownedSpecialties,
    [specialtyId]: true,
  }, denizenMutationLevels);
  return next.energyPerSecond - cur.energyPerSecond;
}

export function marginalClickIfBuySpecialty(
  specialtyId: number,
  ownedDenizens: Record<string, number>,
  ownedSpecialties: Record<number, boolean>,
  denizenMutationLevels: Record<string, number> = {},
): number {
  if (ownedSpecialties[specialtyId]) return 0;
  const cur = simulateGame(
    ownedDenizens,
    ownedSpecialties,
    denizenMutationLevels,
  );
  const def = getSpecialtyDef(specialtyId);
  if (!def) return 0;
  const next = simulateGame(ownedDenizens, {
    ...ownedSpecialties,
    [specialtyId]: true,
  }, denizenMutationLevels);
  return next.clickValue - cur.clickValue;
}
