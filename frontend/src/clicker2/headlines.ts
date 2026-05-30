import { DENIZENS, getDenizenDef, getOwnedDenizenCount } from "./denizens";

export type HeadlineDef = {
  id: string;
  denizenId: string;
  text: string;
  /** Shown when owned count for denizenId is >= this value (highest matching tier wins). */
  unlockOwned: number;
};

export type HeadlineRotationSelection = {
  denizenId: string;
  headlineId: string;
};

export const HEADLINE_ROTATION_MS = 120_000;

function headline(
  denizenId: string,
  unlockOwned: number,
  text: string,
): HeadlineDef {
  return {
    id: `${denizenId}_${unlockOwned}`,
    denizenId,
    unlockOwned,
    text,
  };
}

const RIPPLES_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "ripples",
    1,
    "Ditch fills with rainwater; calls itself pond.",
  ),
  headline(
    "ripples",
    5,
    "Faint ripples mistaken for pond life",
  ),
  headline(
    "ripples",
    8,
    "Energy is beginning to trickle through your pond.",
  ),
  headline(
    "ripples",
    10,
    "the still blue water / reflects white clouds in the sky / until ripples form",
  ),
  headline(
    "ripples",
    25,
    "a slight perturbance / in the surface of the pond / scatters the tree-line",
  ),
  headline(
    "ripples",
    50,
    "the size of pond waves / is limited by \"fetch\", the / unblocked space for wind",
  ),
  headline(
    "ripples",
    75,
    "ponds are often still, / but you've clicked this one so much / it's more like a lake",
  ),
  headline(
    "ripples",
    100,
    "a sudden splash breaks / the quiet of the evening: / the pond ripples on",
  ),
  headline(
    "ripples",
    125,
    "ripples on the pond / come from bubbles down below / and swimming wildlife",
  ),
];

const SEDIMENT_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "sediment",
    1,
    "Twig falls at the pond; no one hears it.",
  ),
  headline(
    "sediment",
    5,
    "Mosquito family leaves pond for bluer waters.",
  ),
  headline(
    "sediment",
    10,
    "a swirling of mud / from the bottom of the pond / clouds up the water",
  ),
  headline(
    "sediment",
    25,
    "in a Vermont pond, / two enterprising young lads / bring forth cracial glape",
  ),
  headline(
    "sediment",
    50,
    "squishing between toes, / the bottom of a pond is / really pretty gross",
  ),
  headline(
    "sediment",
    75,
    "as things decompose, / nutrients will settle down / in the sediment",
  ),
  headline(
    "sediment",
    100,
    "leeches and larvae, / at the bottom of the pond, / burrow in the muck",
  ),
  headline(
    "sediment",
    125,
    "the age of a pond / can be seen as sediment / builds up over time",
  ),
];

const FUNGI_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "fungi",
    1,
    "lurking in the mud, / fungus waits for dead life to / fall into decay",
  ),
  headline(
    "fungi",
    25,
    "saprotrophic spores / convert the dead into new / minerals and life",
  ),
  headline(
    "fungi",
    50,
    "flakes of fungus drift / in the depths beyond the light, / shedding nutrients",
  ),
  headline(
    "fungi",
    75,
    "Phycomycetes / sounds just like a Greek hero, / but it's pond fungus",
  ),
  headline(
    "fungi",
    100,
    "Oomycetes are / water molds that live in ponds / (not really fungus)",
  ),
];

const MICROBES_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "microbes",
    1,
    "animalcules are / singled-celled primordial / pond organisms",
  ),
  headline(
    "microbes",
    25,
    "microbial mats / stick to rocks and sediment; / exponential growth",
  ),
  headline(
    "microbes",
    50,
    "the latest news on / cyanobacteria / is that it exists",
  ),
  headline(
    "microbes",
    75,
    "The microbes have lofty ambitions for their short life spans.",
  ),
  headline(
    "microbes",
    100,
    "blue-green algae thrives, / coloring the water with / vibrant cyan hues",
  ),
];

const ZOOPLANKTON_HEADLINES: readonly HeadlineDef[] = [
  headline("zooplankton", 1, "Plankton: not just for whales!"),
  headline(
    "zooplankton",
    10,
    "dormant resting eggs / in the sediment give rise / to rotifer swarms",
  ),
  headline(
    "zooplankton",
    25,
    "copepods and fleas / count among the mighty ranks / of pond zooplankton",
  ),
];

