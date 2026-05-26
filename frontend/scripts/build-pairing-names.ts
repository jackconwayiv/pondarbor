/**
 * One-off helper: paste pairing name TSV into PAIRING_NAME_TSV below, run:
 *   npx tsx scripts/build-pairing-names.ts
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DENIZENS, getDenizenIndex } from "../src/clicker2/denizens";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../src/clicker2/pairingEvolutionNames.ts");

/** Display label (from spreadsheet) → denizen id */
const LABEL_TO_ID: Record<string, string> = {
  Ripple: "ripples",
  Ripples: "ripples",
  Sediment: "sediment",
  Fungus: "fungi",
  Fungi: "fungi",
  Microbe: "microbes",
  Microbes: "microbes",
  Zooplankton: "zooplankton",
  "Aquatic Plants": "aquatic_plants",
  "Aquatic Plant": "aquatic_plants",
  Invertebrates: "invertebrates",
  Invertebrate: "invertebrates",
  "Darters": "small_swimmers",
  "Darter": "small_swimmers",
  Amphibians: "amphibians",
  Amphibian: "amphibians",
  "Small Fish": "small_fish",
  Reptiles: "reptiles",
  Reptile: "reptiles",
  "Large Fish": "large_fish",
  Waterfowl: "waterfowl",
  "Shore Mammals": "shore_mammals",
  "Shore Mammal": "shore_mammals",
  "Hunting Birds": "hunting_birds",
  "Hunting Bird": "hunting_birds",
  "Great Mammals": "great_mammals",
  "Great Mammal": "great_mammals",
  Humans: "humans",
  Human: "humans",
  Cryptids: "cryptids",
  Cryptid: "cryptids",
  Spirits: "spirits",
  Spirit: "spirits",
  Leviathans: "leviathans",
  Leviathan: "leviathans",
  Abyssals: "abyssals",
  Abyssal: "abyssals",
  Celestials: "celestials",
  Celestial: "celestials",
  Transcendence: "transcendence",
};

function resolveId(label: string): string {
  const id = LABEL_TO_ID[label.trim()];
  if (!id) throw new Error(`Unknown denizen label: ${label}`);
  return id;
}

function pairKey(a: string, b: string): string {
  const ia = getDenizenIndex(a);
  const ib = getDenizenIndex(b);
  if (ia < 0 || ib < 0) throw new Error(`Invalid ids: ${a}, ${b}`);
  const [lower, higher] = ia < ib ? [a, b] : [b, a];
  if (ia === ib) throw new Error(`Same denizen twice: ${a}`);
  return `${lower}|${higher}`;
}

