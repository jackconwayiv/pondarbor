import { describe, expect, it } from "vitest";

import {
  buildReferenceStateAtUnlock,
  denizenEvolutionPrice,
  denizenTier45Price,
  denizenTier4CatalogPrice,
  sedimentEvolutionPrice,
  generateSpecialtyPrices,
  pondProductionAnchoredPrice,
  rippleEvolutionPrice,
  RIPPLE_EARLY_PRICE_ANCHORS,
  validatePricingTable,
} from "./evolutionPricing";
import {
  DENIZEN_TIER45_SPECIALTY_IDS,
  DENIZEN_TIER45_UNLOCK_OWNED,
} from "./tier45Evolutions";
import { DENIZEN_EVOLUTION_TIER_MULT } from "./evolutionTierMults";
import { getDenizenDef } from "./denizens";
import { evolutionChainDenizenIds } from "./milestones";
import { PAIRING_SPECIALTY_DENIZEN_ID } from "./pairingEvolutions";
import {
  CLOUD_SPECIALTY_DENIZEN_ID,
  TREE_SPECIALTY_DENIZEN_ID,
} from "./treeCloudEvolutions";
import {
  POND_SPECIALTY_DENIZEN_ID,
  SEDIMENT_CRACIAL_GLAPE_SPECIALTY_ID,
  specialtiesForDenizen,
  specialtyTierIndex,
  SPECIALTIES,
} from "./specialties";

describe("buildReferenceStateAtUnlock", () => {
  it("owns prior tiers in the same denizen chain", () => {
    const chain = specialtiesForDenizen("sediment");
    const tier3 = chain[3]!;
    const ref = buildReferenceStateAtUnlock(tier3);
    expect(ref.ownedDenizens.sediment).toBe(tier3.unlockOwned);
    for (const s of chain) {
      if (specialtyTierIndex(s) < 3) {
        expect(ref.ownedSpecialties[s.id]).toBe(true);
      }
    }
  });

  it("populates non-ripple denizens for ripple chain pricing", () => {
    const rings = SPECIALTIES.find((s) => s.id === 4)!;
    const ref = buildReferenceStateAtUnlock(rings);
    expect(ref.ownedDenizens.ripples).toBeGreaterThan(0);
    expect(ref.ownedDenizens.sediment).toBeGreaterThan(0);
  });

  it("limits pond reference denizens by all-time unlock energy", () => {
    const pond0 = specialtiesForDenizen(POND_SPECIALTY_DENIZEN_ID)[0]!;
    const ref = buildReferenceStateAtUnlock(pond0);
    expect(ref.ownedDenizens.small_fish ?? 0).toBe(0);
    expect(ref.ownedDenizens.sediment).toBeGreaterThan(0);
    expect(ref.ownedDenizens.invertebrates ?? 0).toBe(0);
  });
});

describe("generateSpecialtyPrices", () => {
  const prices = generateSpecialtyPrices(SPECIALTIES);

  it("has a positive price for every specialty", () => {
    for (const s of SPECIALTIES) {
      expect(prices[s.id]).toBeGreaterThan(0);
    }
  });

  it("passes validation (monotone chains)", () => {
    const violations = validatePricingTable(SPECIALTIES, prices);
    expect(violations).toEqual([]);
  });

  it("keeps prices non-decreasing within each chain", () => {
    const chains = new Set(SPECIALTIES.map((s) => s.denizenId));
    for (const denizenId of chains) {
      if (denizenId === PAIRING_SPECIALTY_DENIZEN_ID) continue;
      const chain = specialtiesForDenizen(denizenId);
      let prev = 0;
      for (const s of chain) {
        const p = prices[s.id]!;
        expect(p).toBeGreaterThanOrEqual(prev);
        prev = p;
      }
    }
  });

  it("uses pond production price anchors for every tier", () => {
    const chain = specialtiesForDenizen(POND_SPECIALTY_DENIZEN_ID);
    for (let tier = 0; tier < chain.length; tier++) {
      const s = chain[tier]!;
      expect(prices[s.id]).toBe(pondProductionAnchoredPrice(tier));
    }
    expect(prices[chain[0]!.id]).toBe(1_000_000);
    expect(prices[chain[17]!.id]).toBe(500_000_000_000);
  });

  it("uses ripple early anchors for tiers 0–3 and geometric-mean tier 4.5", () => {
    const chain = specialtiesForDenizen("ripples");
    for (let tier = 0; tier < 4; tier++) {
      const s = chain[tier]!;
      expect(prices[s.id]).toBe(rippleEvolutionPrice(tier));
      expect(prices[s.id]).toBe(RIPPLE_EARLY_PRICE_ANCHORS[tier]);
    }
    const tier45 = chain[4]!;
    expect(tier45.id).toBe(DENIZEN_TIER45_SPECIALTY_IDS.ripples);
    expect(prices[tier45.id]).toBe(rippleEvolutionPrice(4));
    expect(prices[tier45.id]).toBe(denizenTier45Price("ripples"));
    expect(prices[tier45.id]).toBe(
      Math.round(
        Math.sqrt(
          RIPPLE_EARLY_PRICE_ANCHORS[3]! * RIPPLE_EARLY_PRICE_ANCHORS[4]!,
        ),
      ),
    );
    expect(RIPPLE_EARLY_PRICE_ANCHORS).toEqual([
      100, 500, 10_000, 100_000, 10_000_000,
    ]);
  });

  it("uses doubling chain for sediment like other non-ripple denizens", () => {
    const def = getDenizenDef("sediment")!;
    const chain = specialtiesForDenizen("sediment");
    for (let tier = 0; tier < 7; tier++) {
      const s = chain[tier]!;
      expect(prices[s.id]).toBe(denizenEvolutionPrice("sediment", tier));
      if (tier >= 4) continue;
      const expected = Math.round(
        def.baseCost * DENIZEN_EVOLUTION_TIER_MULT[tier]!,
      );
      expect(prices[s.id]).toBe(expected);
    }
    expect(prices[chain[0]!.id]).toBe(1_000);
    expect(prices[chain[3]!.id]).toBe(500_000);
    expect(prices[chain[4]!.id]).toBe(sedimentEvolutionPrice(4));
    expect(prices[chain[5]!.id]).toBe(50_000_000);
    expect(chain[4]!.id).toBe(SEDIMENT_CRACIAL_GLAPE_SPECIALTY_ID);
    expect(chain[4]!.unlockOwned).toBe(75);
  });

  it("prices sediment tier 4.5 as 10× tier 3 in chain", () => {
    expect(sedimentEvolutionPrice(4)).toBe(5_000_000);
    expect(sedimentEvolutionPrice(4)).toBe(10 * sedimentEvolutionPrice(3));
  });

  it("applies 10× / 5× / 10× doubling chain on transcendence tier 15", () => {
    const chain = specialtiesForDenizen("transcendence");
    expect(chain).toHaveLength(16);
    const tier15 = chain[15]!;
    expect(tier15.id).toBe(363);
    const tier14 = denizenEvolutionPrice("transcendence", 14);
    expect(prices[tier15.id]).toBe(denizenEvolutionPrice("transcendence", 15));
    expect(prices[tier15.id]).toBe(10 * tier14);
  });

  it("prices every denizen chain via denizenEvolutionPrice", () => {
    for (const denizenId of evolutionChainDenizenIds()) {
      if (
        denizenId === POND_SPECIALTY_DENIZEN_ID ||
        denizenId === "ripples" ||
        denizenId === TREE_SPECIALTY_DENIZEN_ID ||
        denizenId === CLOUD_SPECIALTY_DENIZEN_ID
      ) {
        continue;
      }
      const chain = specialtiesForDenizen(denizenId);
      for (const s of chain) {
        const tier = specialtyTierIndex(s);
        expect(prices[s.id]).toBe(denizenEvolutionPrice(denizenId, tier));
      }
    }
  });
});

