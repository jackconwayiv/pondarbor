import { describe, expect, it } from "vitest";

import { STRATIFIED_POND_SPECIALTY_ID } from "./fossilShop";
import { getSpecialtyDef } from "./specialties";
import { isSpecialtyShopVisible } from "./visibility";

describe("fossil shop visibility", () => {
  it("hides fossil-shop-only items from energy shop", () => {
    const def = getSpecialtyDef(STRATIFIED_POND_SPECIALTY_ID);
    expect(def).toBeDefined();
    expect(
      isSpecialtyShopVisible(def!, {}, {}, 1e15, 0, 0),
    ).toBe(false);
  });

  it("shows embedded fossils when stratified pond is owned", () => {
    const embedded = getSpecialtyDef(680);
    expect(embedded).toBeDefined();
    expect(
      isSpecialtyShopVisible(embedded!, {}, {}, 0, 0, 0),
    ).toBe(false);
    expect(
      isSpecialtyShopVisible(
        embedded!,
        {},
        { [STRATIFIED_POND_SPECIALTY_ID]: true },
        0,
        0,
        0,
      ),
    ).toBe(true);
  });

});