// Names from content spreadsheet (pair labels tab evolution name)
const ROWS: ReadonlyArray<{ pair: string; name: string }> = [
  { pair: "Ripple & Sediment", name: "Shifting Bed" },
  { pair: "Ripple & Fungus", name: "Flowing Decay" },
  { pair: "Ripple & Microbe", name: "Living Current" },
  { pair: "Ripple & Zooplankton", name: "Wandering Tide" },
  { pair: "Ripple & Aquatic Plants", name: "Swaying Banks" },
  { pair: "Ripple & Invertebrates", name: "Surface Pulse" },
  { pair: "Ripple & Darters", name: "Agile Stream" },
  { pair: "Sediment & Fungus", name: "Nutrient Floor" },
  { pair: "Sediment & Microbe", name: "Primeval Layer" },
  { pair: "Sediment & Zooplankton", name: "Benthic Rise" },
  { pair: "Sediment & Aquatic Plants", name: "Rooted Earth" },
  { pair: "Sediment & Invertebrates", name: "Burrowing Life" },
  { pair: "Sediment & Darters", name: "Bottom Scout" },
  { pair: "Fungus & Microbe", name: "Hidden Decomposers" },
  { pair: "Fungus & Zooplankton", name: "Floating Spores" },
  { pair: "Fungus & Aquatic Plants", name: "Root Network" },
  { pair: "Fungus & Invertebrates", name: "Fungal Host" },
  { pair: "Fungus & Darters", name: "Nutrient Feeder" },
  { pair: "Microbe & Zooplankton", name: "Microscopic Web" },
  { pair: "Microbe & Aquatic Plants", name: "Vital Energy" },
  { pair: "Microbe & Invertebrates", name: "Micro Habitat" },
  { pair: "Microbe & Darters", name: "Inner Life" },
  { pair: "Zooplankton & Aquatic Plants", name: "Leafy Refuge" },
  { pair: "Zooplankton & Invertebrates", name: "Drifting Larvae" },
  { pair: "Zooplankton & Darters", name: "Open Water" },
  { pair: "Aquatic Plants & Invertebrates", name: "Garden Nursery" },
  { pair: "Aquatic Plants & Darters", name: "Hidden School" },
  { pair: "Invertebrates & Darters", name: "Predator Prey" },
  { pair: "Amphibians & Ripple", name: "Shoreline Dancer" },
  { pair: "Amphibians & Sediment", name: "Mud Dweller" },
  { pair: "Amphibians & Fungus", name: "Damp Refuge" },
  { pair: "Amphibians & Microbe", name: "Breath of Life" },
  { pair: "Amphibians & Zooplankton", name: "Tadpole Feast" },
  { pair: "Amphibians & Aquatic Plants", name: "Lily Pad Rest" },
  { pair: "Amphibians & Invertebrates", name: "Patient Hunter" },
  { pair: "Amphibians & Darters", name: "Dual Realm" },
  { pair: "Small Fish & Ripple", name: "Breaking Surface" },
  { pair: "Small Fish & Sediment", name: "Silt Scavenger" },
  { pair: "Small Fish & Fungus", name: "Fungal Forager" },
  { pair: "Small Fish & Microbe", name: "Plankton Predator" },
  { pair: "Small Fish & Zooplankton", name: "Tiny Hunter" },
  { pair: "Small Fish & Aquatic Plants", name: "Weedy Sanctuary" },
  { pair: "Small Fish & Invertebrates", name: "Insect Eater" },
  { pair: "Small Fish & Amphibians", name: "Shared Waters" },
  { pair: "Small Fish & Darters", name: "Schooling Life" },
  { pair: "Reptiles & Ripple", name: "Sunlit Surface" },
  { pair: "Reptiles & Sediment", name: "Riverbank Basker" },
  { pair: "Reptiles & Fungus", name: "Decaying Bough" },
  { pair: "Reptiles & Microbe", name: "Sloughing Skin" },
  { pair: "Reptiles & Zooplankton", name: "Drift Feeder" },
  { pair: "Reptiles & Aquatic Plants", name: "Reedy Ambush" },
  { pair: "Reptiles & Invertebrates", name: "Scuttling Prey" },
  { pair: "Reptiles & Darters", name: "Patient Predator" },
  { pair: "Reptiles & Small Fish", name: "Shallow Striker" },
  { pair: "Reptiles & Amphibians", name: "Cold-Blooded Kin" },
  { pair: "Large Fish & Ripple", name: "Breaking Current" },
  { pair: "Large Fish & Sediment", name: "Deep Roamer" },
  { pair: "Large Fish & Fungus", name: "Nutrient Cycle" },
  { pair: "Large Fish & Microbe", name: "Ecosystem Titan" },
  { pair: "Large Fish & Zooplankton", name: "Filter Feeder" },
  { pair: "Large Fish & Aquatic Plants", name: "Submerged Cover" },
  { pair: "Large Fish & Invertebrates", name: "Bottom Feeder" },
  { pair: "Large Fish & Darters", name: "Open Hunter" },
  { pair: "Large Fish & Small Fish", name: "Apex Predator" },
  { pair: "Large Fish & Amphibians", name: "River Monarch" },
  { pair: "Large Fish & Reptiles", name: "Shared Depths" },
  { pair: "Waterfowl & Ripple", name: "Waking Surface" },
  { pair: "Waterfowl & Sediment", name: "Mud Dabbler" },
  { pair: "Waterfowl & Fungus", name: "Shoreline Scavenger" },
  { pair: "Waterfowl & Microbe", name: "Surface Filterer" },
  { pair: "Waterfowl & Zooplankton", name: "Plankton Grazer" },
  { pair: "Waterfowl & Aquatic Plants", name: "Reedy Nester" },
  { pair: "Waterfowl & Invertebrates", name: "Diving Hunter" },
  { pair: "Waterfowl & Darters", name: "Swift Predator" },
  { pair: "Waterfowl & Small Fish", name: "Angling Diver" },
  { pair: "Waterfowl & Amphibians", name: "Marsh Stalker" },
  { pair: "Waterfowl & Reptiles", name: "Wetland Rival" },
  { pair: "Waterfowl & Large Fish", name: "Shadow Watcher" },
  { pair: "Shore Mammals & Ripple", name: "Banking Wave" },
  { pair: "Shore Mammals & Sediment", name: "Muddy Path" },
  { pair: "Shore Mammals & Fungus", name: "Forest Edge" },
  { pair: "Shore Mammals & Microbe", name: "Wild Trinket" },
  { pair: "Shore Mammals & Zooplankton", name: "Shoreline Grazer" },
  { pair: "Shore Mammals & Aquatic Plants", name: "Reed Cover" },
  { pair: "Shore Mammals & Invertebrates", name: "Scavenging Tracks" },
  { pair: "Shore Mammals & Darters", name: "Edge Hunter" },
  { pair: "Shore Mammals & Small Fish", name: "Shallow Stalker" },
  { pair: "Shore Mammals & Amphibians", name: "Marsh Ranger" },
  { pair: "Shore Mammals & Reptiles", name: "Sunning Rivals" },
  { pair: "Shore Mammals & Large Fish", name: "Stream Watcher" },
  { pair: "Shore Mammals & Waterfowl", name: "Nesting Neighbors" },
  { pair: "Hunting Birds & Ripple", name: "Sky Reflection" },
  { pair: "Hunting Birds & Sediment", name: "Shoreline Watch" },
  { pair: "Hunting Birds & Fungus", name: "Perch Haven" },
  { pair: "Hunting Birds & Microbe", name: "Aerial Sight" },
  { pair: "Hunting Birds & Zooplankton", name: "Surface Focus" },
  { pair: "Hunting Birds & Aquatic Plants", name: "Hidden Lookout" },
  { pair: "Hunting Birds & Invertebrates", name: "Swift Strike" },
  { pair: "Hunting Birds & Darters", name: "Raptor Dive" },
  { pair: "Hunting Birds & Small Fish", name: "Water Talon" },
  { pair: "Hunting Birds & Amphibians", name: "Marsh Predator" },
  { pair: "Hunting Birds & Reptiles", name: "Aerial Threat" },
  { pair: "Hunting Birds & Large Fish", name: "Still Hunter" },
  { pair: "Hunting Birds & Waterfowl", name: "Winged Rival" },
  { pair: "Hunting Birds & Shore Mammals", name: "Shared Domain" },
  { pair: "Great Mammals & Ripple", name: "Rushing Current" },
  { pair: "Great Mammals & Sediment", name: "River Bed" },
  { pair: "Great Mammals & Fungus", name: "Forest Anchor" },
  { pair: "Great Mammals & Microbe", name: "Ecosystem Giant" },
  { pair: "Great Mammals & Zooplankton", name: "Filter Path" },
  { pair: "Great Mammals & Aquatic Plants", name: "Grazing Depth" },
  { pair: "Great Mammals & Invertebrates", name: "Wetland Wanderer" },
  { pair: "Great Mammals & Darters", name: "Wake Mover" },
  { pair: "Great Mammals & Small Fish", name: "Shallow Wader" },
  { pair: "Great Mammals & Amphibians", name: "Muddy Refuge" },
  { pair: "Great Mammals & Reptiles", name: "Shared Bank" },
  { pair: "Great Mammals & Large Fish", name: "Water Titan" },
  { pair: "Great Mammals & Waterfowl", name: "Nesting Guardian" },
  { pair: "Great Mammals & Shore Mammals", name: "Territorial Range" },
  { pair: "Great Mammals & Hunting Birds", name: "High Sentinel" },
  { pair: "Humans & Ripple", name: "Water Watcher" },
  { pair: "Humans & Sediment", name: "River Shaper" },
  { pair: "Humans & Fungus", name: "Natural Harvester" },
  { pair: "Humans & Microbe", name: "Scientific Observer" },
  { pair: "Humans & Zooplankton", name: "Sampling Life" },
  { pair: "Humans & Aquatic Plants", name: "Wetland Gardener" },
  { pair: "Humans & Invertebrates", name: "Bait Collector" },
  { pair: "Humans & Darters", name: "Casual Observer" },
  { pair: "Humans & Small Fish", name: "Angler's Catch" },
  { pair: "Humans & Amphibians", name: "Habitat Protector" },
  { pair: "Humans & Reptiles", name: "Cautious Neighbor" },
  { pair: "Humans & Large Fish", name: "Trophy Seeker" },
  { pair: "Humans & Waterfowl", name: "Avian Friend" },
  { pair: "Humans & Shore Mammals", name: "Wildlife Tracker" },
  { pair: "Humans & Hunting Birds", name: "Shared Horizon" },
  { pair: "Humans & Great Mammals", name: "Respectful Witness" },
  { pair: "Cryptids & Ripple", name: "Ghostly Wake" },
  { pair: "Cryptids & Sediment", name: "Deep Dweller" },
  { pair: "Cryptids & Fungus", name: "Spore Walker" },
  { pair: "Cryptids & Microbe", name: "Ancient Mystery" },
  { pair: "Cryptids & Zooplankton", name: "Unseen Presence" },
  { pair: "Cryptids & Aquatic Plants", name: "Tangled Legend" },
  { pair: "Cryptids & Invertebrates", name: "Swarm Shadow" },
  { pair: "Cryptids & Darters", name: "Furtive Lurker" },
  { pair: "Cryptids & Small Fish", name: "Mythic Ripple" },
  { pair: "Cryptids & Amphibians", name: "Swamp Entity" },
  { pair: "Cryptids & Reptiles", name: "Scales of Myth" },
  { pair: "Cryptids & Large Fish", name: "River Monster" },
  { pair: "Cryptids & Waterfowl", name: "Omen Bird" },
  { pair: "Cryptids & Shore Mammals", name: "Beast Trace" },
  { pair: "Cryptids & Hunting Birds", name: "Sky Spectre" },
  { pair: "Cryptids & Great Mammals", name: "Wilderness Phantom" },
  { pair: "Cryptids & Humans", name: "Urban Legend" },
  { pair: "Spirits & Ripple", name: "Ethereal Flow" },
  { pair: "Spirits & Sediment", name: "Grounded Soul" },
  { pair: "Spirits & Fungus", name: "Life Cycle" },
  { pair: "Spirits & Microbe", name: "Tiny Essence" },
  { pair: "Spirits & Zooplankton", name: "Drifted Breath" },
  { pair: "Spirits & Aquatic Plants", name: "Rooted Spirit" },
  { pair: "Spirits & Invertebrates", name: "Small Ghost" },
  { pair: "Spirits & Darters", name: "Hidden Current" },
  { pair: "Spirits & Small Fish", name: "Flickering Shade" },
  { pair: "Spirits & Amphibians", name: "Dual Observer" },
  { pair: "Spirits & Reptiles", name: "Ancient Echo" },
  { pair: "Spirits & Large Fish", name: "Deep Guardian" },
  { pair: "Spirits & Waterfowl", name: "Winged Vision" },
  { pair: "Spirits & Shore Mammals", name: "Earthly Guide" },
  { pair: "Spirits & Hunting Birds", name: "Silent Watcher" },
  { pair: "Spirits & Great Mammals", name: "Primal Presence" },
  { pair: "Spirits & Humans", name: "Memory Keeper" },
  { pair: "Spirits & Cryptids", name: "Mystic Veil" },
  { pair: "Leviathans & Ripple", name: "Distant Tremor" },
  { pair: "Leviathans & Sediment", name: "Trench Shaper" },
  { pair: "Leviathans & Fungus", name: "Abyssal Bloom" },
  { pair: "Leviathans & Microbe", name: "Primeval Pulse" },
  { pair: "Leviathans & Zooplankton", name: "Swarm Veil" },
  { pair: "Leviathans & Aquatic Plants", name: "Sunken Forest" },
  { pair: "Leviathans & Invertebrates", name: "Ancient Host" },
  { pair: "Leviathans & Darters", name: "Hidden Wake" },
  { pair: "Leviathans & Small Fish", name: "Shadow Loom" },
  { pair: "Leviathans & Amphibians", name: "Rising Dread" },
  { pair: "Leviathans & Reptiles", name: "Primal Coil" },
  { pair: "Leviathans & Large Fish", name: "Ocean Monarch" },
  { pair: "Leviathans & Waterfowl", name: "Storm Herald" },
  { pair: "Leviathans & Shore Mammals", name: "Coastal Terror" },
  { pair: "Leviathans & Hunting Birds", name: "High Sentinel" },
  { pair: "Leviathans & Great Mammals", name: "Deep Rival" },
  { pair: "Leviathans & Humans", name: "Forgotten Myth" },
  { pair: "Leviathans & Cryptids", name: "Cosmic Peer" },
  { pair: "Leviathans & Spirits", name: "Soul Anchor" },
  { pair: "Abyssals & Ripple", name: "Surface Tension" },
  { pair: "Abyssals & Sediment", name: "Void Floor" },
  { pair: "Abyssals & Fungus", name: "Gloom Growth" },
  { pair: "Abyssals & Microbe", name: "Dark Catalyst" },
  { pair: "Abyssals & Zooplankton", name: "Cold Drift" },
  { pair: "Abyssals & Aquatic Plants", name: "Sunless Root" },
  { pair: "Abyssals & Invertebrates", name: "Hollow Shell" },
  { pair: "Abyssals & Darters", name: "Faded Trace" },
  { pair: "Abyssals & Small Fish", name: "Deep Glimmer" },
  { pair: "Abyssals & Amphibians", name: "Silent Diver" },
  { pair: "Abyssals & Reptiles", name: "Cold Blood" },
  { pair: "Abyssals & Large Fish", name: "Pressure Monarch" },
  { pair: "Abyssals & Waterfowl", name: "Dark Omen" },
  { pair: "Abyssals & Shore Mammals", name: "Shoreline Fear" },
  { pair: "Abyssals & Hunting Birds", name: "Midnight Wing" },
  { pair: "Abyssals & Great Mammals", name: "Depth Titan" },
  { pair: "Abyssals & Humans", name: "Unknown Dread" },
  { pair: "Abyssals & Cryptids", name: "Hidden Truth" },
  { pair: "Abyssals & Spirits", name: "Soul Shadow" },
  { pair: "Abyssals & Leviathans", name: "Primeval Alliance" },
  { pair: "Celestials & Ripple", name: "Starlight Refraction" },
  { pair: "Celestials & Sediment", name: "Cosmic Dust" },
  { pair: "Celestials & Fungus", name: "Astral Spore" },
  { pair: "Celestials & Microbe", name: "Infinite Spark" },
  { pair: "Celestials & Zooplankton", name: "Star-Drift" },
  { pair: "Celestials & Aquatic Plants", name: "Lunar Bloom" },
  { pair: "Celestials & Invertebrates", name: "Radiant Swarm" },
  { pair: "Celestials & Darters", name: "Comet Trail" },
  { pair: "Celestials & Small Fish", name: "Solar Flicker" },
  { pair: "Celestials & Amphibians", name: "Heaven's Descent" },
  { pair: "Celestials & Reptiles", name: "Constellation Coil" },
  { pair: "Celestials & Large Fish", name: "Galactic Wanderer" },
  { pair: "Celestials & Waterfowl", name: "Zenith Wing" },
  { pair: "Celestials & Shore Mammals", name: "Celestial Beacon" },
  { pair: "Celestials & Hunting Birds", name: "Sky Sovereign" },
  { pair: "Celestials & Great Mammals", name: "Ancient Oracle" },
  { pair: "Celestials & Humans", name: "Divine Connection" },
  { pair: "Celestials & Cryptids", name: "Cosmic Enigma" },
  { pair: "Celestials & Spirits", name: "Astral Resonance" },
  { pair: "Celestials & Leviathans", name: "Titan Star" },
  { pair: "Celestials & Abyssals", name: "Light and Void" },
  { pair: "Transcendence & Ripple", name: "Final Wave" },
  { pair: "Transcendence & Sediment", name: "Timeless Bed" },
  { pair: "Transcendence & Fungus", name: "Eternal Decay" },
  { pair: "Transcendence & Microbe", name: "Infinite Essence" },
  { pair: "Transcendence & Zooplankton", name: "Boundless Drift" },
  { pair: "Transcendence & Aquatic Plants", name: "Everlasting Bloom" },
  { pair: "Transcendence & Invertebrates", name: "Unified Form" },
  { pair: "Transcendence & Darters", name: "Pure Motion" },
  { pair: "Transcendence & Small Fish", name: "Ascendant Spark" },
  { pair: "Transcendence & Amphibians", name: "Living Bridge" },
  { pair: "Transcendence & Reptiles", name: "Ancient Wisdom" },
  { pair: "Transcendence & Large Fish", name: "Still Depth" },
  { pair: "Transcendence & Waterfowl", name: "Boundless Flight" },
  { pair: "Transcendence & Shore Mammals", name: "Primal Grace" },
  { pair: "Transcendence & Hunting Birds", name: "Silent Sight" },
  { pair: "Transcendence & Great Mammals", name: "Sovereign Spirit" },
  { pair: "Transcendence & Humans", name: "Higher Awareness" },
  { pair: "Transcendence & Cryptids", name: "Revealed Truth" },
  { pair: "Transcendence & Spirits", name: "Perfect Harmony" },
  { pair: "Transcendence & Leviathans", name: "Awakened Titan" },
  { pair: "Transcendence & Abyssals", name: "Light Unbound" },
  { pair: "Transcendence & Celestials", name: "Ultimate Union" },
];

