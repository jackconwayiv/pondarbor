/**
 * Catchy milestone titles for PondClicker 2 (EPS, evolution count, denizen count, mutation).
 *
 * Tone: short punchy phrases, light pond puns, ecology flavor — not stat labels or
 * limnology homework. Criteria text stays factual in milestones.ts; only titles live here.
 */

export type MilestoneTitleEntry = {
  id?: string;
  title: string;
};

/** Energy-per-second milestone titles keyed by threshold. */
export const EPS_TITLES: Readonly<Record<number, MilestoneTitleEntry>> = {
  5: { id: "eps_trickle", title: "Trickle" },
  10: { id: "eps_steady_drip", title: "Steady Drip" },
  25: { id: "eps_current_gain", title: "Current Gain" },
  50: { id: "eps_pond_pulse", title: "Pond Pulse" },
  100: { id: "eps_hundred_flow", title: "Hundred Flow" },
  250: { id: "eps_steady_stream", title: "Steady Stream" },
  500: { id: "eps_trickle_down_tonic", title: "Trickle-Down Tonic" },
  1_000: { id: "eps_kiloflow", title: "Kiloflow" },
  2_500: { id: "eps_algal_autobahn", title: "Algal Autobahn" },
  5_000: { id: "eps_pond_flow_pumping", title: "Pond-Flow Pumping" },
  10_000: { id: "eps_benthic_beat", title: "Benthic Beat" },
  50_000: { id: "eps_rhythmic_ripple_rate", title: "Rhythmic Ripple-Rate" },
  100_000: { id: "eps_constant_current_club", title: "Constant Current Club" },
  500_000: { id: "eps_steady_state_swamp", title: "Steady-State Swamp" },
  1_000_000: { id: "eps_marsh_metabolism", title: "Marsh Metabolism" },
  10_000_000: { id: "eps_ecosystem_engine", title: "Ecosystem Engine" },
  100_000_000: { id: "eps_the_constant_current", title: "The Constant Current" },
  1_000_000_000: { id: "eps_deep_water_dynamo", title: "Deep-Water Dynamo" },
  1_000_000_000_000: { id: "eps_mega_watt_marsh", title: "Mega-Watt Marsh" },
  1_000_000_000_000_000: { id: "eps_grand_torrent", title: "Grand Torrent" },
  1e18: { id: "eps_perpetual_pond_power", title: "Perpetual Pond-Power" },
  1e21: { id: "eps_marshland_momentum", title: "Marshland Momentum" },
  1e24: { id: "eps_eternal_tide", title: "The Eternal Tide" },
  1e27: { id: "eps_bioluminescent_burst", title: "Bioluminescent Burst" },
  1e30: { id: "eps_high_velocity_habitat", title: "High-Velocity Habitat" },
  1e33: { id: "eps_infinite_influx", title: "Infinite Influx" },
  1e36: { id: "eps_flow_state", title: "Flow-State Fundamentals" },
  1e39: { id: "eps_velocity_vole", title: "Velocity of the Vole" },
  1e42: { id: "eps_hydro_pulse_harmony", title: "Hydro-Pulse Harmony" },
  1e45: { id: "eps_current_core", title: "Current Core-Injection" },
  1e48: { id: "eps_lily_pad_grid", title: "Lily Pad Power Grid" },
  1e51: { id: "eps_benthic_bloom_booster", title: "Benthic Bloom Booster" },
  1e54: { id: "eps_sunbeam_soaker", title: "Sunbeam Soaker" },
  1e57: { id: "eps_photosynthesis_party", title: "Photosynthesis Party" },
  1e60: { id: "eps_ripple_runner", title: "Ripple Runner" },
  1e63: { id: "eps_pond_power_prime", title: "Pond-Power Prime" },
  1e66: { id: "eps_total_pond_voltage", title: "Total Pond-a-Voltage" },
};

