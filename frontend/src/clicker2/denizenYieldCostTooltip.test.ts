import { describe, expect, it } from "vitest";

import {
  BINOCULARS_SPECIALTY_ID,
  GLASSES_SPECIALTY_ID,
  MICROSCOPE_SPECIALTY_ID,
  STRATIFIED_POND_SPECIALTY_ID,
  TELESCOPE_SPECIALTY_ID,
} from "./fossilShop";
import {
  denizenCostPerEps,
  denizenInYieldCostTooltipRange,
  denizenYieldCostTooltipForOwned,
  denizenYieldCostTooltipThroughIndex,
} from "./denizenYieldCostTooltip";
import { getDenizenIndex } from "./denizens";

describe("denizenYieldCostTooltipThroughIndex", () => {
  it("returns null with no optics owned", () => {
    expect(denizenYieldCostTooltipThroughIndex({})).toBeNull();
  });

  it("uses the highest owned optics tier", () => {
    expect(
      denizenYieldCostTooltipThroughIndex({
        [MICROSCOPE_SPECIALTY_ID]: true,
        [TELESCOPE_SPECIALTY_ID]: true,
      }),
    ).toBe(getDenizenIndex("celestials"));
  });

  it("maps each tier to the correct denizen boundary", () => {
    expect(
      denizenYieldCostTooltipThroughIndex({
        [STRATIFIED_POND_SPECIALTY_ID]: true,
        [MICROSCOPE_SPECIALTY_ID]: true,
      }),
    ).toBe(getDenizenIndex("zooplankton"));
    expect(
      denizenYieldCostTooltipThroughIndex({
        [GLASSES_SPECIALTY_ID]: true,
      }),
    ).toBe(getDenizenIndex("large_fish"));
    expect(
      denizenYieldCostTooltipThroughIndex({
        [BINOCULARS_SPECIALTY_ID]: true,
      }),
    ).toBe(getDenizenIndex("humans"));
  });
});

describe("denizenInYieldCostTooltipRange", () => {
  const throughZooplankton = getDenizenIndex("zooplankton");

  it("includes denizens at or below the boundary", () => {
    expect(denizenInYieldCostTooltipRange("ripples", throughZooplankton)).toBe(
      true,
    );
    expect(
      denizenInYieldCostTooltipRange("zooplankton", throughZooplankton),
    ).toBe(true);
  });

  it("excludes denizens above the boundary and transcendence", () => {
    expect(
      denizenInYieldCostTooltipRange("aquatic_plants", throughZooplankton),
    ).toBe(false);
    expect(
      denizenInYieldCostTooltipRange("transcendence", throughZooplankton),
    ).toBe(false);
  });
});

describe("denizenCostPerEps", () => {
  it("rounds next-purchase cost divided by per-copy EpS", () => {
    expect(denizenCostPerEps(150, 0.1)).toBe(1500);
    expect(denizenCostPerEps(100, 8)).toBe(13);
  });

  it("returns null when cost or EpS is unavailable", () => {
    expect(denizenCostPerEps(null, 10)).toBeNull();
    expect(denizenCostPerEps(100, 0)).toBeNull();
  });
});

describe("denizenYieldCostTooltipForOwned", () => {
  it("returns null outside the owned optics range", () => {
    expect(
      denizenYieldCostTooltipForOwned(
        { [MICROSCOPE_SPECIALTY_ID]: true },
        "large_fish",
        1_000,
        100,
      ),
    ).toBeNull();
  });

  it("computes cost per EpS inside range", () => {
    expect(
      denizenYieldCostTooltipForOwned(
        { [MICROSCOPE_SPECIALTY_ID]: true },
        "fungi",
        1_000,
        8,
      ),
    ).toBe(125);
  });
});
