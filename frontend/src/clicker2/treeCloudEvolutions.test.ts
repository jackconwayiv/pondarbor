import { describe, expect, it } from "vitest";

import {
  GATHERING_CLOUDS_SPECIALTY_ID,
  STRATIFIED_POND_SPECIALTY_ID,
  WOODED_SHORE_SPECIALTY_ID,
  isFossilShopItemForSale,
} from "./fossilShop";
import { getSpecialtyDef } from "./specialties";
import {
  CLOUD_SPECIALTY_IDS,
  TREE_SPECIALTY_IDS,
} from "./treeCloudEvolutions";
import { isSpecialtyShopVisible, isSpecialtyUnlocked } from "./visibility";

const withStratifiedPond = { [STRATIFIED_POND_SPECIALTY_ID]: true };

describe("tree and cloud fossil gates", () => {
  it("defines Wooded Shore and Gathering Clouds as stratified-gated fossil shop items", () => {
    expect(getSpecialtyDef(WOODED_SHORE_SPECIALTY_ID)).toMatchObject({
      name: "Wooded Shore",
      fossilShopOnly: true,
      priceFossils: 25,
      requiresOwnedSpecialtyId: STRATIFIED_POND_SPECIALTY_ID,
      effect: { type: "production_percent", percent: 0 },
    });
    expect(getSpecialtyDef(GATHERING_CLOUDS_SPECIALTY_ID)).toMatchObject({
      name: "Gathering Clouds",
      fossilShopOnly: true,
      priceFossils: 25,
      requiresOwnedSpecialtyId: STRATIFIED_POND_SPECIALTY_ID,
    });
  });

  it("does not offer gates without Stratified Pond", () => {
    expect(isFossilShopItemForSale(getSpecialtyDef(WOODED_SHORE_SPECIALTY_ID)!, {})).toBe(
      false,
    );
    expect(
      isFossilShopItemForSale(
        getSpecialtyDef(WOODED_SHORE_SPECIALTY_ID)!,
        withStratifiedPond,
      ),
    ).toBe(true);
  });
});

describe("tree production chain", () => {
  it("has fifteen tiers with sequential prerequisites from Wooded Shore", () => {
    expect(TREE_SPECIALTY_IDS).toHaveLength(15);
    expect(TREE_SPECIALTY_IDS[0]).toBe(690);
    expect(getSpecialtyDef(690)?.name).toBe("Pussy Willow");
    expect(getSpecialtyDef(690)?.requiresOwnedSpecialtyId).toBe(
      WOODED_SHORE_SPECIALTY_ID,
    );
    expect(getSpecialtyDef(691)?.requiresOwnedSpecialtyId).toBe(690);
    expect(getSpecialtyDef(704)?.name).toBe("Western Redcedar");
    expect(getSpecialtyDef(704)?.effect).toEqual({
      type: "production_percent",
      percent: 5,
    });
  });

  it("hides first tree tier until Wooded Shore is owned", () => {
    const tier0 = getSpecialtyDef(690)!;
    expect(
      isSpecialtyShopVisible(tier0, {}, withStratifiedPond, 1e30, 0, 0),
    ).toBe(false);
    expect(
      isSpecialtyShopVisible(
        tier0,
        {},
        { ...withStratifiedPond, [WOODED_SHORE_SPECIALTY_ID]: true },
        1e30,
        0,
        0,
      ),
    ).toBe(true);
  });
});

describe("cloud production chain", () => {
  it("has fifteen tiers with sequential prerequisites from Gathering Clouds", () => {
    expect(CLOUD_SPECIALTY_IDS).toHaveLength(15);
    expect(CLOUD_SPECIALTY_IDS[0]).toBe(705);
    expect(getSpecialtyDef(705)?.name).toBe("Cumulus Cloud");
    expect(getSpecialtyDef(705)?.requiresOwnedSpecialtyId).toBe(
      GATHERING_CLOUDS_SPECIALTY_ID,
    );
    expect(getSpecialtyDef(719)?.name).toBe("Cumulonimbus Cloud");
  });

  it("hides first cloud tier until Gathering Clouds is owned", () => {
    const tier0 = getSpecialtyDef(705)!;
    expect(
      isSpecialtyShopVisible(tier0, {}, withStratifiedPond, 1e30, 0, 0),
    ).toBe(false);
    expect(
      isSpecialtyShopVisible(
        tier0,
        {},
        { ...withStratifiedPond, [GATHERING_CLOUDS_SPECIALTY_ID]: true },
        1e30,
        0,
        0,
      ),
    ).toBe(true);
  });
});

describe("tree and cloud tier unlock without denizen ownership", () => {
  it("unlocks tier 0 when fossil gate is owned", () => {
    expect(
      isSpecialtyUnlocked(
        getSpecialtyDef(690)!,
        {},
        0,
        0,
        0,
        { [WOODED_SHORE_SPECIALTY_ID]: true },
      ),
    ).toBe(true);
    expect(
      isSpecialtyUnlocked(
        getSpecialtyDef(705)!,
        {},
        0,
        0,
        0,
        { [GATHERING_CLOUDS_SPECIALTY_ID]: true },
      ),
    ).toBe(true);
  });
});
