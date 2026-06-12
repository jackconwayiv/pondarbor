import { describe, expect, it } from "vitest";

import { DENIZENS, denizenFirstWelcomeDescription } from "./denizens";
import {
  EL_NINO_SPECIALTY_ID,
  FOSSIL_RECORD_SPECIALTY_ID,
  GATHERING_CLOUDS_SPECIALTY_ID,
  RIPPLES_OF_ETERNITY_SPECIALTY_ID,
  STRATIFIED_POND_SPECIALTY_ID,
  WOODED_SHORE_SPECIALTY_ID,
} from "./fossilShop";
import { POLLINATOR_SPECIALTY_DENIZEN_ID } from "./pollinatorEvolutions";
import {
  CLOUD_SPECIALTY_DENIZEN_ID,
  TREE_SPECIALTY_DENIZEN_ID,
} from "./treeCloudEvolutions";
import { specialtiesForDenizen } from "./specialties";
import {
  buildDenizenFirstMilestones,
  buildDenizenCountMilestones,
  buildEvolutionCountMilestones,
  buildPollinatorEvolutionCountMilestones,
  buildDenizenMutationMilestones,
  evolutionChainDenizenIds,
  countMilestonesReached,
  ENERGY_PER_CLICK_MILESTONE_THRESHOLDS,
  ENERGY_PER_CLICK_MILESTONES,
  ENERGY_PER_SECOND_MILESTONE_THRESHOLDS,
  ENERGY_PER_SECOND_MILESTONES,
  compareMilestoneReachedTimes,
  evaluateNewMilestones,
  GLOBAL_MILESTONES,
  FOSSIL_SHOP_MILESTONES,
  POND_CYCLE_MILESTONES,
  isMilestoneMet,
  milestoneDisplayEmoji,
  MILESTONE_MILLION,
  MILESTONE_OCTILLION,
  MILESTONES,
  MILESTONE_CATALOG_SECTIONS,
  milestonesInCatalogSection,
  celebrationMilestoneDefs,
  nextCelebrationMilestoneId,
  normalizeMilestonesReached,
  WEATHER_CLICK_MILESTONES,
  WEATHER_CLICK_THRESHOLDS,
  type MilestoneEvalContext,
} from "./milestones";

function ctx(overrides: Partial<MilestoneEvalContext> = {}): MilestoneEvalContext {
  return {
    energyInPond: 0,
    allTimeEnergyEarned: 0,
    energyPerSecond: 0,
    energyPerClick: 0,
    totalClicks: 0,
    weatherEventsClicked: 0,
    weatherSunClicked: 0,
    weatherWindClicked: 0,
    weatherRainClicked: 0,
    ownedSpecialties: {},
    ownedDenizens: {},
    denizenMutationLevels: {},
    pondEra: 1,
    ...overrides,
  };
}