function evo(
  denizenId: string,
  t1: MilestoneTitleEntry,
  t5: string,
  t10: string,
  t15: string,
): Record<string, MilestoneTitleEntry> {
  return {
    [`${denizenId}_1`]: t1,
    [`${denizenId}_5`]: { title: t5 },
    [`${denizenId}_10`]: { title: t10 },
    [`${denizenId}_15`]: { title: t15 },
  };
}

/** Evolution-count titles keyed by `${denizenId}_${threshold}`. */
export const EVOLUTION_COUNT_TITLES: Readonly<
  Record<string, MilestoneTitleEntry>
> = {
  ...evo("pond", { title: "Pond Patrol" }, "Beyond the Lily Pad", "High-Water Mark", "Pond-emonium"),
  ...evo(
    "ripples",
    { id: "skipping_stone", title: "Skipping Stone" },
    "Ripple Regiment",
    "Wave After Wave",
    "Master of the Meniscus",
  ),
  ...evo(
    "sediment",
    { id: "sludge_trudger", title: "Sludge Trudger" },
    "Muck Mover",
    "Bedrock Basin",
    "Core of the Cosmos",
  ),
  ...evo("fungi", { title: "Hyphae Highway" }, "Mycelium Mat", "Great Web of Decay", "Spore-Master's Lair"),
  ...evo("microbes", { title: "Bacterial Bloom" }, "Biofilm Brigade", "Invisible Engine", "Infinite Inhabitant"),
  ...evo("zooplankton", { title: "Zooplankton Pulse" }, "Protozoa Party", "Driftwise Dominion", "Microscopic Zoo Supreme"),
  ...evo("aquatic_plants", { title: "Emergent Macrophyte" }, "Reed-y for Growth", "Cattail Cathedral", "Macrophyte Manor"),
  ...evo("invertebrates", { title: "Mayfly Militia" }, "Beetle Brigade", "Caddisfly Castle", "Great Chitin-Change"),
  ...evo("small_swimmers", { title: "Fry-Day Feeling" }, "Minnow Mayhem", "Mudminnow Militia", "School-Master's Hub"),
  ...evo("amphibians", { title: "Tadpole Tots" }, "Lily Pad Leaper", "Bullfrog Battalion", "Toad-ally Awesome"),
  ...evo("small_fish", { title: "Fin-tastic Voyager" }, "Current Chasers", "Mudminnow Monarch", "Great Fin-Flurry"),
  ...evo("reptiles", { title: "Sun-Basking Beginner" }, "Silt-Slider Squad", "Snapping Sovereign", "Cold-Blooded Commander"),
  ...evo("large_fish", { title: "Bass-ic Instinct" }, "Lunker Lodge", "Apex Pond-Patrol", "Hydro-Titan"),
  ...evo("waterfowl", { title: "Downy Paddler" }, "Migration Movement", "Grand Mallard Monarch", "Winged Watershed"),
  ...evo("shore_mammals", { title: "Puddle-Paw Prowler" }, "Great Dam-Architect", "Marsh-Master Muskrat", "Shoreline Sovereign"),
  ...evo("hunting_birds", { title: "Fledgling Fisher" }, "Talons of the Tide", "Osprey Overlord", "Aerial Apex"),
  ...evo("great_mammals", { title: "Fawn-tastic First-Sight" }, "Antlered Arrival", "Ursine Overseer", "Titan of the Timberline"),
  ...evo("humans", { title: "Curious Passerby" }, "Binocular Brigade", "Grand Limnologist", "Master of the Marsh"),
  ...evo("cryptids", { title: "Ripples in the Dark" }, "Bog-Boggart", "Great Pond-Gnasher", "Apex Anomaly"),
  ...evo("spirits", { title: "Whisper in the Weeds" }, "Marsh-Memory Keeper", "Great Pond-Poltergeist", "Guardian of the Glacial-Deep"),
  ...evo("leviathans", { title: "Deep-Dormant Myth" }, "Basin-Bending Titan", "Sub-Surface Sovereign", "Titan of the Trench"),
  ...evo("abyssals", { title: "Twilight Trench" }, "Pressure-Cooker Plankton", "Trench-Titan's Throne", "Zenith of the Void"),
  ...evo("celestials", { title: "Star-Reflected Surface" }, "Orbiting Lily-Pad Array", "Quasar-Quagmire Pulse", "Event Horizon Equilibrium"),
  ...evo("transcendence", { title: "Awakening Ripple" }, "Boundary-Less Basin", "Consciousness Current", "Zenith of Unity"),
  ...evo(
    "tree",
    { id: "a_tree_grows", title: "A Tree Grows" },
    "Shady Shore",
    "Wooded Wetland",
    "Treebeard",
  ),
  ...evo(
    "cloud",
    { id: "cloudwatching", title: "Cloudwatching" },
    "Fluffy and White",
    "Clouding Up",
    "Meteorology Maestro",
  ),
};

