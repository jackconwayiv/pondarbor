import {
  DENIZENS,
  denizenFirstWelcomeDescription,
  getDenizenDef,
  getOwnedDenizenCount,
  type DenizenDef,
} from "./denizens";
import {
  ENERGY_EMOJI,
  formatEnergyAmount,
  SHORT_SCALE_THRESHOLDS,
} from "./formatEnergy";
import { getMutationLevel } from "./mutagens";
import {
  DENIZEN_COUNT_TITLES,
  ENERGY_PER_CLICK_TITLES,
  EPS_TITLES,
  EVOLUTION_COUNT_TITLES,
  POLLINATOR_EVOLUTION_COUNT_TITLES,
  MUTATION_TITLES,
  WEATHER_CLICK_THRESHOLDS,
  WEATHER_RAIN_TITLES,
  WEATHER_SUN_TITLES,
  WEATHER_TOTAL_TITLES,
  WEATHER_WIND_TITLES,
  type MilestoneTitleEntry,
  type WeatherClickThreshold,
} from "./milestoneTitles";
import { POND_PRODUCTION_EMOJI } from "./clicker2OwnedEvolutions";
import { POLLINATOR_SPECIALTY_DENIZEN_ID } from "./pollinatorEvolutions";
import {
  POND_SPECIALTY_DENIZEN_ID,
  specialtiesForDenizen,
} from "./specialties";

const POLLINATOR_CHAIN_MILESTONE_EMOJI = "🐝";

export const MILESTONE_MILLION = 1_000_000;
export const MILESTONE_OCTILLION = 1e27;

export type MilestoneKind =
  | "pond_energy"
  | "lifetime_energy"
  | "energy_per_second"
  | "energy_per_click"
  | "total_clicks"
  | "weather_clicked"
  | "weather_sun_clicked"
  | "weather_wind_clicked"
  | "weather_rain_clicked"
  | "evolution_count"
  | "denizen_first"
  | "denizen_count"
  | "mutation";

export type MilestoneDef = {
  id: string;
  kind: MilestoneKind;
  title: string;
  description: string;
  /** Short unlock rule for staff catalog and locked stats rows. */
  criteriaText: string;
  denizenId?: string;
  /** For denizen_count / mutation kinds. */
  /** Pond spendable energy threshold (`pond_energy` kind). */
  threshold?: number;
};

function pondEnergyMilestone(
  id: string,
  title: string,
  threshold: number,
  proseAmount: string,
  criteriaAmount: string,
): MilestoneDef {
  return {
    id,
    kind: "pond_energy",
    title,
    description: `Store ${proseAmount} or more energy in your pond.`,
    criteriaText: `Store ${criteriaAmount}+ energy in the pond`,
    threshold,
  };
}

function pondEnergyScaleMilestone(
  label: string,
  threshold: number,
): MilestoneDef {
  const title = `${label.charAt(0).toUpperCase()}${label.slice(1)}aire`;
  return pondEnergyMilestone(
    `${label}aire`,
    title,
    threshold,
    `one ${label}`,
    `1 ${label}`,
  );
}

function clickCountMilestone(
  id: string,
  title: string,
  threshold: number,
  timesPhrase: string,
): MilestoneDef {
  return {
    id,
    kind: "total_clicks",
    title,
    description: `Click ${timesPhrase} times.`,
    criteriaText: `Click ${timesPhrase} times`,
    threshold,
  };
}

function clickShortScaleMilestone(
  label: string,
  threshold: number,
): MilestoneDef {
  return clickCountMilestone(
    `click${label}`,
    `Click${label}`,
    threshold,
    `one ${label}`,
  );
}

export const TOTAL_CLICK_MILESTONES: readonly MilestoneDef[] = [
  clickCountMilestone(
    "get_clicking",
    "Get Clicking!",
    100,
    "100",
  ),
  clickCountMilestone("clickthousand", "Clickthousand", 1_000, "1,000"),
  clickCountMilestone("clicktenthousand", "Clicktenthousand", 10_000, "10,000"),
  clickCountMilestone(
    "clickhundredthousand",
    "Clickhundredthousand",
    100_000,
    "100,000",
  ),
  ...SHORT_SCALE_THRESHOLDS.map(({ label, threshold }) =>
    clickShortScaleMilestone(label, threshold),
  ),
];