describe("specialty catalog wiring", () => {
  it("uses generated prices on denizen defs", () => {
    const def = getDenizenDef("fungi");
    expect(def).toBeDefined();
    const tier0 = specialtiesForDenizen("fungi")[0]!;
    expect(tier0.price).toBe(generateSpecialtyPrices(SPECIALTIES)[tier0.id]);
    expect(tier0.price).toBe(Math.round(def!.baseCost * DENIZEN_EVOLUTION_TIER_MULT[0]!));
  });
});

describe("tier-4.5 denizen evolutions", () => {
  const prices = generateSpecialtyPrices(SPECIALTIES);

  const tier45DenizenIds = [
    "sediment",
    "ripples",
    "fungi",
    "microbes",
    "transcendence",
  ] as const;

  it.each(tier45DenizenIds)(
    "%s chain has 16 specialties with tier-4.5 at index 4",
    (denizenId) => {
      const chain = specialtiesForDenizen(denizenId);
      expect(chain).toHaveLength(16);
      const tier45 = chain[4]!;
      expect(specialtyTierIndex(tier45)).toBe(4);
      expect(tier45.unlockOwned).toBe(DENIZEN_TIER45_UNLOCK_OWNED);
      expect(prices[tier45.id]).toBe(denizenTier45Price(denizenId));
      expect(prices[tier45.id]).toBeGreaterThan(
        denizenTier3PriceForTest(denizenId),
      );
      if (denizenId === "ripples") {
        expect(prices[tier45.id]).toBeLessThan(
          denizenTier4CatalogPrice(denizenId),
        );
      } else {
        expect(prices[tier45.id]).toBe(
          10 * denizenEvolutionPrice(denizenId, 3),
        );
      }
    },
  );

  it("fungi tier-4.5 doubles fungi EpS", () => {
    const tier45 = specialtiesForDenizen("fungi")[4]!;
    expect(tier45.id).toBe(DENIZEN_TIER45_SPECIALTY_IDS.fungi);
    expect(tier45.effect).toEqual({
      type: "double_denizen",
      denizenId: "fungi",
    });
  });

  it("ripples tier-4.5 doubles click and ripples", () => {
    const tier45 = specialtiesForDenizen("ripples")[4]!;
    expect(tier45.id).toBe(DENIZEN_TIER45_SPECIALTY_IDS.ripples);
    expect(tier45.effect).toEqual({
      type: "double_click_and_denizen",
      denizenId: "ripples",
    });
  });

  it("prices fungi tier-4.5 as 10× tier 3 in chain", () => {
    expect(denizenTier45Price("fungi")).toBe(
      10 * denizenEvolutionPrice("fungi", 3),
    );
    expect(denizenTier45Price("fungi")).toBe(50_000_000);
  });
});

function denizenTier3PriceForTest(denizenId: string): number {
  if (denizenId === "ripples") return RIPPLE_EARLY_PRICE_ANCHORS[3]!;
  return denizenEvolutionPrice(denizenId, 3);
}

describe("denizen doubling chain pricing", () => {
  it("uses 10× base, 5× first, then 10× previous for fungi", () => {
    const def = getDenizenDef("fungi")!;
    const p0 = denizenEvolutionPrice("fungi", 0);
    const p1 = denizenEvolutionPrice("fungi", 1);
    const p2 = denizenEvolutionPrice("fungi", 2);
    expect(p0).toBe(Math.round(def.baseCost * 10));
    expect(p1).toBe(5 * p0);
    expect(p2).toBe(10 * p1);
  });
});
