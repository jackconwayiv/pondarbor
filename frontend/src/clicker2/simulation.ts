import {
  DENIZENS,
  getOwnedDenizenCount,
  nextDenizenCost,
  type DenizenDef,
} from "./denizens";
import { getMutationLevel } from "./mutagens";
import { isRetiredWindSpecialtyId } from "./retiredWindEvolutions";
import { isStratifiedPondOwned } from "./fossilShop";
import { getSpecialtyDef, type SpecialtyEffect } from "./specialties";

/** Components of [`clickValue`](#simulateGame): baseline vs EpS-linked click reflections. */
export type ClickValueBreakdown = {
  /** `(1 + ringsBonus) × rippleEfficiencyMult × globalEpsBoost` */
  clickBaseline: number;
  /** `energyPerSecond × Σ click_eps_percent ÷ 100` */
  clickFromEpSPercent: number;
  /** Sum of owned `click_eps_percent.percent` (+1 each tier typically). */
  clickEpsPercentTotal: number;
  /** `concentricRingsBonusPerNonRipple × nonRippleCount`; use for debugging. */
  ringsBonus: number;
  rippleEfficiencyMultiplier: number;
  globalEpsBoost: number;
};

export type SimulationOutput = {
  energyPerSecond: number;
  clickValue: number;
  denizenEps: Record<string, number>;
  clickBreakdown: ClickValueBreakdown;
};

/** Max strata effect fraction from owned energy-tier fossil evolutions (0 if none). */
export function strataEffectFraction(effects: SpecialtyEffect[]): number {
  let fraction = 0;
  for (const e of effects) {
    if (e.type === "strata_effect_fraction" && e.fraction > 0) {
      fraction = Math.max(fraction, e.fraction);
    }
  }
  return fraction;
}

/** +1% EpS per fossilized stratum per 100% of strata effect (requires Stratified Pond). */
export function strataLevelsEpsBonusPercent(
  effects: SpecialtyEffect[],
  fossilizedStrata: number,
  ownsStratifiedPond: boolean,
): number {
  if (!ownsStratifiedPond || fossilizedStrata <= 0) return 0;
  const fraction = strataEffectFraction(effects);
  if (fraction <= 0) return 0;
  return fossilizedStrata * fraction;
}

export function globalEpsBoost(
  effects: SpecialtyEffect[],
  blossomCount = 0,
  fossilizedStrata = 0,
  ownsStratifiedPond = false,
): number {
  let bonusPercent = 0;
  const blossoms = Math.max(0, blossomCount);
  for (const e of effects) {
    if (e.type === "eps_percent_per_blossom") {
      bonusPercent += e.percentPerBlossom * blossoms;
    }
    if (e.type === "production_percent") {
      bonusPercent += e.percent;
    }
  }
  bonusPercent += strataLevelsEpsBonusPercent(
    effects,
    fossilizedStrata,
    ownsStratifiedPond,
  );
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

function specialtyEffectsFromDef(
  def: NonNullable<ReturnType<typeof getSpecialtyDef>>,
): SpecialtyEffect[] {
  if (def.effects?.length) return [...def.effects];
  return [def.effect];
}

function ownedSpecialtyEffects(
  ownedSpecialties: Record<number, boolean>,
): SpecialtyEffect[] {
  const out: SpecialtyEffect[] = [];
  for (const [rawId, owned] of Object.entries(ownedSpecialties)) {
    if (!owned) continue;
    const id = Number(rawId);
    if (isRetiredWindSpecialtyId(id)) continue;
    const def = getSpecialtyDef(id);
    if (def) out.push(...specialtyEffectsFromDef(def));
  }
  return out;
}

export function rippleEfficiencyMultiplier(effects: SpecialtyEffect[]): number {
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
  ownedDenizens: Record<string, number>,
  effects: SpecialtyEffect[],
  nonRippleCount: number,
  mutationLevel: number,
  blossomCount: number,
  fossilizedStrata: number,
  ownsStratifiedPond: boolean,
): number {
  if (owned <= 0) return 0;
  const effMult =
    denizenEfficiencyMultiplier(def.id, effects) *
    globalEpsBoost(effects, blossomCount, fossilizedStrata, ownsStratifiedPond);
  let perCopy = def.baseEps * effMult;
  for (const e of effects) {
    if (
      e.type === "denizen_eps_percent_per_denizen" &&
      e.targetDenizenId === def.id
    ) {
      const src = getOwnedDenizenCount(ownedDenizens, e.sourceDenizenId);
      const steps = Math.floor(src / e.sourcePerStep);
      perCopy *= 1 + (e.percent * steps) / 100;
    }
  }
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
  blossomCount = 0,
  fossilizedStrata = 0,
): number {
  const effects = ownedSpecialtyEffects(ownedSpecialties);
  const ownsStratifiedPond = isStratifiedPondOwned(ownedSpecialties);
  const nonRippleCount = countNonRippleObjects(ownedDenizens);
  const mutationLevel = getMutationLevel(denizenMutationLevels, def.id);
  const owned = getOwnedDenizenCount(ownedDenizens, def.id);
  if (owned > 0) {
    return (
      epsForDenizen(
        def,
        owned,
        ownedDenizens,
        effects,
        nonRippleCount,
        mutationLevel,
        blossomCount,
        fossilizedStrata,
        ownsStratifiedPond,
      ) / owned
    );
  }
  return epsForDenizen(
    def,
    1,
    ownedDenizens,
    effects,
    nonRippleCount,
    mutationLevel,
    blossomCount,
    fossilizedStrata,
    ownsStratifiedPond,
  );
}

/** Per-denizen EpS per copy for shop tooltips — one specialty scan for the whole map. */
export function denizenPerCopyEpsMap(
  ownedDenizens: Record<string, number>,
  ownedSpecialties: Record<number, boolean>,
  denizenMutationLevels: Record<string, number> = {},
  blossomCount = 0,
  fossilizedStrata = 0,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const def of DENIZENS) {
    map[def.id] = denizenEpsPerCopy(
      def,
      ownedDenizens,
      ownedSpecialties,
      denizenMutationLevels,
      blossomCount,
      fossilizedStrata,
    );
  }
  return map;
}

