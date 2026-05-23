import { describe, expect, it } from "vitest";

import {
  formatEnergyAmount,
  formatEnergyAmountCompact,
} from "./formatEnergy";

describe("formatEnergyAmount", () => {
  it("drops trailing zeros in scaled mantissas", () => {
    expect(formatEnergyAmount(1_200_000)).toBe("1.2 million");
    expect(formatEnergyAmount(12_000_000)).toBe("12 million");
    expect(formatEnergyAmount(1_230_000)).toBe("1.23 million");
  });
});

describe("formatEnergyAmountCompact", () => {
  it("formats millions and billions with short words", () => {
    expect(formatEnergyAmountCompact(12_000_000)).toBe("12 mil");
    expect(formatEnergyAmountCompact(4_500_000_000)).toBe("4.5 bil");
  });

  it("uses K for thousands below a million", () => {
    expect(formatEnergyAmountCompact(50_000)).toBe("50K");
  });

  it("keeps small values as plain integers", () => {
    expect(formatEnergyAmountCompact(999)).toBe("999");
  });
});