export const POND_ENERGY_MILESTONES: readonly MilestoneDef[] = [
  pondEnergyMilestone("hundredaire", "Hundredaire", 100, "one hundred", "100"),
  pondEnergyMilestone(
    "thousandaire",
    "Thousandaire",
    1_000,
    "one thousand",
    "1,000",
  ),
  pondEnergyMilestone(
    "ten_thousandaire",
    "Ten-Thousandaire",
    10_000,
    "ten thousand",
    "10,000",
  ),
  pondEnergyMilestone(
    "hundred_thousandaire",
    "Hundred-Thousandaire",
    100_000,
    "one hundred thousand",
    "100,000",
  ),
  pondEnergyMilestone(
    "millionaire",
    "Millionaire",
    MILESTONE_MILLION,
    "one million",
    "1 million",
  ),
  ...SHORT_SCALE_THRESHOLDS.filter(({ label }) => label !== "million").map(
    ({ label, threshold }) => pondEnergyScaleMilestone(label, threshold),
  ),
];

const LIFETIME_ENERGY_TITLE_OVERRIDES: Partial<
  Record<string, { id: string; title: string }>
> = {
  million: { id: "pretty_penny", title: "Pretty Penny" },
  octillion: { id: "octogenarian", title: "Octogenarian" },
};

function lifetimeEnergyCountMilestone(
  id: string,
  title: string,
  threshold: number,
  amountPhrase: string,
): MilestoneDef {
  return {
    id,
    kind: "lifetime_energy",
    title,
    description: `Earn ${amountPhrase} total energy.`,
    criteriaText: `Earn ${amountPhrase} total energy`,
    threshold,
  };
}

function lifetimeEnergyMilestone(
  label: string,
  threshold: number,
): MilestoneDef {
  const override = LIFETIME_ENERGY_TITLE_OVERRIDES[label];
  const id = override?.id ?? `lifetime_${label}`;
  const title =
    override?.title ??
    `${label.charAt(0).toUpperCase()}${label.slice(1)} Earned`;
  return {
    id,
    kind: "lifetime_energy",
    title,
    description: `Earn one ${label} total energy.`,
    criteriaText: `Earn 1 ${label} total energy`,
    threshold,
  };
}

export const LIFETIME_ENERGY_MILESTONES: readonly MilestoneDef[] = [
  lifetimeEnergyCountMilestone(
    "just_getting_started",
    "Just Getting Started!",
    1_000,
    "1,000",
  ),
  lifetimeEnergyCountMilestone(
    "five_thousand_energy",
    "Five Thousand Energy!",
    5_000,
    "5,000",
  ),
  lifetimeEnergyCountMilestone("enerjeeze", "Enerjeeze!", 10_000, "10,000"),
  lifetimeEnergyCountMilestone(
    "things_are_moving",
    "Things are Moving!",
    25_000,
    "25,000",
  ),
  lifetimeEnergyCountMilestone("energetic", "Energetic!", 50_000, "50,000"),
  lifetimeEnergyCountMilestone("energized", "Energized!", 100_000, "100,000"),
  lifetimeEnergyCountMilestone(
    "making_bank",
    "Making Bank",
    250_000,
    "250,000",
  ),
  lifetimeEnergyCountMilestone("half_a_mil", "Half a Mil", 500_000, "500,000"),
  ...SHORT_SCALE_THRESHOLDS.map(({ label, threshold }) =>
    lifetimeEnergyMilestone(label, threshold),
  ),
];

/** EpS thresholds through quadrillion, then short-scale steps (quintillion+). */
export const ENERGY_PER_SECOND_MILESTONE_THRESHOLDS: readonly number[] = [
  5,
  10,
  25,
  50,
  100,
  250,
  500,
  1_000,
  2_500,
  5_000,
  10_000,
  50_000,
  100_000,
  500_000,
  1_000_000,
  10_000_000,
  100_000_000,
  1_000_000_000,
  1_000_000_000_000,
  1_000_000_000_000_000,
  ...SHORT_SCALE_THRESHOLDS.filter(({ threshold }) => threshold > 1e15).map(
    ({ threshold }) => threshold,
  ),
];

function epsAmountPhrase(threshold: number): string {
  if (threshold < MILESTONE_MILLION) {
    return threshold.toLocaleString("en-US");
  }
  return formatEnergyAmount(threshold);
}

function energyPerSecondMilestoneId(threshold: number): string {
  const entry = EPS_TITLES[threshold];
  if (entry?.id) return entry.id;
  const scale = SHORT_SCALE_THRESHOLDS.find((s) => s.threshold === threshold);
  if (scale) return `eps_${scale.label}`;
  return `eps_${threshold}`;
}

function energyPerSecondMilestoneTitle(threshold: number): string {
  const entry = EPS_TITLES[threshold];
  if (entry) return entry.title;
  return `${epsAmountPhrase(threshold)} per Second`;
}