const AQUATIC_PLANTS_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "aquatic_plants",
    1,
    "a mat of green plants / drifts amorphously along, / soaking up the sun",
  ),
];

const INVERTEBRATES_HEADLINES: readonly HeadlineDef[] = [
  headline("invertebrates", 1, "Do mosquitos have personalities?"),
  headline(
    "invertebrates",
    10,
    "no spine? no problem! / rent for shells is real cheap; / landlord's not at home.",
  ),
];

const SMALL_SWIMMERS_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "small_swimmers",
    1,
    "little figures dart / to and fro beneath the calm / surface of the pond",
  ),
];

const AMPHIBIANS_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "amphibians",
    1,
    "gelatinous eggs / billow in the sheltered wake / of the shallow muck",
  ),
];

const SMALL_FISH_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "small_fish",
    1,
    "sunlight glints on scales / of a small fish swimming through / lily pads and scum",
  ),
];

const REPTILES_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "reptiles",
    1,
    "slowly paddling, / a turtle peers cautiously / up out of the pond",
  ),
  headline(
    "reptiles",
    25,
    "on a fallen log / turtles space themselves apart, / basking in the sun",
  ),
];

const LARGE_FISH_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "large_fish",
    1,
    "just a dark shadow / down below, then suddenly / you're gone in a splash",
  ),
];

const WATERFOWL_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "waterfowl",
    1,
    "a flotilla of / waxy ducks wafts casually / in the midday sun",
  ),
];

const SHORE_MAMMALS_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "shore_mammals",
    1,
    "scampering ashore, / a flash of fur dashes up / to a low-hung branch",
  ),
];

const HUNTING_BIRDS_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "hunting_birds",
    1,
    "circling above, / an eagle scans the green pond / for a snack below",
  ),
];

const GREAT_MAMMALS_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "great_mammals",
    1,
    "a deer takes a drink / of the water trickling / through an inlet stream",
  ),
];

const HUMANS_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "humans",
    1,
    "the paddle's blade cuts / quietly in the water / spurring the canoe",
  ),
];

const CRYPTIDS_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "cryptids",
    1,
    "unidentified / furry biped stalks the shores / of the moon-lit pond",
  ),
];

const SPIRITS_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "spirits",
    1,
    "the pond's quietude / swells into an eerie wail / haunted by its past",
  ),
];

const LEVIATHANS_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "leviathans",
    1,
    "deeper than you thought, / larger denizens abide / at the pond's bottom",
  ),
];

const ABYSSALS_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "abyssals",
    1,
    "a rift in the muck / at the bottom of the pond / conjures hellish things",
  ),
];

const CELESTIALS_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "celestials",
    1,
    "stars twinkle above, / a crescent moon presiding / over all the pond",
  ),
];

const TRANSCENDENCE_HEADLINES: readonly HeadlineDef[] = [
  headline(
    "transcendence",
    1,
    "where does the pond end? / where it ends and you begin / is right here, right now",
  ),
];

export const HEADLINES_BY_DENIZEN: Readonly<
  Record<string, readonly HeadlineDef[]>
> = {
  ripples: RIPPLES_HEADLINES,
  sediment: SEDIMENT_HEADLINES,
  fungi: FUNGI_HEADLINES,
  microbes: MICROBES_HEADLINES,
  zooplankton: ZOOPLANKTON_HEADLINES,
  aquatic_plants: AQUATIC_PLANTS_HEADLINES,
  invertebrates: INVERTEBRATES_HEADLINES,
  small_swimmers: SMALL_SWIMMERS_HEADLINES,
  amphibians: AMPHIBIANS_HEADLINES,
  small_fish: SMALL_FISH_HEADLINES,
  reptiles: REPTILES_HEADLINES,
  large_fish: LARGE_FISH_HEADLINES,
  waterfowl: WATERFOWL_HEADLINES,
  shore_mammals: SHORE_MAMMALS_HEADLINES,
  hunting_birds: HUNTING_BIRDS_HEADLINES,
  great_mammals: GREAT_MAMMALS_HEADLINES,
  humans: HUMANS_HEADLINES,
  cryptids: CRYPTIDS_HEADLINES,
  spirits: SPIRITS_HEADLINES,
  leviathans: LEVIATHANS_HEADLINES,
  abyssals: ABYSSALS_HEADLINES,
  celestials: CELESTIALS_HEADLINES,
  transcendence: TRANSCENDENCE_HEADLINES,
};