/** Pollinator evolution-count titles keyed by `pollinator_${threshold}` (includes 20). */
export const POLLINATOR_EVOLUTION_COUNT_TITLES: Readonly<
  Record<string, MilestoneTitleEntry>
> = {
  pollinator_1: { id: "abuzz", title: "Abuzz" },
  pollinator_5: { id: "pollinator_milestone_5", title: "Pollinator" },
  pollinator_10: { id: "allergy_season", title: "Allergy Season" },
  pollinator_15: { id: "fruitful_pond", title: "Fruitful Pond" },
  pollinator_20: { id: "fertile_fen", title: "Fertile Fen" },
};

function count(
  denizenId: string,
  t50: string,
  t100: string,
  t500: string,
  t1000: string,
  t2000: string,
  extras?: { t100?: MilestoneTitleEntry },
): Record<string, MilestoneTitleEntry> {
  const out: Record<string, MilestoneTitleEntry> = {
    [`${denizenId}_50`]: { title: t50 },
    [`${denizenId}_100`]: extras?.t100 ?? { title: t100 },
    [`${denizenId}_500`]: { title: t500 },
    [`${denizenId}_1000`]: { title: t1000 },
    [`${denizenId}_2000`]: { title: t2000 },
  };
  return out;
}

/** Denizen-count titles keyed by `${denizenId}_${threshold}`. */
export const DENIZEN_COUNT_TITLES: Readonly<Record<string, MilestoneTitleEntry>> = {
  ...count(
    "ripples",
    "Puddle Party",
    "Make a Splash",
    "Pond-Wide Propagation",
    "Sonic Splashdown",
    "Great Resonator",
    { t100: { id: "make_a_splash", title: "Make a Splash" } },
  ),
  ...count("sediment", "Silt Sampler", "Mud-Pie Maker", "Detritus Deposit", "Nutrient Nest", "Bottomless Bounty"),
  ...count("fungi", "Fuzzy Floater", "Spore Sprinkler", "Rot Squad", "Decomposer's Delight", "Eternal Mycelium"),
  ...count("microbes", "Pond-Drop Pioneers", "Little Life-Force", "Nano-Nutrient Lab", "Culture Thousandfold", "Symbiotic Swarm"),
  ...count("zooplankton", "Daphnia Dash", "Drift Cloud", "Grazing Gala", "Plankton Pulse", "Open-Water Orchestra"),
  ...count("aquatic_plants", "Sprout Scout", "Lily Pad Lounge", "Floating Flora", "Emerald Ecosystem", "Lotus Land-Grab"),
  ...count("invertebrates", "Larval Launchpad", "Snail-Pace Strategy", "Creek Crew", "Bug-Logic Basin", "Invert Oasis"),
  ...count("small_swimmers", "Darting Darlings", "Schooling Scholar", "Fin-tastic Formation", "Silt-Sifting School", "Marsh-Fin Megastructure"),
  ...count("amphibians", "Croak-a-Doodle-Doo", "Puddle-Hopper Pro", "Belly-of-the-Bog Choir", "Ribbiting Results", "Bog King's Banquet"),
  ...count("small_fish", "Shadow-Swimmer Squad", "Puddle-Pike Prowler", "Hydro-Dynamic School", "Great Migration Loop", "Infinite Current-Shoal"),
  ...count("reptiles", "Shell-Shocked Slider", "Bog-Basking Baron", "Armor-Plated Ambush", "Great Reptile Retreat", "Zenith of the Drake"),
  ...count("large_fish", "Pike-a-Boo Prowler", "Shadow-Stalker", "Tyrant of the Trench", "Grand-Pond Guardian", "Hydro-Titan Shoal"),
  ...count("waterfowl", "Quack-Starter", "Lily Pad Landing", "Reed-Runner Brigade", "Sky-to-Silt Synergy", "Zenith of the Goose"),
  ...count("shore_mammals", "Bank-Side Bandit", "Whiskered Watchman", "Pond-Bank Patroller", "Eco-Erosion Engineer", "Zenith of the Beaver"),
  ...count("hunting_birds", "Dive-Bomb Debut", "Wind-Rider Watchman", "Bog-Bound Ballista", "Marsh-Sky Monarch", "Zenith of the Falcon"),
  ...count("great_mammals", "Buck-Stop Basin", "Pond-Edge Prowler", "Heavy-Hoof Haven", "Marsh-Monarch Majesty", "Riparian Ruler"),
  ...count("humans", "Pond-Side Poet", "Amateur Naturalist", "Conservationist Clique", "Marshland Manager", "Earth Steward"),
  ...count("cryptids", "Fog-Bank Phantom", "Silt-Shadow Stalker", "Lurker in the Lily", "Marsh-Mystic Monolith", "Legend of the Limnetic"),
  ...count("spirits", "Dew-Drop Dreamer", "Mist-Walker Maiden", "Spectral Swimmer Swarm", "Soul-Deep Sediment Seer", "Infinite In-Between"),
  ...count("leviathans", "Silt-Sovereign Shadow", "Hydro-Leviathan's Wake", "Benthic Behemoth Boss", "Abyssal Archive-Dweller", "Limnetic Void Guardian"),
  ...count("abyssals", "Midnight-Mud Mover", "Dark-Current Drifter", "Void-Vortex Vault", "Great Pressure-Pulse", "Absolute-Zero Equilibrium"),
  ...count("celestials", "Nebula-Nutrient Drift", "Comet-Tail Current", "Stardust-Spore Network", "Galactic-Gully Reservoir", "Singularity Sump"),
  ...count("transcendence", "Fluidity of Form", "Omni-Pond Perspective", "Aqueous Absolute", "Universal Pond-Harmony", "Harmony Absolute"),
};

