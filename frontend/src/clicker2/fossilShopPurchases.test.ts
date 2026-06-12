import { describe, expect, it } from "vitest";

import { createDefaultClicker2State } from "./api";
import {
  BINOCULARS_SPECIALTY_ID,
  compareFossilShopByFossilPrice,
  EL_NINO_SPECIALTY_ID,
  FAE_PORTAL_SPECIALTY_ID,
  FOSSIL_RECORD_SPECIALTY_ID,
  FOSSIL_SHOP_SPECIALTY_IDS,
  GATHERING_CLOUDS_SPECIALTY_ID,
  GLASSES_SPECIALTY_ID,
  GNOMES_SPECIALTY_ID,
  GREMLINS_SPECIALTY_ID,
  IMPS_SPECIALTY_ID,
  MICROSCOPE_SPECIALTY_ID,
  PETROGLYPH_I_SPECIALTY_ID,
  PIXIES_SPECIALTY_ID,
  RIPPLES_OF_ETERNITY_SPECIALTY_ID,
  STRATIFIED_POND_SPECIALTY_ID,
  TELESCOPE_SPECIALTY_ID,
  WOODED_SHORE_SPECIALTY_ID,
  cycleStartOwnedDenizens,
  hasAffordableFossilShopPurchase,
  isFossilShopItemForSale,
  mergeCycleStartOwnedDenizens,
  weatherSpawnDelayScale,
} from "./fossilShop";
import { evolutionDisplayEmoji } from "./clicker2OwnedEvolutions";
import { applyPondCycle } from "./pondCycle";
import { getSpecialtyDef } from "./specialties";
import { isSpecialtyShopVisible, isSpecialtyUnlocked } from "./visibility";
import {
  scaleWeatherSpawnDelayMs,
  WEATHER_SPAWN_MAX_MS,
  WEATHER_SPAWN_MIN_MS,
} from "./weatherEvents";

const withPond = { [STRATIFIED_POND_SPECIALTY_ID]: true };
const withFossilRecord = {
  ...withPond,
  [FOSSIL_RECORD_SPECIALTY_ID]: true,
};
const withGatheringClouds = {
  ...withPond,
  [GATHERING_CLOUDS_SPECIALTY_ID]: true,
};
const withRipplesOfEternity = {
  ...withFossilRecord,
  [RIPPLES_OF_ETERNITY_SPECIALTY_ID]: true,
};
const withFaePortal = {
  ...withPond,
  [FAE_PORTAL_SPECIALTY_ID]: true,
};
const withPixies = {
  ...withFaePortal,
  [PIXIES_SPECIALTY_ID]: true,
};
const withImps = {
  ...withFaePortal,
  [IMPS_SPECIALTY_ID]: true,
};

describe("fossil shop card emojis", () => {
  it.each([
    [WOODED_SHORE_SPECIALTY_ID, "🌲"],
    [GATHERING_CLOUDS_SPECIALTY_ID, "☁️"],
    [RIPPLES_OF_ETERNITY_SPECIALTY_ID, "💦"],
    [EL_NINO_SPECIALTY_ID, "⛈️"],
    [FAE_PORTAL_SPECIALTY_ID, "🌀"],
    [PIXIES_SPECIALTY_ID, "🧚"],
    [IMPS_SPECIALTY_ID, "👿"],
    [GNOMES_SPECIALTY_ID, "🍄‍🟫"],
    [GREMLINS_SPECIALTY_ID, "👺"],
    [MICROSCOPE_SPECIALTY_ID, "🔬"],
    [GLASSES_SPECIALTY_ID, "👓"],
    [BINOCULARS_SPECIALTY_ID, "🥽"],
    [TELESCOPE_SPECIALTY_ID, "🔭"],
  ] as const)("uses %s for specialty %i", (id, emoji) => {
    expect(evolutionDisplayEmoji(getSpecialtyDef(id)!)).toBe(emoji);
  });
});