function energyPerSecondMilestone(threshold: number): MilestoneDef {
  const amount = epsAmountPhrase(threshold);
  return {
    id: energyPerSecondMilestoneId(threshold),
    kind: "energy_per_second",
    title: energyPerSecondMilestoneTitle(threshold),
    description: `Reach ${amount} energy per second.`,
    criteriaText: `Reach ${amount}+ energy per second`,
    threshold,
  };
}

export const ENERGY_PER_SECOND_MILESTONES: readonly MilestoneDef[] =
  ENERGY_PER_SECOND_MILESTONE_THRESHOLDS.map((threshold) =>
    energyPerSecondMilestone(threshold),
  );

export const ENERGY_PER_CLICK_MILESTONE_THRESHOLDS: readonly number[] = [
  5, 50, 100, 250, 500, 750, 1_000, 2_500, 5_000, 10_000, 100_000, 1_000_000,
] as const;

function energyPerClickAmountPhrase(threshold: number): string {
  if (threshold < MILESTONE_MILLION) {
    return threshold.toLocaleString("en-US");
  }
  return formatEnergyAmount(threshold);
}

function energyPerClickMilestone(threshold: number): MilestoneDef {
  const entry = ENERGY_PER_CLICK_TITLES[threshold];
  const amount = energyPerClickAmountPhrase(threshold);
  return {
    id: entry?.id ?? `energy_per_click_${threshold}`,
    kind: "energy_per_click",
    title: entry?.title ?? `${amount} per Click`,
    description: `Reach ${amount} energy per click.`,
    criteriaText: `Reach ${amount}+ energy per click`,
    threshold,
  };
}

export const ENERGY_PER_CLICK_MILESTONES: readonly MilestoneDef[] =
  ENERGY_PER_CLICK_MILESTONE_THRESHOLDS.map((threshold) =>
    energyPerClickMilestone(threshold),
  );

export type MilestoneEvalContext = {
  energyInPond: number;
  allTimeEnergyEarned: number;
  energyPerSecond: number;
  energyPerClick: number;
  totalClicks: number;
  weatherEventsClicked: number;
  weatherSunClicked: number;
  weatherWindClicked: number;
  weatherRainClicked: number;
  ownedSpecialties: Record<number, boolean>;
  ownedDenizens: Record<string, number>;
  denizenMutationLevels: Record<string, number>;
};

function weatherClickCountPhrase(threshold: number): string {
  return threshold.toLocaleString("en-US");
}

type WeatherMilestoneTrack = {
  kind:
    | "weather_clicked"
    | "weather_sun_clicked"
    | "weather_wind_clicked"
    | "weather_rain_clicked";
  idPrefix: "weather_total" | "weather_sun" | "weather_wind" | "weather_rain";
  titles: Readonly<Record<WeatherClickThreshold, MilestoneTitleEntry>>;
  eventLabel: string;
};

const WEATHER_MILESTONE_TRACKS: readonly WeatherMilestoneTrack[] = [
  {
    kind: "weather_clicked",
    idPrefix: "weather_total",
    titles: WEATHER_TOTAL_TITLES,
    eventLabel: "weather event",
  },
  {
    kind: "weather_sun_clicked",
    idPrefix: "weather_sun",
    titles: WEATHER_SUN_TITLES,
    eventLabel: "sunny weather event",
  },
  {
    kind: "weather_wind_clicked",
    idPrefix: "weather_wind",
    titles: WEATHER_WIND_TITLES,
    eventLabel: "windy weather event",
  },
  {
    kind: "weather_rain_clicked",
    idPrefix: "weather_rain",
    titles: WEATHER_RAIN_TITLES,
    eventLabel: "rainy weather event",
  },
];

function weatherClickMilestone(
  track: WeatherMilestoneTrack,
  threshold: WeatherClickThreshold,
): MilestoneDef {
  const titleEntry = track.titles[threshold];
  const count = weatherClickCountPhrase(threshold);
  const plural = threshold === 1 ? track.eventLabel : `${track.eventLabel}s`;
  return {
    id: titleEntry.id ?? `${track.idPrefix}_${threshold}`,
    kind: track.kind,
    title: titleEntry.title,
    description:
      threshold === 1
        ? `Click a ${track.eventLabel}.`
        : `Click ${count} ${plural}.`,
    criteriaText:
      threshold === 1
        ? `Click 1 ${track.eventLabel}`
        : `Click ${count} ${plural}`,
    threshold,
  };
}

export function buildWeatherClickMilestones(): MilestoneDef[] {
  return WEATHER_MILESTONE_TRACKS.flatMap((track) =>
    WEATHER_CLICK_THRESHOLDS.map((threshold) =>
      weatherClickMilestone(track, threshold),
    ),
  );
}

export const WEATHER_CLICK_MILESTONES: readonly MilestoneDef[] =
  buildWeatherClickMilestones();

