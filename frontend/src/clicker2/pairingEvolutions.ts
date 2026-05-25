import {
  DENIZENS,
  denizenDoubleEfficiencyEffectText,
  getDenizenDef,
  getDenizenIndex,
  type DenizenDef,
} from "./denizens";
import { PAIRING_NAME_OVERRIDES } from "./pairingEvolutionNames";
import type { SpecialtyDef, SpecialtyEffect } from "./specialties";

export const PAIRING_SPECIALTY_DENIZEN_ID = "pairing" as const;

export const PAIRING_SPECIALTY_ID_START = 364;

/** Applied to the L/H blend base price for every pairing evolution. */
export const PAIRING_PRICE_MULTIPLIER = 10;

export type PairingUnlockRequirements = Readonly<Record<string, number>>;

/** First specialty id in each denizen's 15-tier double chain (`buildDoubleTier` start). */
export const DENIZEN_EVOLUTION_CHAIN_START_ID: Readonly<Record<string, number>> = {
  sediment: 16,
  fungi: 31,
  microbes: 46,
  zooplankton: 61,
  aquatic_plants: 76,
  invertebrates: 91,
  small_swimmers: 106,
  amphibians: 136,
  small_fish: 151,
  reptiles: 169,
  large_fish: 184,
  waterfowl: 199,
  shore_mammals: 214,
  hunting_birds: 229,
  great_mammals: 244,
  humans: 259,
  cryptids: 274,
  spirits: 289,
  leviathans: 304,
  abyssals: 319,
  celestials: 334,
  transcendence: 349,
};

export function pairingSourcePerStep(
  lowerDenizenId: string,
  higherDenizenId: string,
): number {
  const li = getDenizenIndex(lowerDenizenId);
  const hi = getDenizenIndex(higherDenizenId);
  if (li < 0 || hi < 0 || li >= hi) {
    throw new Error(
      `pairingSourcePerStep: invalid pair ${lowerDenizenId} → ${higherDenizenId}`,
    );
  }
  return 10 + li + (hi - li - 1);
}

export function pairingUnlockRequirements(
  lowerDenizenId: string,
  higherDenizenId: string,
): PairingUnlockRequirements {
  return { [lowerDenizenId]: 1, [higherDenizenId]: 15 };
}

export function pairingEvolutionName(
  lowerDenizenId: string,
  higherDenizenId: string,
): string {
  const key = `${lowerDenizenId}|${higherDenizenId}`;
  const override = PAIRING_NAME_OVERRIDES[key];
  if (override) return override;
  const l = getDenizenDef(lowerDenizenId);
  const h = getDenizenDef(higherDenizenId);
  if (l && h) return `${l.namePlural} × ${h.namePlural}`;
  return `${lowerDenizenId} × ${higherDenizenId}`;
}

/** 1st evolution in chain (unlock 1): ripple id 1, denizen `startId`. */
export function denizenFirstEvolutionPriceId(denizenId: string): number {
  if (denizenId === "ripples") return 1;
  const start = DENIZEN_EVOLUTION_CHAIN_START_ID[denizenId];
  if (start == null) {
    throw new Error(`denizenFirstEvolutionPriceId: unknown denizen ${denizenId}`);
  }
  return start;
}

/** 2nd evolution in chain (unlock 5): ripple id 2, denizen `startId + 1`. */
export function denizenSecondEvolutionPriceId(denizenId: string): number {
  if (denizenId === "ripples") return 2;
  const start = DENIZEN_EVOLUTION_CHAIN_START_ID[denizenId];
  if (start == null) {
    throw new Error(
      `denizenSecondEvolutionPriceId: unknown denizen ${denizenId}`,
    );
  }
  return start + 1;
}

/** 50% of L’s 2nd evolution + 50% of H’s 1st evolution (catalog prices). */
export function proposedPairingPrice(
  lowerDenizenId: string,
  higherDenizenId: string,
  catalogPrice: (id: number) => number,
): number {
  const l2 = catalogPrice(denizenSecondEvolutionPriceId(lowerDenizenId));
  const h1 = catalogPrice(denizenFirstEvolutionPriceId(higherDenizenId));
  const blend = Math.round(0.5 * l2 + 0.5 * h1);
  return Math.max(1, blend * PAIRING_PRICE_MULTIPLIER);
}