describe("compareFossilShopByFossilPrice", () => {
  it("orders stratified-pond unlocks cheapest to most expensive", () => {
    const forSale = FOSSIL_SHOP_SPECIALTY_IDS.map((id) => getSpecialtyDef(id)!)
      .filter((def) => isFossilShopItemForSale(def, withPond))
      .sort(compareFossilShopByFossilPrice);

    expect(forSale.map((d) => d.id)).toEqual([
      FAE_PORTAL_SPECIALTY_ID,
      FOSSIL_RECORD_SPECIALTY_ID,
      MICROSCOPE_SPECIALTY_ID,
      WOODED_SHORE_SPECIALTY_ID,
      GATHERING_CLOUDS_SPECIALTY_ID,
    ]);
  });

  it("orders fae-chain upgrades by fossil price when prerequisites are met", () => {
    const owned = {
      ...withFossilRecord,
      [FAE_PORTAL_SPECIALTY_ID]: true,
      [PIXIES_SPECIALTY_ID]: true,
      [IMPS_SPECIALTY_ID]: true,
    };
    const forSale = FOSSIL_SHOP_SPECIALTY_IDS.map((id) => getSpecialtyDef(id)!)
      .filter((def) => isFossilShopItemForSale(def, owned))
      .sort(compareFossilShopByFossilPrice);

    expect(forSale.map((d) => d.id)).toEqual([
      MICROSCOPE_SPECIALTY_ID,
      WOODED_SHORE_SPECIALTY_ID,
      GATHERING_CLOUDS_SPECIALTY_ID,
      RIPPLES_OF_ETERNITY_SPECIALTY_ID,
      GNOMES_SPECIALTY_ID,
      GREMLINS_SPECIALTY_ID,
    ]);
  });

  it("includes El Niño when Gathering Clouds is owned", () => {
    const owned = {
      ...withGatheringClouds,
      [FAE_PORTAL_SPECIALTY_ID]: true,
    };
    const forSale = FOSSIL_SHOP_SPECIALTY_IDS.map((id) => getSpecialtyDef(id)!)
      .filter((def) => isFossilShopItemForSale(def, owned))
      .sort(compareFossilShopByFossilPrice);

    expect(forSale.map((d) => d.id)).toContain(EL_NINO_SPECIALTY_ID);
  });

  it("includes Petroglyph I when Ripples of Eternity is owned", () => {
    const owned = {
      ...withRipplesOfEternity,
      [FAE_PORTAL_SPECIALTY_ID]: true,
    };
    const forSale = FOSSIL_SHOP_SPECIALTY_IDS.map((id) => getSpecialtyDef(id)!)
      .filter((def) => isFossilShopItemForSale(def, owned))
      .sort(compareFossilShopByFossilPrice);

    expect(forSale.map((d) => d.id)).toContain(PETROGLYPH_I_SPECIALTY_ID);
  });
});

describe("hasAffordableFossilShopPurchase", () => {
  it("is false with no fossils", () => {
    expect(hasAffordableFossilShopPurchase(0, withPond)).toBe(false);
  });

  it("is true when a for-sale item is within budget", () => {
    expect(hasAffordableFossilShopPurchase(1, withPond)).toBe(true);
  });

  it("is false when fossils remain but every for-sale item is too expensive", () => {
    const owned = { ...withPond, [FAE_PORTAL_SPECIALTY_ID]: true };
    expect(hasAffordableFossilShopPurchase(2, owned)).toBe(false);
  });

  it("is false when nothing is left for sale", () => {
    const owned = Object.fromEntries(
      FOSSIL_SHOP_SPECIALTY_IDS.map((id) => [id, true]),
    );
    expect(hasAffordableFossilShopPurchase(100, owned)).toBe(false);
  });
});

