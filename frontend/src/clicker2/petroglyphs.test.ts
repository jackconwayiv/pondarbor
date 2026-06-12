import { describe, expect, it } from "vitest";

import { createDefaultClicker2State } from "./api";
import {
  FOSSIL_RECORD_SPECIALTY_ID,
  PETROGLYPH_I_SPECIALTY_ID,
  RIPPLES_OF_ETERNITY_SPECIALTY_ID,
  STRATIFIED_POND_SPECIALTY_ID,
} from "./fossilShop";
import {
  applyPetroglyphsOnCycleStart,
  capturePetroglyphEtchPool,
  createBlankPetroglyphSlot,
  eligiblePetroglyphEvolutionDefs,
  normalizePetroglyphSlots,
  petroglyphSlotCanEtch,
  syncOwnedFromPetroglyphEtch,
} from "./petroglyphs";
import { applyPondCycle } from "./pondCycle";
import { getSpecialtyDef } from "./specialties";
import { STRATUM_ENERGY_UNIT } from "./strata";
import { isSpecialtyShopVisible } from "./visibility";

describe("eligiblePetroglyphEvolutionDefs", () => {
  const owned = {
    4: true,
    [STRATIFIED_POND_SPECIALTY_ID]: true,
    [FOSSIL_RECORD_SPECIALTY_ID]: true,
  };

  it("includes owned energy-shop evolutions only", () => {
    const eligible = eligiblePetroglyphEvolutionDefs(owned, []);
    expect(eligible.some((def) => def.id === 4)).toBe(true);
    expect(eligible.some((def) => def.id === FOSSIL_RECORD_SPECIALTY_ID)).toBe(
      false,
    );
  });

  it("includes evolutions from etch pool after cycle prune", () => {
    const eligible = eligiblePetroglyphEvolutionDefs(
      {
        [STRATIFIED_POND_SPECIALTY_ID]: true,
        [PETROGLYPH_I_SPECIALTY_ID]: true,
      },
      [createBlankPetroglyphSlot(PETROGLYPH_I_SPECIALTY_ID)],
      0,
      [4, 5],
    );
    expect(eligible.map((def) => def.id)).toEqual(expect.arrayContaining([4, 5]));
  });

  it("excludes evolutions already etched in any slot", () => {
    const slots = [
      {
        ...createBlankPetroglyphSlot(PETROGLYPH_I_SPECIALTY_ID),
        etched_specialty_id: 4,
        etched_at_ms: 100,
      },
    ];
    expect(
      eligiblePetroglyphEvolutionDefs({ ...owned, 5: true }, slots, undefined, [5]).some(
        (def) => def.id === 4,
      ),
    ).toBe(false);
    expect(
      eligiblePetroglyphEvolutionDefs({ ...owned, 5: true }, slots, undefined, [5]).some(
        (def) => def.id === 5,
      ),
    ).toBe(true);
  });

  it("returns nothing when the target slot is already etched", () => {
    const slots = [
      {
        ...createBlankPetroglyphSlot(PETROGLYPH_I_SPECIALTY_ID),
        etched_specialty_id: 4,
        etched_at_ms: 100,
      },
    ];
    expect(
      eligiblePetroglyphEvolutionDefs(
        owned,
        slots,
        0,
        [5],
      ),
    ).toEqual([]);
  });
});

describe("petroglyphSlotCanEtch", () => {
  it("is false once a slot has a permanent etch", () => {
    const slots = [
      {
        ...createBlankPetroglyphSlot(PETROGLYPH_I_SPECIALTY_ID),
        etched_specialty_id: 4,
        etched_at_ms: 100,
      },
    ];
    expect(
      petroglyphSlotCanEtch(
        { [STRATIFIED_POND_SPECIALTY_ID]: true, [PETROGLYPH_I_SPECIALTY_ID]: true },
        slots,
        0,
        [5],
      ),
    ).toBe(false);
  });
});

