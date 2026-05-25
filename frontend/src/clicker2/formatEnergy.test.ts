import { describe, expect, it } from "vitest";

import {
  formatEnergyAmount,
  formatEnergyAmountCompact,
  formatEnergyAmountHud,
} from "./formatEnergy";

describe("formatEnergyAmount", () => {
  it("drops trailing zeros in scaled mantissas", () => {
    expect(formatEnergyAmount(1_200_000)).toBe("1.2 million");
    expect(formatEnergyAmount(12_000_000)).toBe("12 million");
    expect(formatEnergyAmount(1_230_000)).toBe("1.23 million");
  });
});

describe("formatEnergyAmountHud", () => {
  it("uses three decimal places for scaled mantissas", () => {
    expect(formatEnergyAmountHud(1_200_000)).toBe("1.200 million");
    expect(formatEnergyAmountHud(12_000_000)).toBe("12.000 million");
    expect(formatEnergyAmountHud(1_230_000)).toBe("1.230 million");
  });

  it("keeps sub-million values as plain integers", () => {
    expect(formatEnergyAmountHud(999_999)).toBe("999,999");
  });
});

describe("formatEnergyAmountCompact", () => {
  it("formats millions, billions, and trillions with letter suffixes", () => {
    expect(formatEnergyAmountCompact(12_000_000)).toBe("12M");
    expect(formatEnergyAmountCompact(4_500_000_000)).toBe("4.5B");
    expect(formatEnergyAmountCompact(2_300_000_000_000)).toBe("2.3T");
  });

  it("uses K for thousands below a million", () => {
    expect(formatEnergyAmountCompact(50_000)).toBe("50K");
    expect(formatEnergyAmountCompact(999_999)).toBe("1000K");
  });

  it("keeps small values as plain integers", () => {
    expect(formatEnergyAmountCompact(999)).toBe("999");
  });
});