export { WEATHER_CLICK_THRESHOLDS } from "./milestoneTitles";

function countOwnedEvolutionsInChain(
  ownedSpecialties: Record<number, boolean>,
  denizenId: string,
): number {
  return specialtiesForDenizen(denizenId).filter((s) => ownedSpecialties[s.id])
    .length;
}

export function evolutionChainDenizenIds(): readonly string[] {
  const ids: string[] = [POND_SPECIALTY_DENIZEN_ID];
  for (const def of DENIZENS) {
    if (specialtiesForDenizen(def.id).length > 0) {
      ids.push(def.id);
    }
  }
  return ids;
}

function evolutionChainNames(denizenId: string): {
  prose: string;
  criteria: string;
} {
  if (denizenId === POND_SPECIALTY_DENIZEN_ID) {
    return { prose: "pond production", criteria: "Pond production" };
  }
  if (denizenId === POLLINATOR_SPECIALTY_DENIZEN_ID) {
    return { prose: "pollinators", criteria: "Pollinator" };
  }
  const def = getDenizenDef(denizenId);
  if (!def) return { prose: denizenId, criteria: denizenId };
  return { prose: def.namePlural.toLowerCase(), criteria: def.name };
}

const EVOLUTION_COUNT_THRESHOLDS = [1, 5, 10, 15] as const;

const EVOLUTION_COUNT_MILESTONE_OVERRIDES: Partial<
  Record<string, Partial<Pick<MilestoneDef, "title" | "description" | "criteriaText">>>
> = {
  ripples_1: {
    title: "Skipping Stone",
    description: "Evolve your ripples.",
    criteriaText: "Evolve your Ripple",
  },
  sediment_1: {
    title: "Sludge Trudger",
    description: "Evolve your sediment.",
    criteriaText: "Evolve your Sediment",
  },
};

function evolutionCountMilestone(
  denizenId: string,
  threshold: number,
): MilestoneDef {
  const key = `${denizenId}_${threshold}`;
  const copyOverride = EVOLUTION_COUNT_MILESTONE_OVERRIDES[key];
  const titleEntry = EVOLUTION_COUNT_TITLES[key];
  const { prose, criteria } = evolutionChainNames(denizenId);
  const id =
    titleEntry?.id ?? `evolution_count_${denizenId}_${threshold}`;
  const description =
    copyOverride?.description ??
    (threshold === 1
      ? `Evolve your ${prose}.`
      : `Evolve your ${prose} ${threshold} times.`);
  const criteriaText =
    copyOverride?.criteriaText ??
    (threshold === 1
      ? `Evolve your ${criteria}`
      : `Evolve your ${criteria} ${threshold} times`);

  return {
    id,
    kind: "evolution_count",
    title:
      titleEntry?.title ?? `${threshold} ${criteria} Evolutions`,
    description,
    criteriaText,
    denizenId,
    threshold,
  };
}

export function buildEvolutionCountMilestones(): MilestoneDef[] {
  return evolutionChainDenizenIds().flatMap((denizenId) =>
    EVOLUTION_COUNT_THRESHOLDS.map((threshold) =>
      evolutionCountMilestone(denizenId, threshold),
    ),
  );
}

const POLLINATOR_EVOLUTION_COUNT_THRESHOLDS = [1, 5, 10, 15, 20] as const;

function pollinatorEvolutionCountMilestone(threshold: number): MilestoneDef {
  const denizenId = POLLINATOR_SPECIALTY_DENIZEN_ID;
  const key = `${denizenId}_${threshold}`;
  const titleEntry = POLLINATOR_EVOLUTION_COUNT_TITLES[key];
  const base = evolutionCountMilestone(denizenId, threshold);
  return {
    ...base,
    id: titleEntry?.id ?? base.id,
    title: titleEntry?.title ?? base.title,
  };
}

export function buildPollinatorEvolutionCountMilestones(): MilestoneDef[] {
  return POLLINATOR_EVOLUTION_COUNT_THRESHOLDS.map((threshold) =>
    pollinatorEvolutionCountMilestone(threshold),
  );
}

const DENIZEN_FIRST_MILESTONE_OVERRIDES: Partial<
  Record<string, Partial<Pick<MilestoneDef, "title" | "description">>>
