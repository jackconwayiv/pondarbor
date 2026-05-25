import {
  DENIZENS,
  denizenTeaseEnergyThreshold,
  getDenizenDef,
  getDenizenIndex,
} from "./denizens";
import {
  DENIZEN_EVOLUTION_TIER_MULT,
  RIPPLE_EARLY_PRICE_ANCHORS,
  RIPPLE_EVOLUTION_TIER_MULT,
} from "./evolutionTierMults";
import {
  marginalClickIfBuySpecialty,
  marginalEpsIfBuySpecialty,
} from "./simulation";
import { PAIRING_SPECIALTY_DENIZEN_ID } from "./pairingEvolutions";
import {
  CLICK_CHAIN_PRICE,
  CLICK_SPECIALTY_DENIZEN_ID,
  DENIZEN_SPECIALTY_UNLOCK_TIER,
  POND_SPECIALTY_DENIZEN_ID,
  POND_UNLOCK_ENERGY,
  specialtiesForDenizen,
  specialtyTierIndex,
  type SpecialtyDef,
} from "./specialties";

export {
  DENIZEN_EVOLUTION_TIER_MULT,
  RIPPLE_EARLY_PRICE_ANCHORS,
  RIPPLE_EVOLUTION_TIER_MULT,
  RIPPLE_PRICE_ANCHORS,
  TRANSCENDENCE_TIER_15_PRICE,
} from "./evolutionTierMults";

/** @deprecated Use DENIZEN_EVOLUTION_TIER_MULT; sediment tier-0 price = 100 × M[0]. */
export const SEDIMENT_PRICE_ANCHORS: readonly number[] =
  DENIZEN_EVOLUTION_TIER_MULT.map((m) => Math.round(100 * m));

/** Target payback at reference unlock (seconds of marginal income). */
export const EVOLUTION_PAYBACK_SEC = 120;

/** Payback band for validation (±100% of target). */
export const EVOLUTION_PAYBACK_MIN_SEC = 60;
export const EVOLUTION_PAYBACK_MAX_SEC = 240;

/** Estimated pond clicks per second when valuing ripple click upgrades. */
export const RIPPLE_CLICKS_PER_SEC_AT_UNLOCK = 3;

export const POND_PRODUCTION_PRICE_ANCHORS: readonly number[] = [
  1_000_000,
  5_000_000,
  10_000_000,
  25_000_000,
  50_000_000,
  75_000_000,
  100_000_000,
  150_000_000,
  200_000_000,
  350_000_000,
  500_000_000,
  750_000_000,
  5_000_000_000,
  10_000_000_000,
  50_000_000_000,
  100_000_000_000,
  250_000_000_000,
  500_000_000_000,
];

export type EvolutionChainKind = "denizen" | "ripple" | "pond" | "click";

export type EvolutionPricingOptions = {
  paybackSec?: number;
  chainMultipliers?: Partial<Record<EvolutionChainKind, number>>;
  clicksPerSec?: number;
};

export type ReferenceUnlockState = {
  ownedDenizens: Record<string, number>;
  ownedSpecialties: Record<number, boolean>;
};

export type MarginalAtUnlock = {
  marginalEps: number;
  marginalClick: number;
  /** EpS-equivalent income per second used for pricing. */
  incomePerSec: number;
};

export type PricingViolation = {
  specialtyId: number;
  kind: string;
  message: string;
};

const DEFAULT_CHAIN_MULTIPLIERS: Record<EvolutionChainKind, number> = {
  denizen: 1,
  ripple: 1,
  pond: 1,
  click: 1,
};

/** Progression ladder index → denizen owned count in reference builds. */
export function ladderOwnedCountForTierIndex(tierIndex: number): number {
  const t = Math.max(0, Math.min(14, tierIndex));
  return DENIZEN_SPECIALTY_UNLOCK_TIER[t]!;
}

/** Map pond production tier (0–17) to denizen-chain tier (0–14). */
export function pondTierToLadderTierIndex(pondTierIndex: number): number {
  if (pondTierIndex <= 0) return 0;
  if (pondTierIndex >= 17) return 14;
  return Math.min(14, Math.floor((pondTierIndex * 14) / 17));
}

export function evolutionChainKind(def: SpecialtyDef): EvolutionChainKind {
  if (def.denizenId === POND_SPECIALTY_DENIZEN_ID) return "pond";
  if (def.denizenId === CLICK_SPECIALTY_DENIZEN_ID) return "click";
  if (def.denizenId === PAIRING_SPECIALTY_DENIZEN_ID) return "denizen";
  if (def.denizenId === "ripples") return "ripple";
  return "denizen";
}