describe("Ripples of Eternity", () => {
  const def = () => getSpecialtyDef(RIPPLES_OF_ETERNITY_SPECIALTY_ID)!;

  it("is a fossil-shop specialty in the persistent list", () => {
    expect(FOSSIL_SHOP_SPECIALTY_IDS).toContain(RIPPLES_OF_ETERNITY_SPECIALTY_ID);
    expect(def()).toMatchObject({
      name: "Ripples of Eternity",
      priceFossils: 50,
      fossilShopOnly: true,
      requiresOwnedSpecialtyId: FOSSIL_RECORD_SPECIALTY_ID,
      effect: { type: "cycle_start_denizen", denizenId: "ripples", count: 10 },
      effectText: "You start each pond cycle with 10 ripples.",
    });
  });

  it("requires fossil record and is hidden from the energy shop", () => {
    expect(isFossilShopItemForSale(def(), {})).toBe(false);
    expect(isFossilShopItemForSale(def(), withPond)).toBe(false);
    expect(isFossilShopItemForSale(def(), withFossilRecord)).toBe(true);
    expect(
      isSpecialtyShopVisible(def(), {}, withFossilRecord, 0, 0, 0),
    ).toBe(false);
    expect(isSpecialtyUnlocked(def(), {}, 0, 0, 0, withPond)).toBe(false);
    expect(isSpecialtyUnlocked(def(), {}, 0, 0, 0, withFossilRecord)).toBe(
      true,
    );
  });

  it("starts each pond cycle with 10 ripples", () => {
    expect(cycleStartOwnedDenizens({})).toEqual({});
    expect(
      cycleStartOwnedDenizens({
        [RIPPLES_OF_ETERNITY_SPECIALTY_ID]: true,
      }),
    ).toEqual({ ripples: 10 });

    const base = createDefaultClicker2State();
    const next = applyPondCycle(
      {
        ...base,
        owned_specialties: {
          [STRATIFIED_POND_SPECIALTY_ID]: true,
          [FOSSIL_RECORD_SPECIALTY_ID]: true,
          [RIPPLES_OF_ETERNITY_SPECIALTY_ID]: true,
        },
        owned_denizens: { sediment: 5 },
      },
      1_000_000,
    );
    expect(next.owned_denizens).toEqual({ ripples: 10 });
    expect(next.owned_specialties[RIPPLES_OF_ETERNITY_SPECIALTY_ID]).toBe(
      true,
    );
  });

  it("grants ripples when bought after the pond reset during the fossil shop", () => {
    const base = createDefaultClicker2State();
    const cycled = applyPondCycle(
      {
        ...base,
        owned_specialties: {
          [STRATIFIED_POND_SPECIALTY_ID]: true,
          [FOSSIL_RECORD_SPECIALTY_ID]: true,
        },
        owned_denizens: { sediment: 5 },
      },
      1_000_000,
    );
    expect(cycled.owned_denizens).toEqual({});

    const afterPurchase = {
      ...cycled,
      owned_specialties: {
        ...cycled.owned_specialties,
        [RIPPLES_OF_ETERNITY_SPECIALTY_ID]: true,
      },
    };
    expect(mergeCycleStartOwnedDenizens(afterPurchase.owned_denizens, afterPurchase.owned_specialties)).toEqual({
      ripples: 10,
    });
  });
});

describe("Fae Portal", () => {
  const def = () => getSpecialtyDef(FAE_PORTAL_SPECIALTY_ID)!;

  it("is a fossil-shop specialty in the persistent list", () => {
    expect(FOSSIL_SHOP_SPECIALTY_IDS).toContain(FAE_PORTAL_SPECIALTY_ID);
    expect(def()).toMatchObject({
      name: "Fae Portal",
      priceFossils: 1,
      fossilShopOnly: true,
      requiresOwnedSpecialtyId: STRATIFIED_POND_SPECIALTY_ID,
      effect: { type: "offline_eps_bonus", epsPercent: 5, maxMinutes: 60 },
      effectText:
        "Your pond earns 5% of your energy per second for the first hour you're offline, then 0.5% thereafter.",
      ecologyNote:
        "Welcome the fae folk to your pond to work while you're away.",
    });
  });

  it("requires stratified pond and is hidden from the energy shop", () => {
    expect(isFossilShopItemForSale(def(), {})).toBe(false);
    expect(isFossilShopItemForSale(def(), withPond)).toBe(true);
    expect(
      isSpecialtyShopVisible(def(), {}, withPond, 0, 0, 0),
    ).toBe(false);
  });
});

describe("Pixies", () => {
  const def = () => getSpecialtyDef(PIXIES_SPECIALTY_ID)!;

  it("is a fossil-shop specialty requiring Fae Portal", () => {
    expect(FOSSIL_SHOP_SPECIALTY_IDS).toContain(PIXIES_SPECIALTY_ID);
    expect(def()).toMatchObject({
      name: "Pixies",
      priceFossils: 5,
      requiresOwnedSpecialtyId: FAE_PORTAL_SPECIALTY_ID,
      effect: { type: "offline_eps_bonus_percent_add", addPercent: 10 },
    });
  });

  it("is not for sale without Fae Portal", () => {
    expect(isFossilShopItemForSale(def(), withPond)).toBe(false);
    expect(isFossilShopItemForSale(def(), withFaePortal)).toBe(true);
    expect(
      isSpecialtyShopVisible(def(), {}, withFaePortal, 0, 0, 0),
    ).toBe(false);
  });
});