function pairingEffectText(
  lower: DenizenDef,
  higher: DenizenDef,
  sourcePerStep: number,
): string {
  const boost = denizenDoubleEfficiencyEffectText(lower);
  return `${boost}. ${higher.namePlural} gain +1% EpS per ${sourcePerStep} ${lower.namePlural} owned`;
}

function pairingEcologyNote(
  lower: DenizenDef,
  higher: DenizenDef,
): string {
  return `${lower.namePlural} and ${higher.namePlural} exchange matter and energy across the pond.`;
}

export function buildPairingSpecialtyEffects(
  lowerDenizenId: string,
  higherDenizenId: string,
  sourcePerStep: number,
): readonly SpecialtyEffect[] {
  return [
    { type: "double_denizen", denizenId: lowerDenizenId },
    {
      type: "denizen_eps_percent_per_denizen",
      sourceDenizenId: lowerDenizenId,
      targetDenizenId: higherDenizenId,
      percent: 1,
      sourcePerStep,
    },
  ];
}

export function buildPairingSpecialtyDef(
  id: number,
  lowerDenizenId: string,
  higherDenizenId: string,
  price: number,
): SpecialtyDef {
  const lower = getDenizenDef(lowerDenizenId)!;
  const higher = getDenizenDef(higherDenizenId)!;
  const sourcePerStep = pairingSourcePerStep(lowerDenizenId, higherDenizenId);
  const effects = buildPairingSpecialtyEffects(
    lowerDenizenId,
    higherDenizenId,
    sourcePerStep,
  );
  return {
    id,
    name: pairingEvolutionName(lowerDenizenId, higherDenizenId),
    denizenId: PAIRING_SPECIALTY_DENIZEN_ID,
    unlockOwned: 0,
    pairingUnlock: pairingUnlockRequirements(lowerDenizenId, higherDenizenId),
    pairingLowerDenizenId: lowerDenizenId,
    pairingHigherDenizenId: higherDenizenId,
    price,
    effect: effects[0]!,
    effects,
    effectText: pairingEffectText(lower, higher, sourcePerStep),
    ecologyNote: pairingEcologyNote(lower, higher),
  };
}

export function generatePairingSpecialtyDefs(
  catalogPrice: (id: number) => number,
): SpecialtyDef[] {
  const out: SpecialtyDef[] = [];
  let pairIndex = 0;
  for (let li = 0; li < DENIZENS.length - 1; li++) {
    for (let hi = li + 1; hi < DENIZENS.length; hi++) {
      const lowerId = DENIZENS[li]!.id;
      const higherId = DENIZENS[hi]!.id;
      const id = PAIRING_SPECIALTY_ID_START + pairIndex;
      const price = proposedPairingPrice(lowerId, higherId, catalogPrice);
      out.push(buildPairingSpecialtyDef(id, lowerId, higherId, price));
      pairIndex++;
    }
  }
  return out;
}

export function listPairingSpecialties(
  specialties: readonly SpecialtyDef[],
): SpecialtyDef[] {
  return specialties.filter(
    (s) => s.denizenId === PAIRING_SPECIALTY_DENIZEN_ID,
  );
}

/** Denizen ids that can be the lower (L) member of a pairing (every tier except the last). */
export const PAIRING_LOWER_DENIZEN_IDS: readonly string[] = DENIZENS.slice(
  0,
  -1,
).map((d) => d.id);

/** Shop/catalog color tier from L denizen id (ripples = 0, sediment = 1, …). */
export function pairingLowerDenizenTierIndexForId(lowerDenizenId: string): number {
  const idx = getDenizenIndex(lowerDenizenId);
  if (idx < 0) return 0;
  return Math.min(14, idx);
}

/** Shop/catalog card color tier from L’s position on the ladder (ripples = 0). */
export function pairingLowerDenizenTierIndex(def: SpecialtyDef): number {
  if (def.denizenId !== PAIRING_SPECIALTY_DENIZEN_ID) return 0;
  const lowerId = def.pairingLowerDenizenId;
  if (!lowerId) return 0;
  return pairingLowerDenizenTierIndexForId(lowerId);
}

export function pairingSpecialtyCount(): number {
  const n = DENIZENS.length;
  return (n * (n - 1)) / 2;
}
