import { getDenizenDef } from "./denizens";
import { PAIRING_SPECIALTY_DENIZEN_ID } from "./pairingEvolutions";
import { POLLINATOR_SPECIALTY_DENIZEN_ID } from "./pollinatorEvolutions";
import {
  WIND_EVOLUTION_EMOJI,
  WIND_SPECIALTY_DENIZEN_ID,
} from "./windEvolutions";
import {
  CLICK_SPECIALTY_DENIZEN_ID,
  POND_SPECIALTY_DENIZEN_ID,
  SPECIALTIES,
  type SpecialtyDef,
} from "./specialties";

/** Pond production evolution chain (not spendable energy ⚡). */
export const POND_PRODUCTION_EMOJI = "💦";

/** Click reflection evolution chain. */
export const CLICK_CHAIN_EMOJI = "🪷";

/** Paired (L×H) evolutions in shop, stats, and catalog. */
export const PAIRING_EVOLUTION_EMOJI = "🍃";

export function evolutionDisplayEmoji(def: SpecialtyDef): string {
  if (def.denizenId === POND_SPECIALTY_DENIZEN_ID) return POND_PRODUCTION_EMOJI;
  if (def.denizenId === CLICK_SPECIALTY_DENIZEN_ID) return CLICK_CHAIN_EMOJI;
  if (def.denizenId === POLLINATOR_SPECIALTY_DENIZEN_ID) {
    return def.pollinatorEmoji ?? "🐝";
  }
  if (def.denizenId === PAIRING_SPECIALTY_DENIZEN_ID) {
    return PAIRING_EVOLUTION_EMOJI;
  }
  if (def.denizenId === WIND_SPECIALTY_DENIZEN_ID) {
    return WIND_EVOLUTION_EMOJI;
  }
  return getDenizenDef(def.denizenId)?.emoji ?? "✨";
}

/** Stats tie-break when acquisition timestamps match (price desc, then id asc). */
export function compareOwnedEvolutionStatsTieBreak(
  a: SpecialtyDef,
  b: SpecialtyDef,
): number {
  if (b.price !== a.price) return b.price - a.price;
  return a.id - b.id;
}

export function compareOwnedEvolutionDefsForStats(
  a: SpecialtyDef,
  b: SpecialtyDef,
  specialtyAcquiredAtMs: Record<number, number>,
): number {
  const aMs = specialtyAcquiredAtMs[a.id] ?? 0;
  const bMs = specialtyAcquiredAtMs[b.id] ?? 0;
  if (bMs !== aMs) return bMs - aMs;
  return compareOwnedEvolutionStatsTieBreak(a, b);
}

/** Owned evolutions for stats UI: newest acquired first; ties use price/id order. */
export function listOwnedEvolutionDefs(
  ownedSpecialties: Record<number, boolean>,
  specialtyAcquiredAtMs: Record<number, number> = {},
): SpecialtyDef[] {
  return SPECIALTIES.filter((s) => ownedSpecialties[s.id]).sort((a, b) =>
    compareOwnedEvolutionDefsForStats(a, b, specialtyAcquiredAtMs),
  );
}