describe("Imps", () => {
  const def = () => getSpecialtyDef(IMPS_SPECIALTY_ID)!;

  it("is a fossil-shop specialty requiring Fae Portal", () => {
    expect(FOSSIL_SHOP_SPECIALTY_IDS).toContain(IMPS_SPECIALTY_ID);
    expect(def()).toMatchObject({
      name: "Imps",
      priceFossils: 5,
      requiresOwnedSpecialtyId: FAE_PORTAL_SPECIALTY_ID,
      effect: { type: "offline_eps_bonus_max_minutes", maxMinutes: 120 },
    });
  });

  it("is not for sale without Fae Portal", () => {
    expect(isFossilShopItemForSale(def(), withPond)).toBe(false);
    expect(isFossilShopItemForSale(def(), withFaePortal)).toBe(true);
  });
});

describe("Gnomes", () => {
  const def = () => getSpecialtyDef(GNOMES_SPECIALTY_ID)!;

  it("is a fossil-shop specialty requiring Pixies", () => {
    expect(FOSSIL_SHOP_SPECIALTY_IDS).toContain(GNOMES_SPECIALTY_ID);
    expect(def()).toMatchObject({
      name: "Gnomes",
      priceFossils: 50,
      requiresOwnedSpecialtyId: PIXIES_SPECIALTY_ID,
      effect: { type: "offline_eps_bonus_percent_add", addPercent: 10 },
    });
  });

  it("is not for sale without Pixies", () => {
    expect(isFossilShopItemForSale(def(), withFaePortal)).toBe(false);
    expect(isFossilShopItemForSale(def(), withPixies)).toBe(true);
  });
});

describe("Gremlins", () => {
  const def = () => getSpecialtyDef(GREMLINS_SPECIALTY_ID)!;

  it("is a fossil-shop specialty requiring Imps", () => {
    expect(FOSSIL_SHOP_SPECIALTY_IDS).toContain(GREMLINS_SPECIALTY_ID);
    expect(def()).toMatchObject({
      name: "Gremlins",
      priceFossils: 50,
      requiresOwnedSpecialtyId: IMPS_SPECIALTY_ID,
      effect: { type: "offline_eps_bonus_max_minutes", maxMinutes: 240 },
    });
  });

  it("is not for sale without Imps", () => {
    expect(isFossilShopItemForSale(def(), withFaePortal)).toBe(false);
    expect(isFossilShopItemForSale(def(), withImps)).toBe(true);
  });
});

describe("El Niño", () => {
  const def = () => getSpecialtyDef(EL_NINO_SPECIALTY_ID)!;

  it("is a fossil-shop specialty in the persistent list", () => {
    expect(FOSSIL_SHOP_SPECIALTY_IDS).toContain(EL_NINO_SPECIALTY_ID);
    expect(def()).toMatchObject({
      name: "El Niño",
      priceFossils: 75,
      fossilShopOnly: true,
      requiresOwnedSpecialtyId: GATHERING_CLOUDS_SPECIALTY_ID,
      effect: { type: "weather_spawn_frequency_bonus", percent: 5 },
      effectText: "Weather events are 5% more frequent.",
    });
  });

  it("requires Gathering Clouds and is hidden from the energy shop", () => {
    expect(isFossilShopItemForSale(def(), {})).toBe(false);
    expect(isFossilShopItemForSale(def(), withPond)).toBe(false);
    expect(isFossilShopItemForSale(def(), withGatheringClouds)).toBe(true);
    expect(
      isSpecialtyShopVisible(def(), {}, withGatheringClouds, 0, 0, 0),
    ).toBe(false);
  });

  it("shortens weather spawn delay by 5%", () => {
    expect(weatherSpawnDelayScale({})).toBe(1);
    expect(
      weatherSpawnDelayScale({ [EL_NINO_SPECIALTY_ID]: true }),
    ).toBeCloseTo(0.95, 10);

    const base = WEATHER_SPAWN_MAX_MS;
    expect(scaleWeatherSpawnDelayMs(base, {})).toBe(base);
    expect(
      scaleWeatherSpawnDelayMs(base, { [EL_NINO_SPECIALTY_ID]: true }),
    ).toBe(Math.floor(base * 0.95));
    expect(
      scaleWeatherSpawnDelayMs(WEATHER_SPAWN_MIN_MS, {
        [EL_NINO_SPECIALTY_ID]: true,
      }),
    ).toBeGreaterThanOrEqual(1);
  });

  it("survives pond cycle", () => {
    const base = createDefaultClicker2State();
    const next = applyPondCycle(
      {
        ...base,
        owned_specialties: {
          [STRATIFIED_POND_SPECIALTY_ID]: true,
          [EL_NINO_SPECIALTY_ID]: true,
          680: true,
        },
      },
      2_000_000,
    );
    expect(next.owned_specialties[EL_NINO_SPECIALTY_ID]).toBe(true);
    expect(next.owned_specialties[680]).toBeUndefined();
  });
});

