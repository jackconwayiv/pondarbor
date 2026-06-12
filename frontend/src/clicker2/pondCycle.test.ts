import { describe, expect, it } from "vitest";

import { createDefaultClicker2State } from "./api";
import {
  FOSSIL_RECORD_SPECIALTY_ID,
  FOSSIL_SHOP_SPECIALTY_IDS,
  RIPPLES_OF_ETERNITY_SPECIALTY_ID,
  STRATIFIED_POND_SPECIALTY_ID,
} from "./fossilShop";
import { FIRST_DENIZEN_ID } from "./denizens";
import {
  applyPondCycle,
  fossilsGrantedOnCycle,
  grantFossilsFromUnfossilizedStrata,
  isPondCycleInterstitial,
  pondCycleResetStillPending,
  repairEnergyAfterPondCycle,
  repairCycleStartOwnedDenizens,
  repairMidCycleInterstitialState,
  unfossilizedStrataCount,
} from "./pondCycle";
import { STRATUM_ENERGY_UNIT } from "./strata";

describe("unfossilizedStrataCount", () => {
  it("is current level minus fossilized", () => {
    const oneT = STRATUM_ENERGY_UNIT;
    expect(unfossilizedStrataCount(oneT * 8, 1)).toBe(1);
    expect(unfossilizedStrataCount(oneT * 8, 2)).toBe(0);
  });
});