function mut(
  denizenId: string,
  t1: MilestoneTitleEntry,
  t5: string,
  t10: string,
): Record<string, MilestoneTitleEntry> {
  return {
    [`${denizenId}_1`]: t1,
    [`${denizenId}_5`]: { title: t5 },
    [`${denizenId}_10`]: { title: t10 },
  };
}

/** Mutation milestone titles keyed by `${denizenId}_${threshold}` (1, 5, or 10). */
export const MUTATION_TITLES: Readonly<Record<string, MilestoneTitleEntry>> = {
  ...mut(
    "ripples",
    { title: "Surface Tension Breaker" },
    "Hyper-Hydro Tap",
    "The Infinite Wave",
  ),
  ...mut(
    "sediment",
    { title: "Clay Collector" },
    "Substrate Super-Structure",
    "Primordial Potting-Soil",
  ),
  ...mut("fungi", { title: "Decay Detective" }, "Spore Sport", "Eternal Mycelium Mind"),
  ...mut(
    "microbes",
    { id: "escape_petri_dish", title: "Escape the Petri Dish" },
    "Phosphorus Phactory",
    "Quantum Quorum-Sensing",
  ),
  ...mut(
    "zooplankton",
    { title: "Cilia-Powered Cycle" },
    "Deep-Pulse Plankton",
    "Plankton Recombinant",
  ),
  ...mut(
    "aquatic_plants",
    { title: "Feed Me, Seymour!" },
    "Photosynthesis Pro",
    "Oxygen Opulence",
  ),
  ...mut(
    "invertebrates",
    { title: "Water-Strider Sprint" },
    "Scud Squadron",
    "Zenith of the Arthropod",
  ),
  ...mut(
    "small_swimmers",
    { title: "Fry-Day Foundations" },
    "Glow-Fin Grouping",
    "Zenith of the Zephyr-Fin",
  ),
  ...mut(
    "amphibians",
    { title: "Jump-Start Junction" },
    "Marsh Metamorphosis Peak",
    "Infinite Marsh-Master",
  ),
  ...mut(
    "small_fish",
    { title: "Scale-Scale Efficiency" },
    "Hyper-Schooling Hybrid",
    "Ten-Gene Minnow",
  ),
  ...mut(
    "reptiles",
    { title: "Marsh-Snap Specialist" },
    "Swamp-Scale Synergy",
    "Cold-Blood Codex",
  ),
  ...mut(
    "large_fish",
    { title: "Big Fish in a Little Pond" },
    "Full-Scale Force",
    "Zenith of the Behemoth",
  ),
  ...mut(
    "waterfowl",
    { title: "Featherweight Force" },
    "Aerodynamic Aquatic Ace",
    "Downy Designer",
  ),
  ...mut(
    "shore_mammals",
    { title: "Silt-Scavenger" },
    "Benthic-Burrow Boss",
    "Dam Fine DNA",
  ),
  ...mut(
    "hunting_birds",
    { title: "Raptor's Ripple" },
    "Swift-Winged Syndicate",
    "Striker Strain",
  ),
  ...mut(
    "great_mammals",
    { title: "Bear-y Curious" },
    "Great Migration Hub",
    "Zenith of the Beast",
  ),
  ...mut(
    "humans",
    { title: "Silt Student" },
    "Anthropogenic Apex",
    "Master of the Micro-Verse",
  ),
  ...mut(
    "cryptids",
    { title: "Cryptid Call Echo" },
    "Phantom-Fin Phenom",
    "The Infinite Impossible",
  ),
  ...mut(
    "spirits",
    { title: "Ripple-Reflection Ghost" },
    "Marsh-Metaphysical Mentor",
    "Zenith of the Soul",
  ),
  ...mut(
    "leviathans",
    { title: "Abyssal Anchor-Beast" },
    "Tidal-Titan's Temper",
    "Guardian of the Limnetic Void",
  ),
  ...mut(
    "abyssals",
    { title: "Twilight Gene Pool" },
    "Sub-Sediment Syndicate",
    "Hadal Helix",
  ),
  ...mut(
    "celestials",
    { title: "Solar-Wind Swimmer" },
    "Celestial Cloud-Catalyst",
    "Cosmic Cultivar",
  ),
  ...mut(
    "transcendence",
    { title: "To Infinity, and Beyond!" },
    "Hyper-Hydro Divinity",
    "Transcendent Template",
  ),
};