export function simulateGame(
  ownedDenizens: Record<string, number>,
  ownedSpecialties: Record<number, boolean>,
  denizenMutationLevels: Record<string, number> = {},
  blossomCount = 0,
  fossilizedStrata = 0,
): SimulationOutput {
  const effects = ownedSpecialtyEffects(ownedSpecialties);
  const ownsStratifiedPond = isStratifiedPondOwned(ownedSpecialties);
  const nonRippleCount = countNonRippleObjects(ownedDenizens);
  const denizenEps: Record<string, number> = {};
  let energyPerSecond = 0;

  for (const def of DENIZENS) {
    const owned = getOwnedDenizenCount(ownedDenizens, def.id);
    const mutationLevel = getMutationLevel(denizenMutationLevels, def.id);
    const eps = epsForDenizen(
      def,
      owned,
      ownedDenizens,
      effects,
      nonRippleCount,
      mutationLevel,
      blossomCount,
      fossilizedStrata,
      ownsStratifiedPond,
    );
    denizenEps[def.id] = eps;
    energyPerSecond += eps;
  }

  const rippleEffMult = rippleEfficiencyMultiplier(effects);
  const globalBoost = globalEpsBoost(
    effects,
    blossomCount,
    fossilizedStrata,
    ownsStratifiedPond,
  );
  const clickMult = rippleEffMult * globalBoost;
  const ringsBonus =
    concentricRingsBonusPerNonRipple(effects) * nonRippleCount;
  let clickEpsPercent = 0;
  for (const e of effects) {
    if (e.type === "click_eps_percent") clickEpsPercent += e.percent;
  }
  const clickBaseline = Math.max(0, (1 + ringsBonus) * clickMult);
  const clickFromEpSPercent = (energyPerSecond * clickEpsPercent) / 100;
  const clickValue = clickBaseline + clickFromEpSPercent;

  const clickBreakdown: ClickValueBreakdown = {
    clickBaseline,
    clickFromEpSPercent,
    clickEpsPercentTotal: clickEpsPercent,
    ringsBonus,
    rippleEfficiencyMultiplier: rippleEffMult,
    globalEpsBoost: globalBoost,
  };

  return { energyPerSecond, clickValue, denizenEps, clickBreakdown };
}

export function marginalEpsIfBuyDenizen(
  def: DenizenDef,
  ownedDenizens: Record<string, number>,
  ownedSpecialties: Record<number, boolean>,
  denizenMutationLevels: Record<string, number> = {},
  blossomCount = 0,
  fossilizedStrata = 0,
): number {
  const cur = simulateGame(
    ownedDenizens,
    ownedSpecialties,
    denizenMutationLevels,
    blossomCount,
    fossilizedStrata,
  );
  const owned = getOwnedDenizenCount(ownedDenizens, def.id);
  if (nextDenizenCost(def, owned) === null) return 0;
  const next = simulateGame(
    { ...ownedDenizens, [def.id]: owned + 1 },
    ownedSpecialties,
    denizenMutationLevels,
    blossomCount,
    fossilizedStrata,
  );
  return next.energyPerSecond - cur.energyPerSecond;
}

export function marginalEpsIfBuySpecialty(
  specialtyId: number,
  ownedDenizens: Record<string, number>,
  ownedSpecialties: Record<number, boolean>,
  denizenMutationLevels: Record<string, number> = {},
  blossomCount = 0,
  fossilizedStrata = 0,
): number {
  if (ownedSpecialties[specialtyId]) return 0;
  const cur = simulateGame(
    ownedDenizens,
    ownedSpecialties,
    denizenMutationLevels,
    blossomCount,
    fossilizedStrata,
  );
  const next = simulateGame(
    ownedDenizens,
    {
      ...ownedSpecialties,
      [specialtyId]: true,
    },
    denizenMutationLevels,
    blossomCount,
    fossilizedStrata,
  );
  return next.energyPerSecond - cur.energyPerSecond;
}

export function marginalClickIfBuySpecialty(
  specialtyId: number,
  ownedDenizens: Record<string, number>,
  ownedSpecialties: Record<number, boolean>,
  denizenMutationLevels: Record<string, number> = {},
  blossomCount = 0,
  fossilizedStrata = 0,
): number {
  if (ownedSpecialties[specialtyId]) return 0;
  const cur = simulateGame(
    ownedDenizens,
    ownedSpecialties,
    denizenMutationLevels,
    blossomCount,
    fossilizedStrata,
  );
  const def = getSpecialtyDef(specialtyId);
  if (!def) return 0;
  const next = simulateGame(
    ownedDenizens,
    {
      ...ownedSpecialties,
      [specialtyId]: true,
    },
    denizenMutationLevels,
    blossomCount,
    fossilizedStrata,
  );
  return next.clickValue - cur.clickValue;
}
