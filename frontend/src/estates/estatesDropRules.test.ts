import { describe, expect, it } from "vitest";

import {
  getZoneDropBlockReason,
  isSuitAllowedInZone,
  isZoneDropAllowed,
  normalizeSuitValue,
  resolveCardSuit,
} from "./estatesDropRules";

describe("estatesDropRules", () => {
  it("normalizes orange alias to royal", () => {
    expect(normalizeSuitValue("orange")).toBe("royal");
    expect(resolveCardSuit({ suit: "orange", color: "orange" })).toBe("royal");
  });

  it("allows royal and orange-alias cards in tower", () => {
    const royalCard = { suit: "royal", color: "orange", rank: 3 };
    const orangeSuitCard = { suit: "orange", color: "orange", rank: 3 };
    expect(isSuitAllowedInZone("tower", "royal")).toBe(true);
    expect(isSuitAllowedInZone("tower", "orange")).toBe(true);
    expect(
      isZoneDropAllowed({
        zone: "tower",
        card: royalCard,
        placementsByZone: {},
        mySeat: 1,
        isMyTurn: true,
      }),
    ).toBe(true);
    expect(
      isZoneDropAllowed({
        zone: "tower",
        card: orangeSuitCard,
        placementsByZone: {},
        mySeat: 1,
        isMyTurn: true,
      }),
    ).toBe(true);
  });

  it("rejects peasant in tower", () => {
    expect(
      isZoneDropAllowed({
        zone: "tower",
        card: { suit: "peasant", color: "green", rank: 2 },
        placementsByZone: {},
        mySeat: 1,
        isMyTurn: true,
      }),
    ).toBe(false);
  });

  it("blocks drop when already confirmed in zone", () => {
    const placements = {
      tower: {
        "1": {
          card: { suit: "noble", color: "blue", rank: 4 },
          confirmed: true,
        },
      },
    };
    expect(
      isZoneDropAllowed({
        zone: "tower",
        card: { suit: "royal", color: "orange", rank: 3 },
        placementsByZone: placements,
        mySeat: 1,
        isMyTurn: true,
      }),
    ).toBe(false);
    expect(
      getZoneDropBlockReason({
        zone: "tower",
        card: { suit: "royal", color: "orange", rank: 3 },
        placementsByZone: placements,
        mySeat: 1,
        isMyTurn: true,
      }),
    ).toBe("already_placed");
  });
});