/** Weather-event click thresholds (total and per family). */
export const WEATHER_CLICK_THRESHOLDS = [
  1, 5, 25, 50, 100, 1_000, 10_000, 100_000, 1_000_000,
] as const;

export type WeatherClickThreshold = (typeof WEATHER_CLICK_THRESHOLDS)[number];

/** Any weather family clicked. */
export const WEATHER_TOTAL_TITLES: Readonly<
  Record<WeatherClickThreshold, MilestoneTitleEntry>
> = {
  1: { id: "weather_watcher", title: "Weather Watcher" },
  5: { id: "weather_witch", title: "Weather Witch" },
  25: { id: "weather_wizard", title: "Weather Wizard" },
  50: { id: "weather_warlock", title: "Weather Warlock" },
  100: { id: "weather_warrior", title: "Weather Warrior" },
  1_000: { id: "weather_wizbang", title: "Weather Wizbang" },
  10_000: { id: "weather_wayfarer", title: "Weather Wayfarer" },
  100_000: { id: "weather_warden", title: "Weather Warden" },
  1_000_000: { id: "weather_worldwright", title: "Weather Worldwright" },
};

/** Sunny weather variants clicked. */
export const WEATHER_SUN_TITLES: Readonly<
  Record<WeatherClickThreshold, MilestoneTitleEntry>