describe("Petroglyph I", () => {
  const def = () => getSpecialtyDef(PETROGLYPH_I_SPECIALTY_ID)!;

  it("is a fossil-shop specialty in the persistent list", () => {
    expect(FOSSIL_SHOP_SPECIALTY_IDS).toContain(PETROGLYPH_I_SPECIALTY_ID);
    expect(def()).toMatchObject({
      name: "Petroglyph I",
      priceFossils: 100,
      fossilShopOnly: true,
      requiresOwnedSpecialtyId: RIPPLES_OF_ETERNITY_SPECIALTY_ID,
      effect: { type: "petroglyph_slot" },
    });
  });

  it("requires Ripples of Eternity and is hidden from the energy shop", () => {
    expect(isFossilShopItemForSale(def(), withFossilRecord)).toBe(false);
    expect(isFossilShopItemForSale(def(), withRipplesOfEternity)).toBe(true);
    expect(
      isSpecialtyShopVisible(def(), {}, withRipplesOfEternity, 0, 0, 0),
    ).toBe(false);
  });
});

describe("optics fossil shop chain", () => {
  const withMicroscope = {
    ...withPond,
    [MICROSCOPE_SPECIALTY_ID]: true,
  };
  const withGlasses = {
    ...withMicroscope,
    [GLASSES_SPECIALTY_ID]: true,
  };

  it.each([
    [MICROSCOPE_SPECIALTY_ID, "Microscope", 10, STRATIFIED_POND_SPECIALTY_ID, "zooplankton"],
    [GLASSES_SPECIALTY_ID, "Glasses", 25, MICROSCOPE_SPECIALTY_ID, "large_fish"],
    [BINOCULARS_SPECIALTY_ID, "Binoculars", 50, GLASSES_SPECIALTY_ID, "humans"],
    [TELESCOPE_SPECIALTY_ID, "Telescope", 100, BINOCULARS_SPECIALTY_ID, "celestials"],
  ] as const)(
    "defines %s with fossil cost and tooltip effect",
    (id, name, priceFossils, requiresId, throughDenizenId) => {
      expect(FOSSIL_SHOP_SPECIALTY_IDS).toContain(id);
      expect(getSpecialtyDef(id)).toMatchObject({
        name,
        priceFossils,
        fossilShopOnly: true,
        requiresOwnedSpecialtyId: requiresId,
        effect: { type: "denizen_yield_cost_tooltip", throughDenizenId },
      });
    },
  );

  it("requires the previous optics tier before sale", () => {
    expect(
      isFossilShopItemForSale(getSpecialtyDef(GLASSES_SPECIALTY_ID)!, withPond),
    ).toBe(false);
    expect(
      isFossilShopItemForSale(getSpecialtyDef(GLASSES_SPECIALTY_ID)!, withMicroscope),
    ).toBe(true);
    expect(
      isFossilShopItemForSale(getSpecialtyDef(BINOCULARS_SPECIALTY_ID)!, withGlasses),
    ).toBe(true);
  });

  it("survives pond cycle", () => {
    const base = createDefaultClicker2State();
    const next = applyPondCycle(
      {
        ...base,
        owned_specialties: {
          [STRATIFIED_POND_SPECIALTY_ID]: true,
          [MICROSCOPE_SPECIALTY_ID]: true,
          [TELESCOPE_SPECIALTY_ID]: true,
          680: true,
        },
      },
      2_000_000,
    );
    expect(next.owned_specialties[MICROSCOPE_SPECIALTY_ID]).toBe(true);
    expect(next.owned_specialties[TELESCOPE_SPECIALTY_ID]).toBe(true);
    expect(next.owned_specialties[680]).toBeUndefined();
  });
});