function main(): void {
  const overrides: Record<string, string> = {};
  const duplicateNames = new Map<string, string[]>();

  for (const { pair, name } of ROWS) {
    const [left, right] = pair.split(" & ").map((s) => s.trim());
    if (!left || !right) throw new Error(`Bad pair: ${pair}`);
    const key = pairKey(resolveId(left), resolveId(right));
    if (overrides[key]) {
      throw new Error(`Duplicate key ${key}: ${overrides[key]} vs ${name}`);
    }
    overrides[key] = name;
    const list = duplicateNames.get(name) ?? [];
    list.push(key);
    duplicateNames.set(name, list);
  }

  const expected = (DENIZENS.length * (DENIZENS.length - 1)) / 2;
  if (Object.keys(overrides).length !== expected) {
    throw new Error(
      `Expected ${expected} names, got ${Object.keys(overrides).length}`,
    );
  }

  const dupDisplay = [...duplicateNames.entries()].filter(
    ([, keys]) => keys.length > 1,
  );
  if (dupDisplay.length > 0) {
    console.error("Warning: duplicate display names across pairs:");
    for (const [name, keys] of dupDisplay) {
      console.error(`  "${name}": ${keys.join(", ")}`);
    }
  }

  const lines = Object.entries(overrides)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, name]) => `  ${JSON.stringify(key)}: ${JSON.stringify(name)},`);

  const content = `/** Pairing evolution display names (all ${expected} ordered pairs). */

export const PAIRING_NAME_OVERRIDES: Readonly<Record<string, string>> = {
${lines.join("\n")}
};
`;

  writeFileSync(OUT, content, "utf8");
  console.error(`Wrote ${OUT} (${Object.keys(overrides).length} entries)`);
}

main();
