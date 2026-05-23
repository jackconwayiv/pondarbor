import { getDenizenDef } from "./denizens";
import {
  POND_SPECIALTY_DENIZEN_ID,
  SPECIALTIES,
  type SpecialtyDef,
} from "./specialties";

export function evolutionDisplayEmoji(def: SpecialtyDef): string {
  if (def.denizenId === POND_SPECIALTY_DENIZEN_ID) return "⚡";
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