describe("milestones catalog", () => {
  it("catalog sections partition all milestones", () => {
    const ids = MILESTONE_CATALOG_SECTIONS.flatMap((s) =>
      milestonesInCatalogSection(s.id).map((m) => m.id),
    );
    expect(ids).toHaveLength(MILESTONES.length);
    expect(new Set(ids).size).toBe(MILESTONES.length);
  });

  it("has expected global and denizen-first counts", () => {
    expect(ENERGY_PER_SECOND_MILESTONES).toHaveLength(
      ENERGY_PER_SECOND_MILESTONE_THRESHOLDS.length,
    );
    expect(ENERGY_PER_CLICK_MILESTONES).toHaveLength(
      ENERGY_PER_CLICK_MILESTONE_THRESHOLDS.length,
    );
    expect(GLOBAL_MILESTONES).toHaveLength(
      79 +
        ENERGY_PER_SECOND_MILESTONES.length +
        ENERGY_PER_CLICK_MILESTONES.length,
    );
    expect(buildEvolutionCountMilestones()).toHaveLength(
      evolutionChainDenizenIds().length * 4,
    );
    expect(buildPollinatorEvolutionCountMilestones()).toHaveLength(5);
    expect(buildDenizenCountMilestones()).toHaveLength(DENIZENS.length * 5);
    expect(buildDenizenMutationMilestones()).toHaveLength(DENIZENS.length * 3);
    expect(buildDenizenFirstMilestones()).toHaveLength(DENIZENS.length);
    const chainCount = evolutionChainDenizenIds().length;
    expect(WEATHER_CLICK_MILESTONES).toHaveLength(
      WEATHER_CLICK_THRESHOLDS.length * 4,
    );
    expect(POND_CYCLE_MILESTONES).toHaveLength(7);
    expect(FOSSIL_SHOP_MILESTONES).toHaveLength(9);
    expect(MILESTONES).toHaveLength(
      GLOBAL_MILESTONES.length +
        POND_CYCLE_MILESTONES.length +
        FOSSIL_SHOP_MILESTONES.length +
        WEATHER_CLICK_MILESTONES.length +
        chainCount * 4 +
        5 +
        DENIZENS.length * 5 +
        DENIZENS.length * 3 +
        DENIZENS.length,
    );
  });

  it("energy per second milestones span trickle through unvigintillion", () => {
    const epsIds = GLOBAL_MILESTONES.filter((m) => m.kind === "energy_per_second").map(
      (m) => m.id,
    );
    expect(epsIds[0]).toBe("eps_trickle");
    expect(epsIds).toContain("eps_kiloflow");
    expect(epsIds).toContain("eps_marsh_metabolism");
    expect(epsIds).toContain("eps_grand_torrent");
    expect(epsIds).toContain("eps_total_pond_voltage");
    expect(ENERGY_PER_SECOND_MILESTONE_THRESHOLDS[0]).toBe(5);
    expect(ENERGY_PER_SECOND_MILESTONE_THRESHOLDS).toContain(1e15);
    expect(ENERGY_PER_SECOND_MILESTONE_THRESHOLDS.at(-1)).toBe(1e66);
  });

  it("evolution count milestones at 1, 5, 10, and 15 per chain plus pollinator at 20", () => {
    const evolutionIds = MILESTONES.filter((m) => m.kind === "evolution_count").map(
      (m) => m.id,
    );
    expect(evolutionIds).toContain("skipping_stone");
    expect(evolutionIds).toContain("sludge_trudger");
    expect(evolutionIds).toContain("evolution_count_pond_15");
    expect(evolutionIds).toContain("abuzz");
    expect(evolutionIds).toContain("pollinator_milestone_5");
    expect(evolutionIds).toContain("allergy_season");
    expect(evolutionIds).toContain("fruitful_pond");
    expect(evolutionIds).toContain("fertile_fen");
    expect(evolutionIds).toHaveLength(evolutionChainDenizenIds().length * 4 + 5);
  });

  it("denizen count milestones at 50 through 2000 per denizen", () => {
    const countIds = MILESTONES.filter((m) => m.kind === "denizen_count").map(
      (m) => m.id,
    );
    expect(countIds).toContain("make_a_splash");
    expect(countIds).toContain("denizen_count_fungi_2000");
    expect(countIds).toHaveLength(DENIZENS.length * 5);
  });

  it("mutation milestones include level 1, 5, and 10 per denizen", () => {
    const mutationIds = MILESTONES.filter((m) => m.kind === "mutation").map(
      (m) => m.id,
    );
    expect(mutationIds).toContain("escape_petri_dish");
    expect(mutationIds).toContain("mutate_fungi_5");
    expect(mutationIds).toContain("mutate_fungi_10");
    expect(mutationIds).toHaveLength(DENIZENS.length * 3);
  });

  it("mutation milestone title overrides", () => {
    const byId = new Map(MILESTONES.map((m) => [m.id, m]));
    expect(byId.get("escape_petri_dish")?.title).toBe("Escape the Petri Dish");
    expect(byId.get("mutate_aquatic_plants_1")?.title).toBe("Feed Me, Seymour!");
    expect(byId.get("mutate_large_fish_1")?.title).toBe(
      "Big Fish in a Little Pond",
    );
    expect(byId.get("mutate_transcendence_1")?.title).toBe(
      "To Infinity, and Beyond!",
    );
  });

  it("lifetime energy milestones span just getting started through unvigintillion", () => {
    const lifetimeIds = GLOBAL_MILESTONES.filter(
      (m) => m.kind === "lifetime_energy",
    ).map((m) => m.id);
    expect(lifetimeIds[0]).toBe("just_getting_started");
    expect(lifetimeIds).toContain("energized");
    expect(lifetimeIds).toContain("making_bank");
    expect(lifetimeIds).toContain("half_a_mil");
    expect(lifetimeIds).toContain("pretty_penny");
    expect(lifetimeIds).toContain("octogenarian");
    expect(lifetimeIds).toContain("lifetime_unvigintillion");
    expect(lifetimeIds).toHaveLength(29);
  });

  it("pond energy milestones span hundred through unvigintillionaire", () => {
    const pondIds = GLOBAL_MILESTONES.filter((m) => m.kind === "pond_energy").map(
      (m) => m.id,
    );
    expect(pondIds[0]).toBe("hundredaire");
    expect(pondIds).toContain("millionaire");
    expect(pondIds).toContain("unvigintillionaire");
    expect(pondIds).toHaveLength(25);
  });

  it("click milestones span 100 through unvigintillion", () => {
    const clickIds = GLOBAL_MILESTONES.filter((m) => m.kind === "total_clicks").map(
      (m) => m.id,
    );
    expect(clickIds[0]).toBe("get_clicking");
    expect(clickIds).toContain("clickthousand");
    expect(clickIds).toContain("clickunvigintillion");
    expect(clickIds).toHaveLength(25);
  });

  it("energy globals use lightning emoji", () => {
    for (const id of [
      "hundredaire",
      "millionaire",
      "pretty_penny",
      "octogenarian",
      "eps_trickle",
      "eps_deep_water_dynamo",
    ]) {
      const def = GLOBAL_MILESTONES.find((m) => m.id === id)!;
      expect(milestoneDisplayEmoji(def)).toBe("⚡");
    }
    const splash = MILESTONES.find((m) => m.id === "make_a_splash")!;
    expect(milestoneDisplayEmoji(splash)).not.toBe("⚡");
  });

  const GENERIC_TITLE_PATTERNS: Partial<
    Record<
      "energy_per_second" | "evolution_count" | "denizen_count" | "mutation",
      RegExp
    >
  > = {
    energy_per_second: / per Second$/,
    evolution_count: / Evolutions$/,
    denizen_count: /^\d+ /,
    mutation: /^Mutate /,
  };

  it("revised milestone kinds use catchy titles, not template labels", () => {
    for (const def of MILESTONES) {
      const pattern = GENERIC_TITLE_PATTERNS[def.kind as keyof typeof GENERIC_TITLE_PATTERNS];
      if (!pattern) continue;
      expect(def.title, def.id).not.toMatch(pattern);
    }
  });

  it("every EPS threshold has a custom title", () => {
    for (const threshold of ENERGY_PER_SECOND_MILESTONE_THRESHOLDS) {
      const def = ENERGY_PER_SECOND_MILESTONES.find((m) => m.threshold === threshold)!;
      expect(def.title).not.toMatch(/ per Second$/);
    }
  });

  it("evolution count ripple five uses custom title", () => {
    const five = MILESTONES.find((m) => m.id === "evolution_count_ripples_5")!;
    expect(five.title).toBe("Ripple Regiment");
  });

  it("mutate fungi five uses custom title", () => {
    const def = MILESTONES.find((m) => m.id === "mutate_fungi_5")!;
    expect(def.title).toBe("Spore Sport");
  });

  it("milestone titles are unique across the full catalog", () => {
    const byTitle = new Map<string, string[]>();
    for (const def of MILESTONES) {
      const ids = byTitle.get(def.title) ?? [];
      ids.push(def.id);
      byTitle.set(def.title, ids);
    }
    const dupes = [...byTitle.entries()].filter(([, ids]) => ids.length > 1);
    expect(dupes, dupes.map(([t, ids]) => `${t}: ${ids.join(", ")}`).join("\n")).toEqual(
      [],
    );
  });

  it("mutate fungi ten uses custom title and copy", () => {
    const def = MILESTONES.find((m) => m.id === "mutate_fungi_10")!;
    expect(def.title).toBe("Eternal Mycelium Mind");
    expect(def.description).toBe("Mutate your fungus ten times.");
    expect(def.criteriaText).toBe("Reach 10 mutations on Fungus");
  });

  it("denizen-first titles use custom copy where defined", () => {
    const byDenizen = new Map(
      buildDenizenFirstMilestones().map((m) => [m.denizenId, m.title]),
    );
    expect(byDenizen.get("ripples")).toBe("Single Drop");
    expect(byDenizen.get("fungi")).toBe("Fungus Amongus");
    expect(byDenizen.get("microbes")).toBe("It's Alive!");
    expect(byDenizen.get("reptiles")).toBe("Cowabunga!");
    expect(byDenizen.get("transcendence")).toBe("One with the Pond");
  });

  it("denizen-first descriptions welcome denizens to the pond", () => {
    const byDenizen = new Map(
      buildDenizenFirstMilestones().map((m) => [m.denizenId, m.description]),
    );
    expect(byDenizen.get("sediment")).toBe("Welcome sediment to your pond.");
    expect(byDenizen.get("zooplankton")).toBe("Welcome zooplankton to your pond.");
    expect(byDenizen.get("fungi")).toBe("Welcome a fungus to your pond.");
    expect(byDenizen.get("transcendence")).toBe(
      "Welcome transcendence to your pond.",
    );
    expect(byDenizen.get("aquatic_plants")).toBe(
      "Welcome an aquatic plant to your pond.",
    );
    for (const def of DENIZENS) {
      expect(byDenizen.get(def.id)).toBe(denizenFirstWelcomeDescription(def));
    }
  });
});