export function chainMultiplierFor(
  def: SpecialtyDef,
  options?: EvolutionPricingOptions,
): number {
  const kind = evolutionChainKind(def);
  const mults = options?.chainMultipliers ?? {};
  return mults[kind] ?? DEFAULT_CHAIN_MULTIPLIERS[kind];
}

/** Denizens teased at this all-time energy, each at `ownedPerDenizen` copies. */
export function denizensOwnedAtAllTimeEnergy(
  allTimeEnergy: number,
  ownedPerDenizen: number,
): Record<string, number> {
  const owned: Record<string, number> = {};
  const per = Math.max(1, ownedPerDenizen);

  for (const def of DENIZENS) {
    if (denizenTeaseEnergyThreshold(def) <= allTimeEnergy) {
      owned[def.id] = per;
    }
  }
  if (!owned.ripples) {
    owned.ripples = 1;
  }
  return owned;
}

/**
 * Sediment tier 3 vs ripple tier 3 price (ripple anchor = 1× $100k).
 * Design scale was 100 → 50; dollar ratio is 25× ripple tier 3 ($2.5M).
 */
export const SEDIMENT_TIER_3_RIPPLE_RATIO = 25;

export function denizenEvolutionPrice(
  denizenId: string,
  tierIndex: number,
): number {
  if (denizenId === "sediment") {
    return sedimentEvolutionPrice(tierIndex);
  }
  const def = getDenizenDef(denizenId);
  if (!def) return 1;
  const mult =
    DENIZEN_EVOLUTION_TIER_MULT[tierIndex] ??
    DENIZEN_EVOLUTION_TIER_MULT[DENIZEN_EVOLUTION_TIER_MULT.length - 1]!;
  return Math.round(def.baseCost * mult);
}

export function sedimentEvolutionPrice(tierIndex: number): number {
  if (tierIndex === 3) {
    return rippleEvolutionPrice(3) * SEDIMENT_TIER_3_RIPPLE_RATIO;
  }
  const def = getDenizenDef("sediment");
  if (!def) return 1;
  const mult =
    DENIZEN_EVOLUTION_TIER_MULT[tierIndex] ??
    DENIZEN_EVOLUTION_TIER_MULT[DENIZEN_EVOLUTION_TIER_MULT.length - 1]!;
  return Math.round(def.baseCost * mult);
}

export function rippleEvolutionPrice(tierIndex: number): number {
  if (tierIndex < RIPPLE_EARLY_PRICE_ANCHORS.length) {
    return RIPPLE_EARLY_PRICE_ANCHORS[tierIndex]!;
  }
  const def = getDenizenDef("ripples");
  if (!def) return 1;
  const mult =
    RIPPLE_EVOLUTION_TIER_MULT[tierIndex] ??
    RIPPLE_EVOLUTION_TIER_MULT[RIPPLE_EVOLUTION_TIER_MULT.length - 1]!;
  return Math.round(def.baseCost * mult);
}

export function rippleAnchoredPrice(tierIndex: number): number {
  return rippleEvolutionPrice(tierIndex);
}

export function pondProductionAnchoredPrice(tierIndex: number): number {
  const anchor =
    POND_PRODUCTION_PRICE_ANCHORS[tierIndex] ??
    POND_PRODUCTION_PRICE_ANCHORS[POND_PRODUCTION_PRICE_ANCHORS.length - 1]!;
  return anchor;
}

export function clickReflectionAnchoredPrice(tierIndex: number): number {
  const anchor =
    CLICK_CHAIN_PRICE[tierIndex] ??
    CLICK_CHAIN_PRICE[CLICK_CHAIN_PRICE.length - 1]!;
  return anchor;
}

/**
 * Reference save at unlock: prior in-chain evolutions, pond % earned by then,
 * denizen counts aligned to progression (not the full ladder at once for pond).
 */
