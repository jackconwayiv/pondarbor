import { getDenizenDef } from "./denizens";
import { PAIRING_SPECIALTY_DENIZEN_ID } from "./pairingEvolutions";
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

export function evolutionDisplayEmoji(def: SpecialtyDef): string {
  if (def.denizenId === POND_SPECIALTY_DENIZEN_ID) return POND_PRODUCTION_EMOJI;
  if (def.denizenId === CLICK_SPECIALTY_DENIZEN_ID) return CLICK_CHAIN_EMOJI;
  if (def.denizenId === PAIRING_SPECIALTY_DENIZEN_ID) {
    const l = def.pairingLowerDenizenId
      ? getDenizenDef(def.pairingLowerDenizenId)?.emoji
      : undefined;
    const h = def.pairingHigherDenizenId
      ? getDenizenDef(def.pairingHigherDenizenId)?.emoji
      : undefined;
    if (l && h) return `${l}${h}`;
  }
  return getDenizenDef(def.denizenId)?.emoji ?? "✨";
}

/** Owned evolutions for stats UI: most expensive to least expensive. */
export function listOwnedEvolutionDefs(
  ownedSpecialties: Record<number, boolean>,
): SpecialtyDef[] {
  return SPECIALTIES.filter((s) => ownedSpecialties[s.id]).sort((a, b) => {
    if (b.price !== a.price) return b.price - a.price;
    return a.id - b.id;
  });
}
