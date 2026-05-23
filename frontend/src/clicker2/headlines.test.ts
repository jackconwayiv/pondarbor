import { describe, expect, it } from "vitest";

import {
  activeHeadlineForEps,
  headlineDisplayLines,
  HEADLINES,
} from "./headlines";

describe("headlines", () => {
  it("shows highest EpS tier at each threshold", () => {
    expect(activeHeadlineForEps(0)?.id).toBe("ditch_rain");
    expect(activeHeadlineForEps(0.05)?.id).toBe("ditch_rain");
    expect(activeHeadlineForEps(0.1)?.id).toBe("lone_ripple");
    expect(activeHeadlineForEps(0.5)?.id).toBe("lone_ripple");
    expect(activeHeadlineForEps(1)?.id).toBe("twig_falls");
    expect(activeHeadlineForEps(2.9)?.id).toBe("twig_falls");
    expect(activeHeadlineForEps(3)?.id).toBe("mosquito_departure");
    expect(activeHeadlineForEps(4.9)?.id).toBe("mosquito_departure");
    expect(activeHeadlineForEps(5)?.id).toBe("energy_trickle");
    expect(activeHeadlineForEps(9.9)?.id).toBe("energy_trickle");
    expect(activeHeadlineForEps(10)?.id).toBe("first_clarity");
    expect(activeHeadlineForEps(1_000)?.id).toBe("liquid_silver");
  });

  it("splits haiku headlines on slashes", () => {
    expect(headlineDisplayLines("A / B / C")).toEqual(["A", "B", "C"]);
    expect(headlineDisplayLines("Plain prose headline.")).toEqual([
      "Plain prose headline.",
    ]);
  });

  it("catalog is sorted by unlockEps ascending", () => {
    for (let i = 1; i < HEADLINES.length; i++) {
      expect(HEADLINES[i]!.unlockEps).toBeGreaterThan(HEADLINES[i - 1]!.unlockEps);
    }
  });
});