export function buildReferenceStateAtUnlock(
  specialty: SpecialtyDef,
): ReferenceUnlockState {
  const ownedDenizens: Record<string, number> = {};
  const ownedSpecialties: Record<number, boolean> = {};

  if (specialty.pairingUnlock) {
    for (const def of DENIZENS) {
      ownedDenizens[def.id] = 0;
    }
    ownedDenizens.ripples = 1;
    for (const [denizenId, required] of Object.entries(specialty.pairingUnlock)) {
      ownedDenizens[denizenId] = Math.max(
        ownedDenizens[denizenId] ?? 0,
        required,
      );
    }
    return { ownedDenizens, ownedSpecialties };
  }

  if (specialty.unlockClickEnergy != null) {
    const tierIndex = specialtyTierIndex(specialty);
    const ownedPerDenizen = ladderOwnedCountForTierIndex(tierIndex);
    for (const def of DENIZENS) {
      ownedDenizens[def.id] = ownedPerDenizen;
    }
    ownedDenizens.ripples = 1;
    const clickChain = specialtiesForDenizen(CLICK_SPECIALTY_DENIZEN_ID);
    for (const s of clickChain) {
      if (s.id === specialty.id) continue;
      if (
        s.unlockClickEnergy != null &&
        s.unlockClickEnergy < specialty.unlockClickEnergy
      ) {
        ownedSpecialties[s.id] = true;
      }
    }
    return { ownedDenizens, ownedSpecialties };
  }

  const tierIndex = specialtyTierIndex(specialty);
  const isPond = specialty.denizenId === POND_SPECIALTY_DENIZEN_ID;
  const targetDenizenIdx = isPond ? -1 : getDenizenIndex(specialty.denizenId);

  const ladderTier = isPond
    ? pondTierToLadderTierIndex(tierIndex)
    : tierIndex;

  const ownedPerDenizen = ladderOwnedCountForTierIndex(ladderTier);
  const rippleChain = specialty.denizenId === "ripples";

  if (isPond && specialty.unlockAllTimeEnergy != null) {
    Object.assign(
      ownedDenizens,
      denizensOwnedAtAllTimeEnergy(
        specialty.unlockAllTimeEnergy,
        ownedPerDenizen,
      ),
    );
  } else if (rippleChain) {
    for (const def of DENIZENS) {
      ownedDenizens[def.id] =
        def.id === "ripples"
          ? Math.max(1, specialty.unlockOwned)
          : ladderOwnedCountForTierIndex(ladderTier);
    }
  } else {
    for (const def of DENIZENS) {
      const idx = getDenizenIndex(def.id);
      if (def.id === specialty.denizenId) {
        ownedDenizens[def.id] = Math.max(1, specialty.unlockOwned);
      } else if (idx < targetDenizenIdx) {
        ownedDenizens[def.id] = ownedPerDenizen;
      } else if (def.id === "ripples") {
        ownedDenizens[def.id] = Math.max(1, ownedPerDenizen);
      } else {
        ownedDenizens[def.id] = 0;
      }
    }
  }

  const chain = specialtiesForDenizen(specialty.denizenId);
  for (const s of chain) {
    if (s.id === specialty.id) continue;
    if (specialtyTierIndex(s) < tierIndex) {
      ownedSpecialties[s.id] = true;
    }
  }

  if (specialty.unlockAllTimeEnergy != null) {
    const pondChain = specialtiesForDenizen(POND_SPECIALTY_DENIZEN_ID);
    for (const s of pondChain) {
      if (s.id === specialty.id) continue;
      if (
        s.unlockAllTimeEnergy != null &&
        s.unlockAllTimeEnergy < specialty.unlockAllTimeEnergy
      ) {
        ownedSpecialties[s.id] = true;
      }
    }
  } else if (!isPond) {
    const pondEnergy =
      POND_UNLOCK_ENERGY[
        Math.min(pondTierToLadderTierIndex(ladderTier), POND_UNLOCK_ENERGY.length - 1)
      ] ?? 0;
    const pondChain = specialtiesForDenizen(POND_SPECIALTY_DENIZEN_ID);
    for (const s of pondChain) {
      if (s.unlockAllTimeEnergy != null && s.unlockAllTimeEnergy <= pondEnergy) {
        ownedSpecialties[s.id] = true;
      }
    }
  }

  return { ownedDenizens, ownedSpecialties };
}