> = {
  1: { id: "sun_seeker", title: "Sun-Seeker" },
  5: { id: "sun_spotter", title: "Sun-Spotter" },
  25: { id: "sun_chaser", title: "Sun-Chaser" },
  50: { id: "sun_bather", title: "Sun-Bather" },
  100: { id: "golden_hour", title: "Golden Hour" },
  1_000: { id: "sun_sovereign", title: "Sun Sovereign" },
  10_000: { id: "helios_herald", title: "Helios Herald" },
  100_000: { id: "corona_crown", title: "Corona Crown" },
  1_000_000: { id: "solar_supremacy", title: "Solar Supremacy" },
};

/** Wind / bluster weather variants clicked. */
export const WEATHER_WIND_TITLES: Readonly<
  Record<WeatherClickThreshold, MilestoneTitleEntry>
> = {
  1: { id: "wind_listener", title: "Wind-Listener" },
  5: { id: "breeze_bard", title: "Breeze-Bard" },
  25: { id: "gust_guru", title: "Gust-Guru" },
  50: { id: "gale_gatherer", title: "Gale-Gatherer" },
  100: { id: "squall_sleuth", title: "Squall-Sleuth" },
  1_000: { id: "tempest_tamer", title: "Tempest-Tamer" },
  10_000: { id: "hurricane_herald", title: "Hurricane-Herald" },
  100_000: { id: "cyclone_crowned", title: "Cyclone-Crowned" },
  1_000_000: { id: "storm_sovereign", title: "Storm Sovereign" },
};

/** Rain weather variants clicked. */
export const WEATHER_RAIN_TITLES: Readonly<
  Record<WeatherClickThreshold, MilestoneTitleEntry>
> = {
  1: { id: "precipitant", title: "Precipitant" },
  5: { id: "drizzle_diver", title: "Drizzle-Diver" },
  25: { id: "shower_seeker", title: "Shower-Seeker" },
  50: { id: "rain_runner", title: "Rain-Runner" },
  100: { id: "downpour_dancer", title: "Downpour-Dancer" },
  1_000: { id: "monsoon_maven", title: "Monsoon-Maven" },
  10_000: { id: "deluge_doyen", title: "Deluge-Doyen" },
  100_000: { id: "cloudburst_champion", title: "Cloudburst Champion" },
  1_000_000: { id: "rain_reign", title: "Rain Reign" },
};

/** Energy-per-click milestone titles keyed by threshold. */
export const ENERGY_PER_CLICK_TITLES: Readonly<
  Record<number, MilestoneTitleEntry>
> = {
  5: { id: "ripplefinger", title: "Ripplefinger" },
  50: { id: "wavetouch", title: "Wavetouch" },
  100: { id: "crestmember", title: "Crestmember" },
  250: { id: "springdigit", title: "Springdigit" },
  500: { id: "stirring_palm", title: "Stirring Palm" },
  750: { id: "billowbrush", title: "Billowbrush" },
  1_000: { id: "undulating_hand", title: "Undulating Hand" },
  2_500: { id: "slapknuckle", title: "Slapknuckle" },
  5_000: { id: "spilling_graze", title: "Spilling Graze" },
  10_000: { id: "gnarhand", title: "Gnarhand" },
  100_000: { id: "roiling_grip", title: "Roiling Grip" },
  1_000_000: { id: "capsizing_caress", title: "Capsizing Caress" },
};