describe("normalizePetroglyphSlots", () => {
  it("dedupes etched specialty ids across slots", () => {
    const slots = normalizePetroglyphSlots([
      {
        petroglyph_specialty_id: PETROGLYPH_I_SPECIALTY_ID,
        etched_specialty_id: 4,
        etched_at_ms: 100,
      },
      {
        petroglyph_specialty_id: PETROGLYPH_I_SPECIALTY_ID,
        etched_specialty_id: 4,
        etched_at_ms: 200,
      },
    ]);
    expect(slots).toHaveLength(2);
    expect(slots[0]?.etched_specialty_id).toBe(4);
    expect(slots[1]?.etched_specialty_id).toBeNull();
  });
});

describe("applyPondCycle petroglyphs", () => {
  const oneT = STRATUM_ENERGY_UNIT;

  it("restores etched evolution after prune", () => {
    const base = createDefaultClicker2State();
    const state = {
      ...base,
      fossilized_strata: 0,
      owned_specialties: {
        [STRATIFIED_POND_SPECIALTY_ID]: true,
        [PETROGLYPH_I_SPECIALTY_ID]: true,
        4: true,
        680: true,
      },
      petroglyph_slots: [
        {
          petroglyph_specialty_id: PETROGLYPH_I_SPECIALTY_ID,
          etched_specialty_id: 4,
          etched_at_ms: 9_000,
        },
      ],
      statistics: {
        ...base.statistics,
        all_time_energy_earned: oneT,
      },
    };

    const next = applyPondCycle(state, 1_000_000);

    expect(next.owned_specialties[680]).toBeUndefined();
    expect(next.owned_specialties[4]).toBe(true);
    expect(next.specialty_acquired_at_ms[4]).toBe(9_000);
    expect(next.petroglyph_slots).toEqual(state.petroglyph_slots);
  });

  it("leaves blank slots without restoring evolutions", () => {
    const base = createDefaultClicker2State();
    const state = {
      ...base,
      fossilized_strata: 0,
      owned_specialties: {
        [STRATIFIED_POND_SPECIALTY_ID]: true,
        [PETROGLYPH_I_SPECIALTY_ID]: true,
        4: true,
      },
      petroglyph_slots: [createBlankPetroglyphSlot(PETROGLYPH_I_SPECIALTY_ID)],
      statistics: {
        ...base.statistics,
        all_time_energy_earned: oneT,
      },
    };

    const next = applyPondCycle(state, 1_000_000);

    expect(next.owned_specialties[4]).toBeUndefined();
    expect(next.petroglyph_slots[0]?.etched_specialty_id).toBeNull();
    expect(next.petroglyph_etch_pool).toEqual([4]);
  });

  it("keeps a permanent etch across the next cycle", () => {
    const base = createDefaultClicker2State();
    const state = {
      ...base,
      fossilized_strata: 0,
      owned_specialties: {
        [STRATIFIED_POND_SPECIALTY_ID]: true,
        [PETROGLYPH_I_SPECIALTY_ID]: true,
        4: true,
      },
      specialty_acquired_at_ms: { 4: 50_000 },
      petroglyph_slots: [
        {
          petroglyph_specialty_id: PETROGLYPH_I_SPECIALTY_ID,
          etched_specialty_id: 4,
          etched_at_ms: 50_000,
        },
      ],
      statistics: {
        ...base.statistics,
        all_time_energy_earned: oneT,
      },
    };

    const next = applyPondCycle(state, 1_000_000);

    expect(next.owned_specialties[4]).toBe(true);
    expect(next.specialty_acquired_at_ms[4]).toBe(50_000);
    expect(next.petroglyph_slots[0]?.etched_specialty_id).toBe(4);
  });
});

describe("capturePetroglyphEtchPool", () => {
  it("captures owned energy-shop evolutions only", () => {
    expect(
      capturePetroglyphEtchPool({
        4: true,
        5: true,
        [STRATIFIED_POND_SPECIALTY_ID]: true,
        [FOSSIL_RECORD_SPECIALTY_ID]: true,
      }),
    ).toEqual([4, 5]);
  });
});