export function marginalValueAtUnlock(
  specialty: SpecialtyDef,
  state?: ReferenceUnlockState,
  options?: EvolutionPricingOptions,
): MarginalAtUnlock {
  const ref = state ?? buildReferenceStateAtUnlock(specialty);
  const marginalEps = marginalEpsIfBuySpecialty(
    specialty.id,
    ref.ownedDenizens,
    ref.ownedSpecialties,
  );
  const marginalClick = marginalClickIfBuySpecialty(
    specialty.id,
    ref.ownedDenizens,
    ref.ownedSpecialties,
  );

  const kind = evolutionChainKind(specialty);
  const clicksPerSec =
    options?.clicksPerSec ?? RIPPLE_CLICKS_PER_SEC_AT_UNLOCK;
  let incomePerSec = marginalEps;
  if (kind === "ripple") {
    incomePerSec = Math.max(
      marginalEps,
      marginalClick * clicksPerSec,
    );
  }

  return { marginalEps, marginalClick, incomePerSec };
}

export function paybackSec(price: number, incomePerSec: number): number {
  if (incomePerSec <= 0 || !Number.isFinite(incomePerSec)) return Infinity;
  return price / incomePerSec;
}

export function proposedPriceAtUnlock(
  specialty: SpecialtyDef,
  options?: EvolutionPricingOptions,
): number {
  const paybackSecVal = options?.paybackSec ?? EVOLUTION_PAYBACK_SEC;
  const tierIndex = specialtyTierIndex(specialty);
  const kind = evolutionChainKind(specialty);
  const mult = chainMultiplierFor(specialty, options);

  if (kind === "pond") {
    void paybackSecVal;
    void mult;
    return pondProductionAnchoredPrice(tierIndex);
  }

  if (kind === "click") {
    void paybackSecVal;
    void mult;
    return clickReflectionAnchoredPrice(tierIndex);
  }

  if (kind === "ripple") {
    return rippleEvolutionPrice(tierIndex);
  }

  return denizenEvolutionPrice(specialty.denizenId, tierIndex);
}

/** Enforce non-decreasing prices within each denizen/pond chain. */
export function applyMonotoneChainPrices(
  specialties: readonly SpecialtyDef[],
  rawPrices: Record<number, number>,
): Record<number, number> {
  const out = { ...rawPrices };
  const chains = new Set(specialties.map((s) => s.denizenId));

  for (const denizenId of chains) {
    if (
      denizenId === PAIRING_SPECIALTY_DENIZEN_ID ||
      denizenId === CLICK_SPECIALTY_DENIZEN_ID
    ) {
      continue;
    }
    const chain = specialtiesForDenizen(denizenId).slice().sort(
      (a, b) => specialtyTierIndex(a) - specialtyTierIndex(b),
    );
    let prev = 0;
    for (const s of chain) {
      const p = out[s.id] ?? s.price;
      const next = Math.max(p, prev > 0 ? Math.ceil(prev * 1.02) : p);
      out[s.id] = next;
      prev = next;
    }
  }

  return out;
}

export function generateSpecialtyPrices(
  specialties: readonly SpecialtyDef[],
  options?: EvolutionPricingOptions,
): Record<number, number> {
  const raw: Record<number, number> = {};
  for (const s of specialties) {
    if (s.denizenId === PAIRING_SPECIALTY_DENIZEN_ID) {
      raw[s.id] = s.price;
      continue;
    }
    raw[s.id] = proposedPriceAtUnlock(s, options);
  }
  return applyMonotoneChainPrices(specialties, raw);
}

export function validatePricingTable(
  specialties: readonly SpecialtyDef[],
  prices: Record<number, number>,
  options?: EvolutionPricingOptions,
): PricingViolation[] {
  const violations: PricingViolation[] = [];

  const chains = new Set(specialties.map((s) => s.denizenId));
  for (const denizenId of chains) {
    if (
      denizenId === PAIRING_SPECIALTY_DENIZEN_ID ||
      denizenId === CLICK_SPECIALTY_DENIZEN_ID
    ) {
      continue;
    }
    const chain = specialtiesForDenizen(denizenId).slice().sort(
      (a, b) => specialtyTierIndex(a) - specialtyTierIndex(b),
    );
    let prevPrice = 0;
    for (const s of chain) {
      const price = prices[s.id] ?? s.price;
      if (price <= 0) {
        violations.push({
          specialtyId: s.id,
          kind: "non_positive_price",
          message: `price must be > 0, got ${price}`,
        });
      }
      if (prevPrice > 0 && price < prevPrice) {
        violations.push({
          specialtyId: s.id,
          kind: "non_monotone_price",
          message: `price ${price} < previous tier ${prevPrice}`,
        });
      }
      prevPrice = price;
    }
  }

  void options;
  return violations;
}

export function formatPaybackDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${(sec / 60).toFixed(1)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}