describe("isMilestoneMet", () => {
  it("ripplefinger at energy per click boundary", () => {
    const def = MILESTONES.find((m) => m.id === "ripplefinger")!;
    expect(isMilestoneMet(def, ctx({ energyPerClick: 4 }))).toBe(false);
    expect(isMilestoneMet(def, ctx({ energyPerClick: 5 }))).toBe(true);
    expect(def.title).toBe("Ripplefinger");
    expect(milestoneDisplayEmoji(def)).toBe("👆");
  });

  it("kiloflow at energy per second boundary", () => {
    const def = GLOBAL_MILESTONES.find((m) => m.id === "eps_kiloflow")!;
    expect(def.threshold).toBe(1_000);
    expect(isMilestoneMet(def, ctx({ energyPerSecond: 999.99 }))).toBe(false);
    expect(isMilestoneMet(def, ctx({ energyPerSecond: 1_000 }))).toBe(true);
    expect(def.description).toBe("Reach 1,000 energy per second.");
  });

  it("energy per second milestones ignore weather-boosted EpS in context", () => {
    const def = GLOBAL_MILESTONES.find((m) => m.id === "eps_kiloflow")!;
    const baseEps = 100;
    const boostedEps = 10_000;
    expect(isMilestoneMet(def, ctx({ energyPerSecond: baseEps }))).toBe(false);
    expect(isMilestoneMet(def, ctx({ energyPerSecond: boostedEps }))).toBe(true);
    // buildMilestoneEvalContext must pass base EpS (sim.energyPerSecond), not
    // effectiveEnergyPerSecond, so wind does not unlock EpS milestones early.
  });

  it("hundredaire at pond energy boundary", () => {
    const def = GLOBAL_MILESTONES.find((m) => m.id === "hundredaire")!;
    expect(isMilestoneMet(def, ctx({ energyInPond: 99 }))).toBe(false);
    expect(isMilestoneMet(def, ctx({ energyInPond: 100 }))).toBe(true);
  });

  it("millionaire at pond energy boundary", () => {
    const def = GLOBAL_MILESTONES.find((m) => m.id === "millionaire")!;
    expect(isMilestoneMet(def, ctx({ energyInPond: MILESTONE_MILLION - 1 }))).toBe(
      false,
    );
    expect(isMilestoneMet(def, ctx({ energyInPond: MILESTONE_MILLION }))).toBe(true);
    expect(def.description).toContain("Store one million or more");
    expect(def.description).not.toContain("Keep");
  });

  it("unvigintillionaire at short-scale pond energy ceiling", () => {
    const def = GLOBAL_MILESTONES.find((m) => m.id === "unvigintillionaire")!;
    expect(def.threshold).toBe(1e66);
    expect(def.title).toBe("Unvigintillionaire");
    expect(isMilestoneMet(def, ctx({ energyInPond: 1e66 }))).toBe(true);
  });

  it("skipping stone when ripple chain has one evolution", () => {
    const def = MILESTONES.find((m) => m.id === "skipping_stone")!;
    expect(def.description).toBe("Evolve your ripples.");
    expect(def.criteriaText).toBe("Evolve your Ripple");
    expect(isMilestoneMet(def, ctx())).toBe(false);
    expect(isMilestoneMet(def, ctx({ ownedSpecialties: { 1: true } }))).toBe(
      true,
    );
    expect(milestoneDisplayEmoji(def)).toBe("🌊");
  });

  it("sludge trudger when sediment chain has one evolution", () => {
    const def = MILESTONES.find((m) => m.id === "sludge_trudger")!;
    expect(isMilestoneMet(def, ctx())).toBe(false);
    expect(isMilestoneMet(def, ctx({ ownedSpecialties: { 16: true } }))).toBe(
      true,
    );
    expect(milestoneDisplayEmoji(def)).toBe("🪨");
  });

  it("evolution count copy uses Evolve your N times", () => {
    const five = MILESTONES.find((m) => m.id === "evolution_count_ripples_5")!;
    expect(five.description).toBe("Evolve your ripples 5 times.");
    expect(five.criteriaText).toBe("Evolve your Ripple 5 times");
  });

  it("evolution count fifteen requires fifteen in chain", () => {
    const def = MILESTONES.find((m) => m.id === "evolution_count_ripples_15")!;
    const chain = specialtiesForDenizen("ripples");
    const owned = Object.fromEntries(
      chain.slice(0, 14).map((s) => [s.id, true]),
    );
    expect(isMilestoneMet(def, ctx({ ownedSpecialties: owned }))).toBe(false);
    owned[chain[14]!.id] = true;
    expect(isMilestoneMet(def, ctx({ ownedSpecialties: owned }))).toBe(true);
  });

  it("abuzz when pollinator chain has one evolution", () => {
    const def = MILESTONES.find((m) => m.id === "abuzz")!;
    const chain = specialtiesForDenizen(POLLINATOR_SPECIALTY_DENIZEN_ID);
    expect(def.denizenId).toBe(POLLINATOR_SPECIALTY_DENIZEN_ID);
    expect(def.threshold).toBe(1);
    expect(def.description).toBe("Evolve your pollinators.");
    expect(def.criteriaText).toBe("Evolve your Pollinator");
    expect(isMilestoneMet(def, ctx())).toBe(false);
    expect(
      isMilestoneMet(def, ctx({ ownedSpecialties: { [chain[0]!.id]: true } })),
    ).toBe(true);
    expect(milestoneDisplayEmoji(def)).toBe("🐝");
  });

  it("fertile fen requires twenty pollinator evolutions", () => {
    const def = MILESTONES.find((m) => m.id === "fertile_fen")!;
    const chain = specialtiesForDenizen(POLLINATOR_SPECIALTY_DENIZEN_ID);
    const owned = Object.fromEntries(
      chain.slice(0, 19).map((s) => [s.id, true]),
    );
    expect(isMilestoneMet(def, ctx({ ownedSpecialties: owned }))).toBe(false);
    owned[chain[19]!.id] = true;
    expect(isMilestoneMet(def, ctx({ ownedSpecialties: owned }))).toBe(true);
  });

  it("a tree grows when one tree evolution is owned", () => {
    const def = MILESTONES.find((m) => m.id === "a_tree_grows")!;
    const chain = specialtiesForDenizen(TREE_SPECIALTY_DENIZEN_ID);
    expect(def.description).toBe("Evolve a tree.");
    expect(
      isMilestoneMet(def, ctx({ ownedSpecialties: { [chain[0]!.id]: true } })),
    ).toBe(true);
  });

  it("treebeard requires fifteen tree evolutions", () => {
    const def = MILESTONES.find((m) => m.id === "evolution_count_tree_15")!;
    expect(def.title).toBe("Treebeard");
    const chain = specialtiesForDenizen(TREE_SPECIALTY_DENIZEN_ID);
    expect(chain).toHaveLength(15);
    const owned = Object.fromEntries(chain.map((s) => [s.id, true]));
    expect(isMilestoneMet(def, ctx({ ownedSpecialties: owned }))).toBe(true);
  });

  it("cloudwatching and meteorology maestro for cloud chain", () => {
    const one = MILESTONES.find((m) => m.id === "cloudwatching")!;
    const chain = specialtiesForDenizen(CLOUD_SPECIALTY_DENIZEN_ID);
    expect(
      isMilestoneMet(one, ctx({ ownedSpecialties: { [chain[0]!.id]: true } })),
    ).toBe(true);

    const fifteen = MILESTONES.find((m) => m.id === "evolution_count_cloud_15")!;
    expect(fifteen.title).toBe("Meteorology Maestro");
    const owned = Object.fromEntries(chain.map((s) => [s.id, true]));
    expect(isMilestoneMet(fifteen, ctx({ ownedSpecialties: owned }))).toBe(
      true,
    );
  });

  it("get clicking at 100 clicks", () => {
    const def = GLOBAL_MILESTONES.find((m) => m.id === "get_clicking")!;
    expect(isMilestoneMet(def, ctx({ totalClicks: 99 }))).toBe(false);
    expect(isMilestoneMet(def, ctx({ totalClicks: 100 }))).toBe(true);
    expect(milestoneDisplayEmoji(def)).toBe("👆");
  });

  it("clickbillion at one billion clicks", () => {
    const def = GLOBAL_MILESTONES.find((m) => m.id === "clickbillion")!;
    expect(isMilestoneMet(def, ctx({ totalClicks: 1e9 - 1 }))).toBe(false);
    expect(isMilestoneMet(def, ctx({ totalClicks: 1e9 }))).toBe(true);
    expect(def.title).toBe("Clickbillion");
  });

  it("clickunvigintillion at short-scale ceiling", () => {
    const def = GLOBAL_MILESTONES.find((m) => m.id === "clickunvigintillion")!;
    expect(def.threshold).toBe(1e66);
  });

  it("making bank at two hundred fifty thousand all-time earned", () => {
    const def = GLOBAL_MILESTONES.find((m) => m.id === "making_bank")!;
    expect(isMilestoneMet(def, ctx({ allTimeEnergyEarned: 249_999 }))).toBe(
      false,
    );
    expect(isMilestoneMet(def, ctx({ allTimeEnergyEarned: 250_000 }))).toBe(
      true,
    );
    expect(def.description).toBe("Earn 250,000 total energy.");
  });

  it("half a mil at five hundred thousand all-time earned", () => {
    const def = GLOBAL_MILESTONES.find((m) => m.id === "half_a_mil")!;
    expect(isMilestoneMet(def, ctx({ allTimeEnergyEarned: 499_999 }))).toBe(
      false,
    );
    expect(isMilestoneMet(def, ctx({ allTimeEnergyEarned: 500_000 }))).toBe(
      true,
    );
  });

  it("pretty penny at all-time earned boundary", () => {
    const def = GLOBAL_MILESTONES.find((m) => m.id === "pretty_penny")!;
    expect(
      isMilestoneMet(def, ctx({ allTimeEnergyEarned: MILESTONE_MILLION - 1 })),
    ).toBe(false);
    expect(
      isMilestoneMet(def, ctx({ allTimeEnergyEarned: MILESTONE_MILLION })),
    ).toBe(true);
  });

  it("make a splash requires 100 ripples", () => {
    const def = MILESTONES.find((m) => m.id === "make_a_splash")!;
    expect(
      isMilestoneMet(def, ctx({ ownedDenizens: { ripples: 99 } })),
    ).toBe(false);
    expect(
      isMilestoneMet(def, ctx({ ownedDenizens: { ripples: 100 } })),
    ).toBe(true);
  });

  it("denizen count fifty and two thousand boundaries", () => {
    const fifty = MILESTONES.find((m) => m.id === "denizen_count_fungi_50")!;
    expect(isMilestoneMet(fifty, ctx({ ownedDenizens: { fungi: 49 } }))).toBe(
      false,
    );
    expect(isMilestoneMet(fifty, ctx({ ownedDenizens: { fungi: 50 } }))).toBe(
      true,
    );
    const twoK = MILESTONES.find((m) => m.id === "denizen_count_fungi_2000")!;
    expect(isMilestoneMet(twoK, ctx({ ownedDenizens: { fungi: 1999 } }))).toBe(
      false,
    );
    expect(isMilestoneMet(twoK, ctx({ ownedDenizens: { fungi: 2000 } }))).toBe(
      true,
    );
  });

  it("escape petri dish requires microbes mutation level 1", () => {
    const def = MILESTONES.find((m) => m.id === "escape_petri_dish")!;
    expect(isMilestoneMet(def, ctx())).toBe(false);
    expect(
      isMilestoneMet(def, ctx({ denizenMutationLevels: { microbes: 1 } })),
    ).toBe(true);
    expect(
      isMilestoneMet(def, ctx({ denizenMutationLevels: { microbes: 5 } })),
    ).toBe(true);
  });

  it("mutate five times requires mutation level 5", () => {
    const def = MILESTONES.find((m) => m.id === "mutate_fungi_5")!;
    expect(isMilestoneMet(def, ctx({ denizenMutationLevels: { fungi: 4 } }))).toBe(
      false,
    );
    expect(isMilestoneMet(def, ctx({ denizenMutationLevels: { fungi: 5 } }))).toBe(
      true,
    );
  });

  it("mutate ten times requires mutation level 10", () => {
    const def = MILESTONES.find((m) => m.id === "mutate_fungi_10")!;
    expect(isMilestoneMet(def, ctx({ denizenMutationLevels: { fungi: 9 } }))).toBe(
      false,
    );
    expect(isMilestoneMet(def, ctx({ denizenMutationLevels: { fungi: 10 } }))).toBe(
      true,
    );
  });

  it("octogenarian at octillion boundary", () => {
    const def = GLOBAL_MILESTONES.find((m) => m.id === "octogenarian")!;
    expect(
      isMilestoneMet(def, ctx({ allTimeEnergyEarned: 1e26 })),
    ).toBe(false);
    expect(
      isMilestoneMet(def, ctx({ allTimeEnergyEarned: MILESTONE_OCTILLION })),
    ).toBe(true);
    expect(def.kind).toBe("lifetime_energy");
  });

  it("lifetime billion at all-time earned boundary", () => {
    const def = GLOBAL_MILESTONES.find((m) => m.id === "lifetime_billion")!;
    expect(isMilestoneMet(def, ctx({ allTimeEnergyEarned: 1e9 - 1 }))).toBe(
      false,
    );
    expect(isMilestoneMet(def, ctx({ allTimeEnergyEarned: 1e9 }))).toBe(true);
    expect(def.title).toBe("Billion Earned");
  });

  it("denizen-first ripples at 0 vs 1 owned", () => {
    const def = MILESTONES.find((m) => m.id === "denizen_first_ripples")!;
    expect(isMilestoneMet(def, ctx())).toBe(false);
    expect(isMilestoneMet(def, ctx({ ownedDenizens: { ripples: 1 } }))).toBe(
      true,
    );
  });

  it("weather watcher at first weather click", () => {
    const def = MILESTONES.find((m) => m.id === "weather_watcher")!;
    expect(isMilestoneMet(def, ctx())).toBe(false);
    expect(isMilestoneMet(def, ctx({ weatherEventsClicked: 1 }))).toBe(true);
    expect(def.title).toBe("Weather Watcher");
  });

  it("sun-seeker at first sunny weather click", () => {
    const def = MILESTONES.find((m) => m.id === "sun_seeker")!;
    expect(isMilestoneMet(def, ctx({ weatherSunClicked: 1 }))).toBe(true);
    expect(def.title).toBe("Sun-Seeker");
  });

  it("precipitant at first rainy weather click", () => {
    const def = MILESTONES.find((m) => m.id === "precipitant")!;
    expect(isMilestoneMet(def, ctx({ weatherRainClicked: 1 }))).toBe(true);
  });

  it("weather wizbang at 1000 total weather clicks", () => {
    const def = MILESTONES.find((m) => m.id === "weather_wizbang")!;
    expect(isMilestoneMet(def, ctx({ weatherEventsClicked: 999 }))).toBe(false);
    expect(isMilestoneMet(def, ctx({ weatherEventsClicked: 1000 }))).toBe(true);
  });

  it("pond cyclist after the first pond cycle", () => {
    const def = MILESTONES.find((m) => m.id === "pond_cyclist")!;
    expect(def.title).toBe("Pond Cyclist");
    expect(def.description).toBe("Cycle your pond.");
    expect(isMilestoneMet(def, ctx({ pondEra: 1 }))).toBe(false);
    expect(isMilestoneMet(def, ctx({ pondEra: 2 }))).toBe(true);
    expect(milestoneDisplayEmoji(def)).toBe("🔁");
  });

  it("cycle-angelo after the second pond cycle", () => {
    const def = MILESTONES.find((m) => m.id === "cycle_angelo")!;
    expect(def.title).toBe("Cycle-angelo");
    expect(isMilestoneMet(def, ctx({ pondEra: 2 }))).toBe(false);
    expect(isMilestoneMet(def, ctx({ pondEra: 3 }))).toBe(true);
  });

  it("set it in stone when stratified pond is owned", () => {
    const def = MILESTONES.find((m) => m.id === "set_it_in_stone")!;
    expect(def.title).toBe("Set it in Stone");
    expect(isMilestoneMet(def, ctx())).toBe(false);
    expect(
      isMilestoneMet(
        def,
        ctx({ ownedSpecialties: { [STRATIFIED_POND_SPECIALTY_ID]: true } }),
      ),
    ).toBe(true);
    expect(milestoneDisplayEmoji(def)).toBe("🦴");
  });

  it("dino d-n-a when fossil record is owned", () => {
    const def = MILESTONES.find((m) => m.id === "dino_dna")!;
    expect(def.title).toBe("Dino D-N-A!");
    expect(def.description).toBe("Buy Fossil Record from the fossil shop.");
    expect(isMilestoneMet(def, ctx())).toBe(false);
    expect(
      isMilestoneMet(
        def,
        ctx({ ownedSpecialties: { [FOSSIL_RECORD_SPECIALTY_ID]: true } }),
      ),
    ).toBe(true);
  });

  it("into the woods and clouds above when fossil gates are owned", () => {
    const woods = MILESTONES.find((m) => m.id === "into_the_woods")!;
    expect(woods.title).toBe("Into the Woods");
    expect(woods.description).toBe("Buy Wooded Shore at the fossil shop.");
    expect(
      isMilestoneMet(
        woods,
        ctx({ ownedSpecialties: { [WOODED_SHORE_SPECIALTY_ID]: true } }),
      ),
    ).toBe(true);

    const clouds = MILESTONES.find((m) => m.id === "clouds_above")!;
    expect(clouds.title).toBe("Clouds Above");
    expect(
      isMilestoneMet(
        clouds,
        ctx({ ownedSpecialties: { [GATHERING_CLOUDS_SPECIALTY_ID]: true } }),
      ),
    ).toBe(true);
  });

  it("perpetual motion and at weather's whim when ripples and el niño are owned", () => {
    const ripples = MILESTONES.find((m) => m.id === "perpetual_motion")!;
    expect(ripples.title).toBe("Perpetual Motion");
    expect(ripples.description).toBe(
      "Buy Ripples of Eternity from the fossil shop.",
    );
    expect(
      isMilestoneMet(
        ripples,
        ctx({
          ownedSpecialties: { [RIPPLES_OF_ETERNITY_SPECIALTY_ID]: true },
        }),
      ),
    ).toBe(true);

    const elNino = MILESTONES.find((m) => m.id === "at_weathers_whim")!;
    expect(elNino.title).toBe("At Weather's Whim");
    expect(
      isMilestoneMet(
        elNino,
        ctx({ ownedSpecialties: { [EL_NINO_SPECIALTY_ID]: true } }),
      ),
    ).toBe(true);
  });

  it("pentacycle and pondclicker addict at era boundaries", () => {
    const five = MILESTONES.find((m) => m.id === "pentacycle")!;
    expect(five.description).toBe("Cycle your pond 5 times.");
    expect(isMilestoneMet(five, ctx({ pondEra: 5 }))).toBe(false);
    expect(isMilestoneMet(five, ctx({ pondEra: 6 }))).toBe(true);

    const addict = MILESTONES.find((m) => m.id === "pondclicker_addict")!;
    expect(addict.title).toBe("PondClicker Addict");
    expect(isMilestoneMet(addict, ctx({ pondEra: 100 }))).toBe(false);
    expect(isMilestoneMet(addict, ctx({ pondEra: 101 }))).toBe(true);
  });
});

