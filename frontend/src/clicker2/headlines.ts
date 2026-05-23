import { formatEnergyRate } from "./formatEnergy";

export type HeadlineDef = {
  id: string;
  text: string;
  /** Shown when EpS is at or above this rate (highest matching tier wins). */
  unlockEps: number;
};

/** Sorted ascending by `unlockEps`. */
export const HEADLINES: readonly HeadlineDef[] = [
  {
    id: "ditch_rain",
    text: "`Ditch fills with rainwater; calls itself pond.`",
    unlockEps: 0,
  },
  {
    id: "lone_ripple",
    text: "`Faint ripples mistaken for pond life.`",
    unlockEps: 0.1,
  },
  {
    id: "twig_falls",
    text: "`Twig falls at the pond; no one hears it.`",
    unlockEps: 1,
  },
  {
    id: "mosquito_departure",
    text: "`Mosquito family leaves pond for bluer waters.`",
    unlockEps: 3,
  },
  {
    id: "energy_trickle",
    text: "Energy is beginning to trickle through your pond.",
    unlockEps: 5,
  },
  {
    id: "robot_poetry",
    text: "Your pond is teaching robots to write poetry.",
    unlockEps: 7,
  },
  {
    id: "first_clarity",
    text: "A new stillness learns / To cradle the morning sky / In a shallow pool.",
    unlockEps: 10,
  },
  {
    id: "weightless_dust",
    text: "Motes float on tension, / Tiny boats that wait upon / An unspoken wind.",
    unlockEps: 25,
  },
  {
    id: "dark_indigo",
    text: "Far beneath the glass, / The water forgets the light / To dream in blue depths.",
    unlockEps: 50,
  },
  {
    id: "silent_gulf",
    text: "A single pebble / Sinks through a quiet silence / Growing by the hour.",
    unlockEps: 100,
  },
  {
    id: "breathing_mist",
    text: "At the twilight hour, / Cool breaths rise up from the bank / Tracing things unseen.",
    unlockEps: 250,
  },
  {
    id: "green_velvet",
    text: "Edges blur to shade, / Draped in the heavy velvet / Of unfolding green.",
    unlockEps: 500,
  },
  {
    id: "liquid_silver",
    text: "Moonlight strikes the glass / And shatters into a net / Of infinite sparks.",
    unlockEps: 1000,
  },
  {
    id: "weight_of_water",
    text: "The heavy, quiet / Pressure of a liquid world / Refuses to leave.",
    unlockEps: 2500,
  },
  {
    id: "submerged_clock",
    text: "Time slows in the deep; / Minutes dissolve in the silt / Like grains of white salt.",
    unlockEps: 5000,
  },
  {
    id: "veins_of_light",
    text: "Glows pulse in the dark, / Keeping a steady rhythm / With a hidden heart.",
    unlockEps: 10000,
  },
  {
    id: "boundless_mirror",
    text: "The mirror is pure; / The sky can no longer tell: / It is split in two.",
    unlockEps: 25000,
  },
  {
    id: "ancient_echo",
    text: "Cold resonance hums, / Vibrating through the basin / Songs of ancient rain.",
    unlockEps: 50000,
  },
  {
    id: "luminescent_tide",
    text: "An ethereal / Pale luminescence awakes / At the stroke of night.",
    unlockEps: 100000,
  },
  {
    id: "reverted_gravity",
    text: "Ripples flow backward, / Folding the eye of the world / Inward to the core.",
    unlockEps: 1000000,
  },
  {
    id: "eternal_well",
    text: "Clouds pass far above, / But the water looks past them / Straight into the void.",
    unlockEps: 10000000,
  },
  {
    id: "liquid_glass",
    text: "Absolute stillness; / The pool freezes to a state / Of living crystal.",
    unlockEps: 100000000,
  },
  {
    id: "stardust_cradle",
    text: "No more water here, / Only the slow, swirling ink / Of a billion stars.",
    unlockEps: 1000000000,
  }
];

export const HEADLINE_IDS = new Set(HEADLINES.map((h) => h.id));

export function getHeadlineDef(id: string): HeadlineDef | undefined {
  return HEADLINES.find((h) => h.id === id);
}

/** Haiku headlines use ` / ` between lines in the catalog source string. */
export function headlineDisplayLines(text: string): string[] {
  if (!text.includes("/")) return [text];
  return text
    .split(/\s*\/\s*/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Highest-tier headline unlocked at the current EpS. */
export function activeHeadlineForEps(
  energyPerSecond: number,
): HeadlineDef | undefined {
  const eps = Math.max(0, energyPerSecond);
  let active: HeadlineDef | undefined;
  for (const def of HEADLINES) {
    if (eps >= def.unlockEps) active = def;
    else break;
  }
  return active;
}

/** Staff catalog — global headline behavior. */
export const HEADLINE_CATALOG_GLOBAL_NOTES: readonly string[] = [
  "Shown in the headline strip when no milestone celebration cards are visible",
  "Displays the highest EpS tier reached (not a rotating pool)",
];

/** Staff catalog — per-headline unlock requirements. */
export function headlineUnlockCriteriaText(def: HeadlineDef): string {
  return `${formatEnergyRate(def.unlockEps)} EpS or higher`;
}
