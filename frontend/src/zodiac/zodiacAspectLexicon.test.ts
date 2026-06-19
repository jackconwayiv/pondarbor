import { describe, expect, it } from "vitest";

import { aspectPairTheme, canonicalPairKey, isHandAuthoredAspectPair } from "./zodiacAspectLexicon";

const ANCHOR_BODIES = [
  "sun",
  "moon",
  "ascendant",
  "mercury",
  "venus",
  "mars",
  "midheaven",
] as const;

const OUTER_BODIES = ["jupiter", "saturn", "uranus", "neptune", "pluto"] as const;

describe("ASPECT_PAIR_THEMES coverage", () => {
  it("has hand-authored themes for all 21 anchor×anchor pairs", () => {
    for (let i = 0; i < ANCHOR_BODIES.length; i++) {
      for (let j = i + 1; j < ANCHOR_BODIES.length; j++) {
        const a = ANCHOR_BODIES[i]!;
        const b = ANCHOR_BODIES[j]!;
        expect(isHandAuthoredAspectPair(a, b)).toBe(true);
        expect(aspectPairTheme(a, b).theme.length).toBeGreaterThan(0);
      }
    }
  });

  it("has hand-authored themes for all 35 anchor×outer pairs", () => {
    for (const anchor of ANCHOR_BODIES) {
      for (const outer of OUTER_BODIES) {
        expect(canonicalPairKey(anchor, outer)).toMatch(/\|/);
        expect(isHandAuthoredAspectPair(anchor, outer)).toBe(true);
        expect(aspectPairTheme(anchor, outer).theme.length).toBeGreaterThan(0);
      }
    }
  });

  it("uses standard planetary language for common pairs", () => {
    expect(aspectPairTheme("moon", "venus").theme).toBe("emotions and relating");
    expect(aspectPairTheme("pluto", "midheaven").theme).toBe(
      "transformation and public life",
    );
    expect(aspectPairTheme("mars", "venus").theme).toBe("desire and relating");
  });
});