> = {
  ripples: { title: "Single Drop" },
  sediment: { title: "Into the Muck" },
  fungi: { title: "Fungus Amongus" },
  microbes: { title: "It's Alive!" },
  zooplankton: { title: "Microscopic Zoo" },
  aquatic_plants: { title: "No Pots Please" },
  invertebrates: { title: "Slow and Steady" },
  small_swimmers: { title: "Toe-Ticklers" },
  amphibians: { title: "Hop to It" },
  small_fish: { title: "Now It's a Pond" },
  reptiles: { title: "Cowabunga!" },
  large_fish: { title: "Head to the Bait Shop" },
  waterfowl: { title: "Honking Great" },
  shore_mammals: { title: "Shoreline Scampering" },
  hunting_birds: { title: "Keeping Watch" },
  great_mammals: { title: "Watering Hole" },
  humans: { title: "On Golden Pond" },
  cryptids: { title: "Bigfoot Sighting" },
  spirits: { title: "Haunted Waters" },
  leviathans: { title: "Deeper than You Thought" },
  abyssals: { title: "Way Too Deep" },
  celestials: { title: "Light of the Stars" },
  transcendence: { title: "One with the Pond" },
};

const DENIZEN_MUTATION_THRESHOLDS = [1, 5, 10] as const;

export type DenizenMutationMilestoneThreshold =
  (typeof DENIZEN_MUTATION_THRESHOLDS)[number];

const DENIZEN_MUTATION_MILESTONE_COPY_OVERRIDES: Partial<
  Record<string, Partial<Pick<MilestoneDef, "description" | "criteriaText">>>
> = {
  microbes_1: {
    description: "Mutate your microbes.",
    criteriaText: "Mutate your Microbes",
  },
};

function denizenMutationDescription(
  def: DenizenDef,
  threshold: DenizenMutationMilestoneThreshold,
): string {
  const singular = def.name.toLowerCase();
  if (threshold === 1) return `Mutate your ${singular}.`;
  if (threshold === 5) return `Mutate your ${singular} five times.`;
  return `Mutate your ${singular} ten times.`;
}

function denizenMutationCriteriaText(
  def: DenizenDef,
  threshold: DenizenMutationMilestoneThreshold,
): string {
  if (threshold === 1) return `Mutate your ${def.name}`;
  return `Reach ${threshold} mutations on ${def.name}`;
}

function denizenMutationMilestone(
  def: DenizenDef,
  threshold: DenizenMutationMilestoneThreshold,
): MilestoneDef {
  const key = `${def.id}_${threshold}`;
  const copyOverride = DENIZEN_MUTATION_MILESTONE_COPY_OVERRIDES[key];
  const titleEntry = MUTATION_TITLES[key];
  const id = titleEntry?.id ?? `mutate_${def.id}_${threshold}`;

  return {
    id,
    kind: "mutation",
    title:
      titleEntry?.title ??
      (threshold === 1
        ? `Mutate ${def.name}`
        : `Mutate ${def.name} ×${threshold}`),
    description:
      copyOverride?.description ?? denizenMutationDescription(def, threshold),
    criteriaText:
      copyOverride?.criteriaText ?? denizenMutationCriteriaText(def, threshold),
    denizenId: def.id,
    threshold,
  };
}

export function buildDenizenMutationMilestones(): MilestoneDef[] {
  return DENIZENS.flatMap((def) =>
    DENIZEN_MUTATION_THRESHOLDS.map((threshold) =>
      denizenMutationMilestone(def, threshold),
    ),
  );
}

const DENIZEN_COUNT_THRESHOLDS = [50, 100, 500, 1000, 2000] as const;

const DENIZEN_COUNT_PROSE: Record<number, string> = {
  50: "fifty",
  100: "a hundred",
  500: "five hundred",
  1000: "a thousand",
  2000: "two thousand",
};

const DENIZEN_COUNT_CRITERIA_AMOUNT: Record<number, string> = {
  50: "50",
  100: "100",
  500: "500",
  1000: "1,000",
  2000: "2,000",
};

const DENIZEN_COUNT_MILESTONE_COPY_OVERRIDES: Partial<
  Record<string, Partial<Pick<MilestoneDef, "description" | "criteriaText">>>
> = {
  ripples_100: {
    description: "Own a hundred ripples.",
    criteriaText: "Own 100 Ripples",
  },
};

function denizenCountMilestone(
  def: DenizenDef,
  threshold: number,
): MilestoneDef {
  const key = `${def.id}_${threshold}`;
  const copyOverride = DENIZEN_COUNT_MILESTONE_COPY_OVERRIDES[key];
  const titleEntry = DENIZEN_COUNT_TITLES[key];
  const plural = def.namePlural;
  const pluralLower = plural.toLowerCase();
  const amount = DENIZEN_COUNT_CRITERIA_AMOUNT[threshold] ?? String(threshold);
  const prose = DENIZEN_COUNT_PROSE[threshold] ?? amount;
  const id = titleEntry?.id ?? `denizen_count_${def.id}_${threshold}`;

  return {
    id,
    kind: "denizen_count",
    title: titleEntry?.title ?? `${amount} ${plural}`,
    description: copyOverride?.description ?? `Own ${prose} ${pluralLower}.`,
    criteriaText: copyOverride?.criteriaText ?? `Own ${amount} ${plural}`,
    denizenId: def.id,
    threshold,
  };
}

