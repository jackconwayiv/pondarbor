import { describe, expect, it } from "vitest";

import { createDefaultClicker2State } from "./api";
import {
  compareFossilShopByFossilPrice,
  EL_NINO_SPECIALTY_ID,
  FAE_PORTAL_SPECIALTY_ID,
  FOSSIL_RECORD_SPECIALTY_ID,
  FOSSIL_SHOP_SPECIALTY_IDS,
  GATHERING_CLOUDS_SPECIALTY_ID,
  RIPPLES_OF_ETERNITY_SPECIALTY_ID,
  STRATIFIED_POND_SPECIALTY_ID,
  WOODED_SHORE_SPECIALTY_ID,
  cycleStartOwnedDenizens,
  isFossilShopItemForSale,
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

describe("fossil shop card emojis", () => {
  it.each([
    [WOODED_SHORE_SPECIALTY_ID, "🌲"],
    [GATHERING_CLOUDS_SPECIALTY_ID, "☁️"],
    [RIPPLES_OF_ETERNITY_SPECIALTY_ID, "💦"],
    [EL_NINO_SPECIALTY_ID, "⛈️"],
    [FAE_PORTAL_SPECIALTY_ID, "🍥"],
  ] as const)("uses %s for specialty %i", (id, emoji) => {
    expect(evolutionDisplayEmoji(getSpecialtyDef(id)!)).toBe(emoji);
  });
});

describe("compareFossilShopByFossilPrice", () => {
  it("orders for-sale fossil shop items cheapest to most expensive", () => {
    const forSale = FOSSIL_SHOP_SPECIALTY_IDS.map((id) => getSpecialtyDef(id)!)
      .filter((def) => isFossilShopItemForSale(def, withPond))
      .sort(compareFossilShopByFossilPrice);

    expect(forSale.map((d) => d.id)).toEqual([
      FOSSIL_RECORD_SPECIALTY_ID,
      FAE_PORTAL_SPECIALTY_ID,
      WOODED_SHORE_SPECIALTY_ID,
      GATHERING_CLOUDS_SPECIALTY_ID,
      RIPPLES_OF_ETERNITY_SPECIALTY_ID,
      EL_NINO_SPECIALTY_ID,
    ]);
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
      requiresOwnedSpecialtyId: STRATIFIED_POND_SPECIALTY_ID,
      effect: { type: "cycle_start_denizen", denizenId: "ripples", count: 10 },
      effectText: "You start each pond cycle with 10 ripples.",
    });
  });

  it("requires stratified pond and is hidden from the energy shop", () => {
    expect(isFossilShopItemForSale(def(), {})).toBe(false);
    expect(isFossilShopItemForSale(def(), withPond)).toBe(true);
    expect(
      isSpecialtyShopVisible(def(), {}, withPond, 0, 0, 0),
    ).toBe(false);
    expect(isSpecialtyUnlocked(def(), {}, 0, 0, 0, withPond)).toBe(true);
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
});

describe("Fae Portal", () => {
  const def = () => getSpecialtyDef(FAE_PORTAL_SPECIALTY_ID)!;

  it("is a fossil-shop specialty in the persistent list", () => {
    expect(FOSSIL_SHOP_SPECIALTY_IDS).toContain(FAE_PORTAL_SPECIALTY_ID);
    expect(def()).toMatchObject({
      name: "Fae Portal",
      priceFossils: 7,
      fossilShopOnly: true,
      requiresOwnedSpecialtyId: STRATIFIED_POND_SPECIALTY_ID,
      effect: { type: "offline_eps_bonus", epsPercent: 5, maxMinutes: 60 },
      effectText:
        "Your pond earns 5% of your energy per second for the first hour you're offline.",
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

describe("El Niño", () => {
  const def = () => getSpecialtyDef(EL_NINO_SPECIALTY_ID)!;

  it("is a fossil-shop specialty in the persistent list", () => {
    expect(FOSSIL_SHOP_SPECIALTY_IDS).toContain(EL_NINO_SPECIALTY_ID);
    expect(def()).toMatchObject({
      name: "El Niño",
      priceFossils: 75,
      fossilShopOnly: true,
      requiresOwnedSpecialtyId: STRATIFIED_POND_SPECIALTY_ID,
      effect: { type: "weather_spawn_frequency_bonus", percent: 5 },
      effectText: "Weather events are 5% more frequent.",
    });
  });

  it("requires stratified pond and is hidden from the energy shop", () => {
    expect(isFossilShopItemForSale(def(), {})).toBe(false);
    expect(isFossilShopItemForSale(def(), withPond)).toBe(true);
    expect(
      isSpecialtyShopVisible(def(), {}, withPond, 0, 0, 0),
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
