import { denizenDoubleEfficiencyEffectText, getDenizenDef } from "./denizens";
import type { SpecialtyDef } from "./specialties";

export const WIND_SPECIALTY_DENIZEN_ID = "wind" as const;

/** Face blowing wind — shop, stats, and catalog. */
export const WIND_EVOLUTION_EMOJI = "🌬️";

export const WIND_SPECIALTY_ID_START = 675;

const WIND_ENTRIES: readonly {
  name: string;
  price: number;
  unlockWindEventsClicked: number;
  unlockRipplesOwned: number;
  ecologyNote: string;
}[] = [
  {
    name: "East Wind",
    price: 90_000,
    unlockWindEventsClicked: 1,
    unlockRipplesOwned: 1,
    ecologyNote:
      "A dawn breeze from the east roughens the meniscus and sends fresh rings across the open bowl.",
  },
  {
    name: "South Wind",
    price: 180_000,
    unlockWindEventsClicked: 2,
    unlockRipplesOwned: 10,
    ecologyNote:
      "Warm southern air slides over the pond, stacking ripples that carry heat and pollen toward the north shore.",
  },
  {
    name: "West Wind",
    price: 27_000_000,
    unlockWindEventsClicked: 3,
    unlockRipplesOwned: 25,
    ecologyNote:
      "Evening gusts off the western ridge chase wave trains across the basin before the surface stills at dusk.",
  },
  {
    name: "North Wind",
    price: 360_000_000,
    unlockWindEventsClicked: 5,
    unlockRipplesOwned: 50,
    ecologyNote:
      "Cold northern flow scours the film, folding overlapping rings that keep the pond breathing through the night.",
  },
];

function windSpecialty(tierIndex: number): SpecialtyDef {
  const entry = WIND_ENTRIES[tierIndex]!;
  const ripples = getDenizenDef("ripples")!;
  return {
    id: WIND_SPECIALTY_ID_START + tierIndex,
    name: entry.name,
    denizenId: WIND_SPECIALTY_DENIZEN_ID,
    unlockOwned: 0,
    unlockWindEventsClicked: entry.unlockWindEventsClicked,
    unlockRipplesOwned: entry.unlockRipplesOwned,
    price: entry.price,
    effect: { type: "double_click_and_denizen", denizenId: "ripples" },
    effectText: denizenDoubleEfficiencyEffectText(ripples),
    ecologyNote: entry.ecologyNote,
  };
}

export function buildWindEvolutionChain(): readonly SpecialtyDef[] {
  return WIND_ENTRIES.map((_, i) => windSpecialty(i));
}

export function formatWindUnlockSummary(specialty: SpecialtyDef): string {
  const winds = specialty.unlockWindEventsClicked ?? 0;
  const ripples = specialty.unlockRipplesOwned ?? 0;
  const windLabel = winds === 1 ? "wind event" : "wind events";
  return `${winds} ${windLabel} clicked · ${ripples.toLocaleString()}+ Ripples`;
}