export function buildDenizenCountMilestones(): MilestoneDef[] {
  return DENIZENS.flatMap((def) =>
    DENIZEN_COUNT_THRESHOLDS.map((threshold) =>
      denizenCountMilestone(def, threshold),
    ),
  );
}

function denizenFirstMilestone(def: DenizenDef): MilestoneDef {
  const id = `denizen_first_${def.id}`;
  const override = DENIZEN_FIRST_MILESTONE_OVERRIDES[def.id];
  return {
    id,
    kind: "denizen_first",
    title: override?.title ?? `${def.name} arrives`,
    description:
      override?.description ?? denizenFirstWelcomeDescription(def),
    criteriaText: `Own at least one ${def.name}`,
    denizenId: def.id,
    threshold: 1,
  };
}

export const GLOBAL_MILESTONES: readonly MilestoneDef[] = [
  ...POND_ENERGY_MILESTONES,
  ...TOTAL_CLICK_MILESTONES,
  ...LIFETIME_ENERGY_MILESTONES,
  ...ENERGY_PER_SECOND_MILESTONES,
  ...ENERGY_PER_CLICK_MILESTONES,
];

export function buildDenizenFirstMilestones(): MilestoneDef[] {
  return DENIZENS.map(denizenFirstMilestone);
}

export const MILESTONES: readonly MilestoneDef[] = [
  ...GLOBAL_MILESTONES,
  ...WEATHER_CLICK_MILESTONES,
  ...buildEvolutionCountMilestones(),
  ...buildPollinatorEvolutionCountMilestones(),
  ...buildDenizenCountMilestones(),
  ...buildDenizenMutationMilestones(),
  ...buildDenizenFirstMilestones(),
];

/** Staff catalog: group milestones by unlock function (not denizen chain). */
export type MilestoneCatalogSectionId =
  | "pond_energy"
  | "total_clicks"
  | "energy_per_second"
  | "energy_per_click"
  | "weather_clicked"
  | "weather_sun_clicked"
  | "weather_wind_clicked"
  | "weather_rain_clicked"
  | "evolution_count"
  | "denizen_first"
  | "denizen_count"
  | "mutation"
  | "lifetime_energy";

export type MilestoneCatalogSection = {
  id: MilestoneCatalogSectionId;
  label: string;
  emoji: string;
  blurb: string;
};

export const MILESTONE_CATALOG_SECTIONS: readonly MilestoneCatalogSection[] = [
  {
    id: "pond_energy",
    label: "Pond energy",
    emoji: "⚡",
    blurb: "Spendable energy held in the pond at once.",
  },
  {
    id: "total_clicks",
    label: "Clicking",
    emoji: "👆",
    blurb: "Total pond clicks across the save.",
  },
  {
    id: "energy_per_second",
    label: "Energy per second",
    emoji: "⚡",
    blurb: "Passive energy production rate in the pond.",
  },
  {
    id: "energy_per_click",
    label: "Energy per click",
    emoji: "👆",
    blurb: "Energy gained from each pond click (before weather boosts).",
  },
  {
    id: "weather_clicked",
    label: "Weather",
    emoji: "🌦️",
    blurb: "Click floating weather events of any kind.",
  },
  {
    id: "weather_sun_clicked",
    label: "Sunny weather",
    emoji: "☀️",
    blurb: "Click sunny weather events.",
  },
  {
    id: "weather_wind_clicked",
    label: "Windy weather",
    emoji: "💨",
    blurb: "Click windy weather events.",
  },
  {
    id: "weather_rain_clicked",
    label: "Rainy weather",
    emoji: "🌧️",
    blurb: "Click rainy weather events.",
  },
  {
    id: "evolution_count",
    label: "Evolution count",
    emoji: "✨",
    blurb: "Own evolutions in a denizen or pond production chain.",
  },
  {
    id: "denizen_first",
    label: "First denizen",
    emoji: "🫧",
    blurb: "Own the first copy of each denizen type.",
  },
  {
    id: "denizen_count",
    label: "Denizen count",
    emoji: "🌊",
    blurb: "Own a target number of copies of one denizen.",
  },
  {
    id: "mutation",
    label: "Mutation",
    emoji: "🦠",
    blurb: "Apply mutagens to a denizen.",
  },
  {
    id: "lifetime_energy",
    label: "Lifetime energy",
    emoji: "⚡",
    blurb: "All-time energy earned across the pond.",
  },
];