describe("applyPondCycle", () => {
  it("does not double-grant fossils when strata were already fossilized", () => {
    const oneT = STRATUM_ENERGY_UNIT;
    const base = createDefaultClicker2State();
    const state = {
      ...base,
      fossils: 0,
      fossilized_strata: 0,
      statistics: {
        ...base.statistics,
        all_time_energy_earned: oneT * 27,
      },
    };

    const afterGrant = grantFossilsFromUnfossilizedStrata(state);
    expect(afterGrant.fossils).toBe(3);
    expect(afterGrant.fossilized_strata).toBe(3);

    const afterCycle = applyPondCycle(afterGrant, 1_000_000);
    expect(afterCycle.fossils).toBe(3);
    expect(afterCycle.fossilized_strata).toBe(3);
    expect(afterCycle.total_fossils_earned).toBe(3);
  });

  it("awards one fossil per unfossilized stratum, fossilizes them, and leaves zero unfossilized", () => {
    const oneT = STRATUM_ENERGY_UNIT;
    const base = createDefaultClicker2State();
    const allTime = oneT * 27;
    const state = {
      ...base,
      fossilized_strata: 0,
      fossils: 10,
      total_fossils_earned: 25,
      statistics: {
        ...base.statistics,
        all_time_energy_earned: allTime,
      },
    };

    const unfossilizedBefore = unfossilizedStrataCount(
      allTime,
      state.fossilized_strata,
    );
    expect(unfossilizedBefore).toBe(3);

    const grant = fossilsGrantedOnCycle(allTime, state.fossilized_strata);
    expect(grant).toBe(unfossilizedBefore);

    const next = applyPondCycle(state, 5_000_000);

    expect(next.fossils).toBe(state.fossils + grant);
    expect(next.total_fossils_earned).toBe(state.total_fossils_earned + grant);
    expect(next.fossilized_strata).toBe(state.fossilized_strata + grant);
    expect(next.fossilized_strata).toBe(3);

    expect(
      unfossilizedStrataCount(allTime, next.fossilized_strata),
    ).toBe(0);
  });

  it("fossilizes unfossilized strata and resets run state", () => {
    const oneT = STRATUM_ENERGY_UNIT;
    const base = createDefaultClicker2State();
    const state = {
      ...base,
      energy: 500,
      pond_era: 1,
      fossils: 2,
      fossilized_strata: 1,
      owned_denizens: { ripples: 5 },
      owned_specialties: {
        [STRATIFIED_POND_SPECIALTY_ID]: true,
        680: true,
      },
      specialty_acquired_at_ms: {
        [STRATIFIED_POND_SPECIALTY_ID]: 100,
        680: 200,
      },
      statistics: {
        ...base.statistics,
        all_time_energy_earned: oneT * 8,
        era_energy_earned: oneT,
        energy_from_clicking: 50,
        denizen_energy_earned: { ripples: 10 },
      },
      milestones_reached: { pond_energy_1k: 1 },
      mutagens_bank: 3,
      denizen_mutation_levels: { ripples: 2 },
    };

    const next = applyPondCycle(state, 1_000_000);

    expect(fossilsGrantedOnCycle(state.statistics.all_time_energy_earned, 1)).toBe(
      1,
    );
    expect(next.fossilized_strata).toBe(2);
    expect(next.fossils).toBe(3);
    expect(next.total_fossils_earned).toBe(1);
    expect(next.energy).toBe(0);
    expect(next.statistics.era_energy_earned).toBe(0);
    expect(next.statistics.all_time_energy_earned).toBe(oneT * 8);
    expect(next.statistics.energy_from_clicking).toBe(50);
    expect(next.statistics.denizen_energy_earned).toEqual({});
    expect(next.owned_denizens).toEqual({});
    expect(next.owned_specialties).toEqual({
      [STRATIFIED_POND_SPECIALTY_ID]: true,
    });
    expect(next.specialty_acquired_at_ms).toEqual({
      [STRATIFIED_POND_SPECIALTY_ID]: 100,
    });
    expect(next.pond_era).toBe(2);
    expect(next.milestones_reached).toEqual(state.milestones_reached);
    expect(next.mutagens_bank).toBe(3);
    expect(next.denizen_mutation_levels).toEqual({ ripples: 2 });
    expect(next.next_weather_spawn_remaining_ms).toBe(0);
  });

  it("resets denizens and regular evolutions but keeps fossil shop purchases", () => {
    const oneT = STRATUM_ENERGY_UNIT;
    const base = createDefaultClicker2State();
    const fossilShopId = STRATIFIED_POND_SPECIALTY_ID;
    const state = {
      ...base,
      fossilized_strata: 0,
      owned_denizens: { ripples: 12, sediment: 3, fungi: 1 },
      owned_specialties: {
        [fossilShopId]: true,
        [FOSSIL_RECORD_SPECIALTY_ID]: true,
        [RIPPLES_OF_ETERNITY_SPECIALTY_ID]: true,
        199: true,
        680: true,
        681: true,
      } satisfies Record<number, boolean>,
      specialty_acquired_at_ms: {
        [fossilShopId]: 1_000,
        [FOSSIL_RECORD_SPECIALTY_ID]: 1_500,
        [RIPPLES_OF_ETERNITY_SPECIALTY_ID]: 1_600,
        199: 2_000,
        680: 3_000,
        681: 4_000,
      },
      denizen_purchase_timeline: ["🌊", "🪨", "🍄"],
      statistics: {
        ...base.statistics,
        all_time_energy_earned: oneT,
      },
    };

    const next = applyPondCycle(state, 6_000_000);

    expect(next.owned_denizens).toEqual({ ripples: 10 });
    expect(next.denizen_purchase_timeline).toEqual([]);
    expect(next.revealed_denizens).toEqual({ [FIRST_DENIZEN_ID]: true });

    expect(next.owned_specialties).toEqual({
      [fossilShopId]: true,
      [FOSSIL_RECORD_SPECIALTY_ID]: true,
      [RIPPLES_OF_ETERNITY_SPECIALTY_ID]: true,
    });
    const ownedBefore = state.owned_specialties as Record<number, boolean>;
    for (const id of FOSSIL_SHOP_SPECIALTY_IDS) {
      if (ownedBefore[id]) {
        expect(next.owned_specialties[id]).toBe(true);
      }
    }
    expect(next.owned_specialties[199]).toBeUndefined();
    expect(next.owned_specialties[680]).toBeUndefined();
    expect(next.owned_specialties[681]).toBeUndefined();
    expect(next.specialty_acquired_at_ms).toEqual({
      [fossilShopId]: 1_000,
      [FOSSIL_RECORD_SPECIALTY_ID]: 1_500,
      [RIPPLES_OF_ETERNITY_SPECIALTY_ID]: 1_600,
    });
  });

  it("keeps unspent fossils and adds one per newly fossilized stratum", () => {
    const oneT = STRATUM_ENERGY_UNIT;
    const base = createDefaultClicker2State();
    const state = {
      ...base,
      fossils: 12,
      total_fossils_earned: 15,
      fossilized_strata: 1,
      statistics: {
        ...base.statistics,
        all_time_energy_earned: oneT * 8,
      },
    };

    const grant = fossilsGrantedOnCycle(
      state.statistics.all_time_energy_earned,
      state.fossilized_strata,
    );
    expect(grant).toBe(1);

    const next = applyPondCycle(state, 2_000_000);

    expect(next.fossils).toBe(state.fossils + grant);
    expect(next.total_fossils_earned).toBe(state.total_fossils_earned + grant);
  });

  it("keeps unspent fossils when there is nothing new to fossilize", () => {
    const oneT = STRATUM_ENERGY_UNIT;
    const base = createDefaultClicker2State();
    const state = {
      ...base,
      fossils: 17,
      total_fossils_earned: 20,
      fossilized_strata: 2,
      statistics: {
        ...base.statistics,
        all_time_energy_earned: oneT * 8,
      },
    };

    expect(
      fossilsGrantedOnCycle(
        state.statistics.all_time_energy_earned,
        state.fossilized_strata,
      ),
    ).toBe(0);

    const next = applyPondCycle(state, 3_000_000);

    expect(next.fossils).toBe(17);
    expect(next.total_fossils_earned).toBe(20);
    expect(next.fossilized_strata).toBe(2);
  });

  it("keeps mutation levels, mutagen bank, and lifetime mutagens acquired", () => {
    const oneT = STRATUM_ENERGY_UNIT;
    const base = createDefaultClicker2State();
    const state = {
      ...base,
      fossilized_strata: 0,
      mutagens_bank: 7,
      total_mutagens_acquired: 42,
      denizen_mutation_levels: {
        ripples: 4,
        sediment: 10,
        fungi: 1,
      },
      statistics: {
        ...base.statistics,
        all_time_energy_earned: oneT,
      },
    };

    const next = applyPondCycle(state, 4_000_000);

    expect(next.mutagens_bank).toBe(7);
    expect(next.total_mutagens_acquired).toBe(42);
    expect(next.denizen_mutation_levels).toEqual({
      ripples: 4,
      sediment: 10,
      fungi: 1,
    });
  });
});