describe("evaluateNewMilestones", () => {
  it("awards set it in stone when stratified pond is purchased", () => {
    expect(
      evaluateNewMilestones(
        ctx({ ownedSpecialties: { [STRATIFIED_POND_SPECIALTY_ID]: true } }),
        {},
      ),
    ).toContain("set_it_in_stone");
  });

  it("awards dino d-n-a when fossil record is purchased", () => {
    expect(
      evaluateNewMilestones(
        ctx({ ownedSpecialties: { [FOSSIL_RECORD_SPECIALTY_ID]: true } }),
        {},
      ),
    ).toContain("dino_dna");
  });

  it("awards into the woods and clouds above when fossil gates are purchased", () => {
    expect(
      evaluateNewMilestones(
        ctx({ ownedSpecialties: { [WOODED_SHORE_SPECIALTY_ID]: true } }),
        {},
      ),
    ).toContain("into_the_woods");
    expect(
      evaluateNewMilestones(
        ctx({ ownedSpecialties: { [GATHERING_CLOUDS_SPECIALTY_ID]: true } }),
        {},
      ),
    ).toContain("clouds_above");
  });

  it("awards perpetual motion and at weather's whim when ripples and el niño are purchased", () => {
    expect(
      evaluateNewMilestones(
        ctx({
          ownedSpecialties: { [RIPPLES_OF_ETERNITY_SPECIALTY_ID]: true },
        }),
        {},
      ),
    ).toContain("perpetual_motion");
    expect(
      evaluateNewMilestones(
        ctx({ ownedSpecialties: { [EL_NINO_SPECIALTY_ID]: true } }),
        {},
      ),
    ).toContain("at_weathers_whim");
  });

  it("awards pond cycle milestones when pond era crosses thresholds", () => {
    expect(
      evaluateNewMilestones(ctx({ pondEra: 2 }), {}),
    ).toContain("pond_cyclist");
    expect(
      evaluateNewMilestones(ctx({ pondEra: 2 }), {}),
    ).not.toContain("cycle_angelo");
    expect(
      evaluateNewMilestones(ctx({ pondEra: 3 }), { pond_cyclist: 1 }),
    ).toEqual(["cycle_angelo"]);
  });

  it("returns each id only once", () => {
    const first = evaluateNewMilestones(
      ctx({ ownedDenizens: { ripples: 1 } }),
      {},
    );
    expect(first).toContain("denizen_first_ripples");
    const reached = Object.fromEntries(first.map((id) => [id, 1]));
    const second = evaluateNewMilestones(
      ctx({ ownedDenizens: { ripples: 1 } }),
      reached,
    );
    expect(second).toHaveLength(0);
  });
});

