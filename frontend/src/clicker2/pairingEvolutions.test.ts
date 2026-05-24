import { describe, expect, it } from "vitest";

import { getOwnedDenizenCount } from "./denizens";
import { SPECIALTY_PRICE_BY_ID } from "./evolutionPrices.generated";
import {
  generatePairingSpecialtyDefs,
  pairingEvolutionName,
  pairingSourcePerStep,
  pairingSpecialtyCount,
  proposedPairingPrice,
  PAIRING_SPECIALTY_ID_START,
} from "./pairingEvolutions";
import { SPECIALTIES } from "./specialties";
import { isSpecialtyUnlocked } from "./visibility";
import { simulateGame } from "./simulation";

const catalogPrice = (id: number) => SPECIALTY_PRICE_BY_ID[id] ?? 1;

describe("pairingSourcePerStep", () => {
  it("matches launch cards and fungi→microbes anchor", () => {
    expect(pairingSourcePerStep("ripples", "sediment")).toBe(10);
    expect(pairingSourcePerStep("ripples", "fungi")).toBe(11);
    expect(pairingSourcePerStep("sediment", "fungi")).toBe(11);
    expect(pairingSourcePerStep("sediment", "microbes")).toBe(12);
    expect(pairingSourcePerStep("fungi", "microbes")).toBe(12);
    expect(pairingSourcePerStep("ripples", "microbes")).toBe(12);
  });
});

describe("proposedPairingPrice", () => {
  it("blends 50% L 2nd evolution + 50% H 1st evolution for launch pairs", () => {
    expect(proposedPairingPrice("ripples", "sediment", catalogPrice)).toBe(7_500);
    expect(proposedPairingPrice("ripples", "fungi", catalogPrice)).toBe(52_500);
    expect(proposedPairingPrice("sediment", "fungi", catalogPrice)).toBe(75_000);
    expect(proposedPairingPrice("sediment", "microbes", catalogPrice)).toBe(
      525_000,
    );
  });

  it("depends on both L and H", () => {
    expect(proposedPairingPrice("ripples", "sediment", catalogPrice)).not.toBe(
      proposedPairingPrice("sediment", "fungi", catalogPrice),
    );
    const ripplesToTranscendence = proposedPairingPrice(
      "ripples",
      "transcendence",
      catalogPrice,
    );
    const spiritsToTranscendence = proposedPairingPrice(
      "spirits",
      "transcendence",
      catalogPrice,
    );
    expect(spiritsToTranscendence).toBeGreaterThan(ripplesToTranscendence);
  });
});

describe("generatePairingSpecialtyDefs", () => {
  it("emits 253 unique ids from 364", () => {
    const defs = generatePairingSpecialtyDefs(catalogPrice);
    expect(defs.length).toBe(pairingSpecialtyCount());
    expect(defs.length).toBe(253);
    const ids = new Set(defs.map((d) => d.id));
    expect(ids.size).toBe(253);
    expect(Math.min(...ids)).toBe(PAIRING_SPECIALTY_ID_START);
    expect(Math.max(...ids)).toBe(PAIRING_SPECIALTY_ID_START + 252);
  });

  it("uses named overrides for the four launch pairings", () => {
    expect(pairingEvolutionName("ripples", "sediment")).toBe("Shifting Bed");
    expect(pairingEvolutionName("ripples", "fungi")).toBe("Flowing Decay");
    expect(pairingEvolutionName("sediment", "fungi")).toBe("Nutrient Floor");
    expect(pairingEvolutionName("sediment", "microbes")).toBe("Primeval Layer");
  });

  it("applies blend pricing on generated defs", () => {
    const shifting = SPECIALTIES.find((s) => s.name === "Shifting Bed")!;
    expect(shifting.price).toBe(7_500);
    const primeval = SPECIALTIES.find((s) => s.name === "Primeval Layer")!;
    expect(primeval.price).toBe(525_000);
  });
});

describe("pairing unlock and simulation", () => {
  const nutrientFloor = SPECIALTIES.find((s) => s.name === "Nutrient Floor")!;

  it("requires 1 sediment and 15 fungi, not the reverse", () => {
    const ok = { sediment: 1, fungi: 15, ripples: 1 };
    const bad = { sediment: 15, fungi: 1, ripples: 1 };
    expect(isSpecialtyUnlocked(nutrientFloor, ok, 0)).toBe(true);
    expect(isSpecialtyUnlocked(nutrientFloor, bad, 0)).toBe(false);
  });

  it("doubles sediment and scales fungi from sediment count", () => {
    const ownedDenizens = { ripples: 1, sediment: 22, fungi: 15 };
    const before = simulateGame(ownedDenizens, {});
    const after = simulateGame(ownedDenizens, { [nutrientFloor.id]: true });
    expect(after.denizenEps.sediment).toBeCloseTo(
      before.denizenEps.sediment * 2,
      5,
    );
    const steps = Math.floor(
      getOwnedDenizenCount(ownedDenizens, "sediment") / 11,
    );
    expect(after.denizenEps.fungi).toBeCloseTo(
      before.denizenEps.fungi * (1 + steps / 100),
      5,
    );
  });
});