export const HEADLINE_DENIZEN_IDS: readonly string[] = DENIZENS.map(
  (d) => d.id,
).filter((id) => (HEADLINES_BY_DENIZEN[id]?.length ?? 0) > 0);

/** Flat catalog in ecological denizen order. */
export const HEADLINES: readonly HeadlineDef[] = HEADLINE_DENIZEN_IDS.flatMap(
  (denizenId) => HEADLINES_BY_DENIZEN[denizenId] ?? [],
);

export const HEADLINE_IDS = new Set(HEADLINES.map((h) => h.id));

export function getHeadlineDef(id: string): HeadlineDef | undefined {
  return HEADLINES.find((h) => h.id === id);
}

export function headlinesForDenizen(
  denizenId: string,
): readonly HeadlineDef[] {
  return HEADLINES_BY_DENIZEN[denizenId] ?? [];
}

/** Haiku headlines use ` / ` between lines in the catalog source string. */
export function headlineDisplayLines(text: string): string[] {
  if (!text.includes("/")) return [text];
  return text
    .split(/\s*\/\s*/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Highest-tier headline unlocked for a denizen at the current owned count. */
export function activeHeadlineForDenizen(
  owned: Record<string, number>,
  denizenId: string,
): HeadlineDef | undefined {
  const count = getOwnedDenizenCount(owned, denizenId);
  if (count < 1) return undefined;

  const headlines = headlinesForDenizen(denizenId);
  let active: HeadlineDef | undefined;
  for (const def of headlines) {
    if (count >= def.unlockOwned) active = def;
    else break;
  }
  return active;
}

export type HeadlineRotationCandidate = {
  denizenId: string;
  headline: HeadlineDef;
};

/** One candidate per owned denizen — its highest unlocked headline. */
export function buildHeadlineRotationCandidates(
  owned: Record<string, number>,
): HeadlineRotationCandidate[] {
  const candidates: HeadlineRotationCandidate[] = [];
  for (const def of DENIZENS) {
    const headline = activeHeadlineForDenizen(owned, def.id);
    if (headline) {
      candidates.push({ denizenId: def.id, headline });
    }
  }
  return candidates;
}

export function pickNextHeadlineRotation(
  owned: Record<string, number>,
  previous: HeadlineRotationSelection | null,
  rng: () => number = Math.random,
): HeadlineRotationSelection | null {
  const candidates = buildHeadlineRotationCandidates(owned);
  if (candidates.length === 0) return null;

  let pool = candidates;
  if (previous) {
    const withoutSameHeadline = candidates.filter(
      (c) => c.headline.id !== previous.headlineId,
    );
    if (withoutSameHeadline.length > 0) pool = withoutSameHeadline;

    const withoutSameDenizen = pool.filter(
      (c) => c.denizenId !== previous.denizenId,
    );
    if (withoutSameDenizen.length > 0) pool = withoutSameDenizen;
  }

  const pick = pool[Math.floor(rng() * pool.length)]!;
  return {
    denizenId: pick.denizenId,
    headlineId: pick.headline.id,
  };
}

/** Staff catalog — global headline behavior. */
export const HEADLINE_CATALOG_GLOBAL_NOTES: readonly string[] = [
  "Shown in the headline strip when no milestone celebration cards are visible",
  "Rotates featured denizen every 2 minutes from denizens you own (1+ copies)",
  "Displays the highest owned-count tier headline for the featured denizen (updates live as count changes)",
  "Prefers a different headline and denizen on each rotation when alternatives exist",
];

/** Staff catalog — per-headline unlock requirements. */
export function headlineUnlockCriteriaText(def: HeadlineDef): string {
  const denizen = getDenizenDef(def.denizenId);
  const label = denizen?.namePlural ?? def.denizenId;
  return `Own ${def.unlockOwned}+ ${label}`;
}
