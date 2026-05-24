import { getDenizenDef } from "./denizens";
import {
  POND_SPECIALTY_DENIZEN_ID,
  SPECIALTIES,
  type SpecialtyDef,
} from "./specialties";

/** Pond production evolution chain (not spendable energy ⚡). */
export const POND_PRODUCTION_EMOJI = "💦";

export function evolutionDisplayEmoji(def: SpecialtyDef): string {
  if (def.denizenId === POND_SPECIALTY_DENIZEN_ID) return POND_PRODUCTION_EMOJI;
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