export function milestonesInCatalogSection(
  sectionId: MilestoneCatalogSectionId,
): MilestoneDef[] {
  if (sectionId === "lifetime_energy") {
    return MILESTONES.filter((m) => m.kind === "lifetime_energy");
  }
  return MILESTONES.filter((m) => m.kind === sectionId);
}

export const MILESTONE_IDS = new Set(MILESTONES.map((m) => m.id));

/** Legacy milestone ids remapped on load (title refresh; same thresholds). */
const MILESTONE_ID_ALIASES: Readonly<Record<string, string>> = {
  eps_quarter_k: "eps_steady_stream",
  eps_half_k_flow: "eps_trickle_down_tonic",
  eps_two_point_five_k: "eps_algal_autobahn",
  eps_five_k: "eps_pond_flow_pumping",
  eps_ten_k: "eps_benthic_beat",
  eps_fifty_k: "eps_rhythmic_ripple_rate",
  eps_hundred_k: "eps_constant_current_club",
  eps_half_mil_flow: "eps_steady_state_swamp",
  eps_million_per_second: "eps_marsh_metabolism",
  eps_10_million_per_second: "eps_ecosystem_engine",
  eps_100_million_per_second: "eps_the_constant_current",
  eps_quadrillion: "eps_grand_torrent",
  eps_quintillion: "eps_perpetual_pond_power",
  eps_sextillion: "eps_marshland_momentum",
  eps_septillion: "eps_eternal_tide",
  eps_octillion: "eps_bioluminescent_burst",
  eps_nonillion: "eps_high_velocity_habitat",
  eps_decillion: "eps_infinite_influx",
  eps_undecillion: "eps_flow_state",
  eps_duodecillion: "eps_velocity_vole",
  eps_tredecillion: "eps_hydro_pulse_harmony",
  eps_quattuordecillion: "eps_current_core",
  eps_quindecillion: "eps_lily_pad_grid",
  eps_sexdecillion: "eps_benthic_bloom_booster",
  eps_septendecillion: "eps_sunbeam_soaker",
  eps_octodecillion: "eps_photosynthesis_party",
  eps_novemdecillion: "eps_ripple_runner",
  eps_vigintillion: "eps_pond_power_prime",
  eps_unvigintillion: "eps_total_pond_voltage",
};

function resolveMilestoneId(id: string): string {
  return MILESTONE_ID_ALIASES[id] ?? id;
}

export function isKnownMilestoneId(id: string): boolean {
  return MILESTONE_IDS.has(id) || MILESTONE_ID_ALIASES[id] != null;
}

export function getMilestoneDef(id: string): MilestoneDef | undefined {
  return MILESTONES.find((m) => m.id === id);
}

const CLICK_MILESTONE_EMOJI = "👆";
const WEATHER_MILESTONE_EMOJI = "🌦️";
const WEATHER_SUN_MILESTONE_EMOJI = "☀️";
const WEATHER_WIND_MILESTONE_EMOJI = "💨";
const WEATHER_RAIN_MILESTONE_EMOJI = "🌧️";

function usesEnergyEmoji(def: MilestoneDef): boolean {
  return (
    def.kind === "pond_energy" ||
    def.kind === "lifetime_energy" ||
    def.kind === "energy_per_second"
  );
}

/** Emoji for milestone UI: ⚡ for energy globals, denizen emoji when applicable. */
export function milestoneDisplayEmoji(def: MilestoneDef): string | undefined {
  if (usesEnergyEmoji(def)) return ENERGY_EMOJI;
  if (def.kind === "total_clicks" || def.kind === "energy_per_click") {
    return CLICK_MILESTONE_EMOJI;
  }
  if (def.kind === "weather_clicked") return WEATHER_MILESTONE_EMOJI;
  if (def.kind === "weather_sun_clicked") return WEATHER_SUN_MILESTONE_EMOJI;
  if (def.kind === "weather_wind_clicked") return WEATHER_WIND_MILESTONE_EMOJI;
  if (def.kind === "weather_rain_clicked") return WEATHER_RAIN_MILESTONE_EMOJI;
  if (def.denizenId === POND_SPECIALTY_DENIZEN_ID) return POND_PRODUCTION_EMOJI;
  if (def.denizenId === POLLINATOR_SPECIALTY_DENIZEN_ID) {
    return POLLINATOR_CHAIN_MILESTONE_EMOJI;
  }
  if (def.denizenId) return getDenizenDef(def.denizenId)?.emoji;
  return undefined;
}