describe("compareMilestoneReachedTimes", () => {
  it("ranks later catalog milestones first when reachedAtMs ties", () => {
    const at = 1_000;
    expect(
      compareMilestoneReachedTimes(
        { id: "eps_kiloflow", reachedAtMs: at },
        { id: "eps_algal_autobahn", reachedAtMs: at },
      ),
    ).toBeGreaterThan(0);
  });
});

describe("celebrationMilestoneDefs", () => {
  it("returns unreached-dismissed newest first", () => {
    const reached = {
      hundredaire: 1,
      millionaire: 2,
      pretty_penny: 3,
    };
    expect(celebrationMilestoneDefs(reached, {}).map((d) => d.id)).toEqual([
      "pretty_penny",
      "millionaire",
      "hundredaire",
    ]);
  });

  it("puts later catalog milestones first when reachedAtMs ties", () => {
    const reached = {
      eps_kiloflow: 100,
      eps_algal_autobahn: 100,
    };
    expect(celebrationMilestoneDefs(reached, {}).map((d) => d.id)).toEqual([
      "eps_algal_autobahn",
      "eps_kiloflow",
    ]);
  });

  it("omits dismissed milestones", () => {
    const reached = {
      hundredaire: 1,
      millionaire: 2,
      pretty_penny: 3,
    };
    expect(
      celebrationMilestoneDefs(reached, { pretty_penny: true }).map((d) => d.id),
    ).toEqual(["millionaire", "hundredaire"]);
  });
});

describe("nextCelebrationMilestoneId", () => {
  it("returns most recently earned celebration milestone id", () => {
    const reached = { hundredaire: 1, millionaire: 2 };
    expect(nextCelebrationMilestoneId(reached, {})).toBe("millionaire");
  });
});

describe("countMilestonesReached", () => {
  it("counts only known milestone ids", () => {
    expect(
      countMilestonesReached({
        millionaire: 1,
        unknown: 2,
        denizen_first_ripples: 3,
      }),
    ).toBe(2);
  });
});

describe("normalizeMilestonesReached", () => {
  it("remaps legacy EPS milestone ids on load", () => {
    const reached = normalizeMilestonesReached({
      eps_quarter_k: 100,
      eps_million_per_second: 200,
    });
    expect(reached.eps_steady_stream).toBe(100);
    expect(reached.eps_marsh_metabolism).toBe(200);
    expect(reached.eps_quarter_k).toBeUndefined();
  });
});