describe("syncOwnedFromPetroglyphEtch", () => {
  it("merges etched evolution into owned for shop and simulation", () => {
    const slots = [
      {
        ...createBlankPetroglyphSlot(PETROGLYPH_I_SPECIALTY_ID),
        etched_specialty_id: 4,
        etched_at_ms: 50_000,
      },
    ];
    const synced = syncOwnedFromPetroglyphEtch(
      { [STRATIFIED_POND_SPECIALTY_ID]: true, [PETROGLYPH_I_SPECIALTY_ID]: true },
      {},
      slots,
    );
    expect(synced.owned_specialties[4]).toBe(true);
    expect(synced.specialty_acquired_at_ms[4]).toBe(50_000);
    expect(
      isSpecialtyShopVisible(
        getSpecialtyDef(4)!,
        {},
        synced.owned_specialties,
        0,
        0,
        0,
      ),
    ).toBe(false);
  });
});

describe("petroglyph etch flow", () => {
  const oneT = STRATUM_ENERGY_UNIT;

  it("cycles into an etch pool, then a permanent etch hides the evolution from shop", () => {
    const base = createDefaultClicker2State();
    const preCycle = {
      ...base,
      fossilized_strata: 0,
      owned_specialties: {
        [STRATIFIED_POND_SPECIALTY_ID]: true,
        [PETROGLYPH_I_SPECIALTY_ID]: true,
        4: true,
      },
      petroglyph_slots: [createBlankPetroglyphSlot(PETROGLYPH_I_SPECIALTY_ID)],
      statistics: {
        ...base.statistics,
        all_time_energy_earned: oneT,
      },
    };

    const interstitial = applyPondCycle(preCycle, 1_000_000);
    expect(interstitial.petroglyph_etch_pool).toEqual([4]);
    expect(
      petroglyphSlotCanEtch(
        interstitial.owned_specialties,
        interstitial.petroglyph_slots,
        0,
        interstitial.petroglyph_etch_pool,
      ),
    ).toBe(true);

    const etchedSlots = interstitial.petroglyph_slots.map((slot, index) =>
      index === 0
        ? { ...slot, etched_specialty_id: 4, etched_at_ms: 1_000_001 }
        : slot,
    );
    const afterEtch = syncOwnedFromPetroglyphEtch(
      interstitial.owned_specialties,
      interstitial.specialty_acquired_at_ms,
      etchedSlots,
    );

    expect(afterEtch.owned_specialties[4]).toBe(true);
    expect(
      isSpecialtyShopVisible(
        getSpecialtyDef(4)!,
        {},
        afterEtch.owned_specialties,
        oneT,
        0,
        0,
      ),
    ).toBe(false);
    expect(
      eligiblePetroglyphEvolutionDefs(
        afterEtch.owned_specialties,
        etchedSlots,
        0,
        interstitial.petroglyph_etch_pool,
      ),
    ).toEqual([]);
  });
});

describe("applyPetroglyphsOnCycleStart", () => {
  it("merges etched ids without overwriting fossil shop ownership", () => {
    const grant = applyPetroglyphsOnCycleStart(
      { [STRATIFIED_POND_SPECIALTY_ID]: true },
      {},
      [
        {
          petroglyph_specialty_id: PETROGLYPH_I_SPECIALTY_ID,
          etched_specialty_id: 4,
          etched_at_ms: 123,
        },
      ],
    );
    expect(grant.owned_specialties[STRATIFIED_POND_SPECIALTY_ID]).toBe(true);
    expect(grant.owned_specialties[4]).toBe(true);
    expect(grant.specialty_acquired_at_ms[4]).toBe(123);
  });
});

describe("Petroglyph I catalog", () => {
  it("requires Ripples of Eternity and costs 100 fossils", () => {
    const def = getSpecialtyDef(PETROGLYPH_I_SPECIALTY_ID)!;
    expect(def.name).toBe("Petroglyph I");
    expect(def.priceFossils).toBe(100);
    expect(def.requiresOwnedSpecialtyId).toBe(RIPPLES_OF_ETERNITY_SPECIALTY_ID);
    expect(def.effect.type).toBe("petroglyph_slot");
    expect(def.pollinatorEmoji).toBe("🪨");
  });
});