export function isMilestoneMet(def: MilestoneDef, ctx: MilestoneEvalContext): boolean {
  switch (def.kind) {
    case "pond_energy":
      return def.threshold != null && ctx.energyInPond >= def.threshold;
    case "total_clicks":
      return def.threshold != null && ctx.totalClicks >= def.threshold;
    case "weather_clicked":
      return (
        def.threshold != null && ctx.weatherEventsClicked >= def.threshold
      );
    case "weather_sun_clicked":
      return def.threshold != null && ctx.weatherSunClicked >= def.threshold;
    case "weather_wind_clicked":
      return def.threshold != null && ctx.weatherWindClicked >= def.threshold;
    case "weather_rain_clicked":
      return def.threshold != null && ctx.weatherRainClicked >= def.threshold;
    case "evolution_count":
      if (!def.denizenId || def.threshold == null) return false;
      return (
        countOwnedEvolutionsInChain(ctx.ownedSpecialties, def.denizenId) >=
        def.threshold
      );
    case "lifetime_energy":
      return def.threshold != null && ctx.allTimeEnergyEarned >= def.threshold;
    case "energy_per_second":
      return def.threshold != null && ctx.energyPerSecond >= def.threshold;
    case "energy_per_click":
      return def.threshold != null && ctx.energyPerClick >= def.threshold;
    case "denizen_first": {
      if (!def.denizenId) return false;
      return getOwnedDenizenCount(ctx.ownedDenizens, def.denizenId) >= 1;
    }
    case "denizen_count": {
      if (!def.denizenId || def.threshold == null) return false;
      return (
        getOwnedDenizenCount(ctx.ownedDenizens, def.denizenId) >= def.threshold
      );
    }
    case "mutation": {
      if (!def.denizenId || def.threshold == null) return false;
      return (
        getMutationLevel(ctx.denizenMutationLevels, def.denizenId) >=
        def.threshold
      );
    }
    default:
      return false;
  }
}

export function evaluateNewMilestones(
  ctx: MilestoneEvalContext,
  alreadyReached: Record<string, number>,
): string[] {
  const newly: string[] = [];
  for (const def of MILESTONES) {
    if (alreadyReached[def.id] != null) continue;
    if (isMilestoneMet(def, ctx)) {
      newly.push(def.id);
    }
  }
  return newly;
}

export function countMilestonesReached(
  reached: Record<string, number>,
): number {
  let n = 0;
  for (const def of MILESTONES) {
    if (reached[def.id] != null) n += 1;
  }
  return n;
}

/** Newest earned first; when `reachedAtMs` ties, later catalog entries rank newer. */
export function compareMilestoneReachedTimes(
  a: { id: string; reachedAtMs: number },
  b: { id: string; reachedAtMs: number },
): number {
  if (b.reachedAtMs !== a.reachedAtMs) return b.reachedAtMs - a.reachedAtMs;
  return (
    MILESTONES.findIndex((m) => m.id === b.id) -
    MILESTONES.findIndex((m) => m.id === a.id)
  );
}

/** Earned milestones whose celebration has not been dismissed (newest first). */
export function celebrationMilestoneDefs(
  reached: Record<string, number>,
  dismissed: Record<string, true>,
): MilestoneDef[] {
  const out: MilestoneDef[] = [];
  for (const def of MILESTONES) {
    if (reached[def.id] != null && !dismissed[def.id]) {
      out.push(def);
    }
  }
  out.sort((a, b) =>
    compareMilestoneReachedTimes(
      { id: a.id, reachedAtMs: reached[a.id] ?? 0 },
      { id: b.id, reachedAtMs: reached[b.id] ?? 0 },
    ),
  );
  return out;
}

/** Most recently earned milestone that is not celebration-dismissed. */
export function nextCelebrationMilestoneId(
  reached: Record<string, number>,
  dismissed: Record<string, true>,
): string | null {
  return celebrationMilestoneDefs(reached, dismissed)[0]?.id ?? null;
}

export function normalizeMilestonesReached(
  raw: unknown,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = resolveMilestoneId(k);
    if (!MILESTONE_IDS.has(id)) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const ts = Math.max(0, Math.floor(v));
    const prev = out[id];
    out[id] = prev == null ? ts : Math.max(prev, ts);
  }
  return out;
}

export function normalizeMilestonesDismissed(
  raw: unknown,
): Record<string, true> {
  const out: Record<string, true> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = resolveMilestoneId(k);
    if (!MILESTONE_IDS.has(id)) continue;
    if (v) out[id] = true;
  }
  return out;
}

export function milestoneStatusList(
  reached: Record<string, number>,
): Array<{
  def: MilestoneDef;
  reachedAtMs: number | null;
}> {
  return MILESTONES.map((def) => ({
    def,
    reachedAtMs: reached[def.id] ?? null,
  }));
}