describe("fossilized strata across pond cycles", () => {
  const oneT = STRATUM_ENERGY_UNIT;

  it("does not fossilize the same strata again when lifetime level is unchanged", () => {
    const base = createDefaultClicker2State();
    const allTime = oneT * 8;
    const afterFirst = applyPondCycle(
      {
        ...base,
        fossilized_strata: 1,
        fossils: 5,
        statistics: {
          ...base.statistics,
          all_time_energy_earned: allTime,
        },
      },
      1_000_000,
    );

    expect(afterFirst.fossilized_strata).toBe(2);
    expect(afterFirst.fossils).toBe(6);
    expect(unfossilizedStrataCount(allTime, afterFirst.fossilized_strata)).toBe(0);
    expect(
      fossilsGrantedOnCycle(allTime, afterFirst.fossilized_strata),
    ).toBe(0);

    const afterSecond = applyPondCycle(afterFirst, 2_000_000);

    expect(afterSecond.fossilized_strata).toBe(2);
    expect(afterSecond.fossils).toBe(6);
    expect(afterSecond.pond_era).toBe(3);
  });

  it("retains fossilized strata from cycle to cycle", () => {
    const base = createDefaultClicker2State();
    const afterFirst = applyPondCycle(
      {
        ...base,
        fossilized_strata: 0,
        statistics: {
          ...base.statistics,
          all_time_energy_earned: oneT,
        },
      },
      1_000_000,
    );

    expect(afterFirst.fossilized_strata).toBe(1);

    const afterSecond = applyPondCycle(
      {
        ...afterFirst,
        statistics: {
          ...afterFirst.statistics,
          era_energy_earned: oneT * 2,
        },
      },
      2_000_000,
    );

    expect(afterSecond.fossilized_strata).toBe(1);
    expect(afterSecond.statistics.all_time_energy_earned).toBe(oneT);
  });

  it("fossilizes only newly earned strata after lifetime progress between cycles", () => {
    const base = createDefaultClicker2State();
    const afterFirst = applyPondCycle(
      {
        ...base,
        fossilized_strata: 0,
        fossils: 0,
        total_fossils_earned: 0,
        statistics: {
          ...base.statistics,
          all_time_energy_earned: oneT,
        },
      },
      1_000_000,
    );

    expect(afterFirst.fossilized_strata).toBe(1);
    expect(afterFirst.fossils).toBe(1);

    const allTimeAfterProgress = oneT * 27;
    const progressed = {
      ...afterFirst,
      statistics: {
        ...afterFirst.statistics,
        all_time_energy_earned: allTimeAfterProgress,
      },
    };

    expect(unfossilizedStrataCount(allTimeAfterProgress, 1)).toBe(2);

    const afterSecond = applyPondCycle(progressed, 2_000_000);

    expect(afterSecond.fossilized_strata).toBe(3);
    expect(afterSecond.fossils).toBe(3);
    expect(afterSecond.total_fossils_earned).toBe(3);
    expect(afterSecond.pond_era).toBe(3);
  });
});

describe("repairMidCycleInterstitialState", () => {
  it("applies pond cycle when interstitial flag is set but run state remains", () => {
    const oneT = STRATUM_ENERGY_UNIT;
    const base = createDefaultClicker2State();
    const broken = {
      ...base,
      pond_era: 1,
      pond_cycle_interstitial: true,
      owned_denizens: { ripples: 4 },
      fossils: 2,
      fossilized_strata: 1,
      statistics: {
        ...base.statistics,
        all_time_energy_earned: oneT * 8,
        era_energy_earned: oneT,
      },
    };

    expect(pondCycleResetStillPending(broken)).toBe(true);
    const repaired = repairMidCycleInterstitialState(broken, 9_000_000);

    expect(repaired.pond_cycle_interstitial).toBe(true);
    expect(repaired.pond_era).toBe(2);
    expect(repaired.owned_denizens).toEqual({});
    expect(repaired.statistics.era_energy_earned).toBe(0);
    expect(isPondCycleInterstitial(repaired)).toBe(true);
  });

  it("leaves already-cycled interstitial saves unchanged", () => {
    const base = createDefaultClicker2State();
    const midCycle = {
      ...applyPondCycle(
        {
          ...base,
          statistics: {
            ...base.statistics,
            all_time_energy_earned: STRATUM_ENERGY_UNIT * 8,
          },
        },
        1_000_000,
      ),
      pond_cycle_interstitial: true,
    };

    expect(pondCycleResetStillPending(midCycle)).toBe(false);
    expect(repairMidCycleInterstitialState(midCycle, 2_000_000)).toEqual(midCycle);
  });
});

describe("repairCycleStartOwnedDenizens", () => {
  it("backfills ripples when Ripples of Eternity is owned but denizens were reset earlier", () => {
    const base = createDefaultClicker2State();
    const repaired = repairCycleStartOwnedDenizens({
      ...base,
      pond_era: 2,
      owned_denizens: {},
      owned_specialties: {
        [STRATIFIED_POND_SPECIALTY_ID]: true,
        [FOSSIL_RECORD_SPECIALTY_ID]: true,
        [RIPPLES_OF_ETERNITY_SPECIALTY_ID]: true,
      },
    });
    expect(repaired.owned_denizens).toEqual({ ripples: 10 });
  });
});

describe("repairEnergyAfterPondCycle", () => {
  it("clears stray pond energy after cycle with no denizens", () => {
    const base = createDefaultClicker2State();
    const repaired = repairEnergyAfterPondCycle({
      ...base,
      pond_era: 2,
      energy: 9_999_999,
      owned_denizens: {},
    });
    expect(repaired.energy).toBe(0);
  });

  it("leaves era 1 and in-run saves unchanged", () => {
    const base = createDefaultClicker2State();
    expect(
      repairEnergyAfterPondCycle({ ...base, energy: 500 }).energy,
    ).toBe(500);
    expect(
      repairEnergyAfterPondCycle({
        ...base,
        pond_era: 3,
        energy: 500,
        owned_denizens: { ripples: 1 },
        statistics: {
          ...base.statistics,
          era_energy_earned: 1_000,
        },
        denizen_purchase_timeline: ["🌊"],
      }).energy,
    ).toBe(500);
  });

  it("clears stray energy at fresh era start with cycle-start denizens only", () => {
    const base = createDefaultClicker2State();
    const repaired = repairEnergyAfterPondCycle({
      ...base,
      pond_era: 2,
      energy: 9_999_999,
      owned_denizens: { ripples: 10 },
      denizen_purchase_timeline: [],
      statistics: {
        ...base.statistics,
        era_energy_earned: 0,
      },
    });
    expect(repaired.energy).toBe(0);
  });
});
