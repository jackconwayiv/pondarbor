import { describe, expect, it } from "vitest";

import {
  aspectStrengthTier,
  aspectWithinInterpretOrb,
  buildAspectStrengthParagraph,
  effectiveOrbForStrength,
  maxOrbForInterpret,
} from "./zodiacAspectStrength";

describe("zodiacAspectStrength", () => {
  it("applies luminary bonus to max orb and effective orb for strength", () => {
    expect(maxOrbForInterpret("sextile", "sun", "moon")).toBe(8);
    expect(maxOrbForInterpret("sextile", "mercury", "uranus")).toBe(6);
    expect(effectiveOrbForStrength(5, "pluto", "midheaven")).toBe(3);
    expect(effectiveOrbForStrength(5.5, "mercury", "uranus")).toBe(5.5);
  });

  it("maps effective orb to strength tiers", () => {
    expect(aspectStrengthTier(0.5)).toBe("dominant");
    expect(aspectStrengthTier(1)).toBe("strong");
    expect(aspectStrengthTier(2.9)).toBe("strong");
    expect(aspectStrengthTier(3)).toBe("moderate");
    expect(aspectStrengthTier(4.9)).toBe("moderate");
    expect(aspectStrengthTier(5)).toBe("subtle");
    expect(aspectStrengthTier(6.9)).toBe("subtle");
    expect(aspectStrengthTier(7)).toBe("background");
  });

  it("builds tier copy from orb and bodies", () => {
    const orbNote =
      " (An orb is how many degrees off the exact angle of 60° this aspect is.)";
    expect(buildAspectStrengthParagraph(2.25, "sextile", "moon", "venus")).toBe(
      `With an orb of 2°15', this is a particularly powerful aspect in your chart.${orbNote}`,
    );
    expect(buildAspectStrengthParagraph(1, "square", "sun", "mars")).toBe(
      `With an orb of 1°0', this is a particularly powerful aspect in your chart. (An orb is how many degrees off the exact angle of 90° this aspect is.)`,
    );
    expect(buildAspectStrengthParagraph(5, "sextile", "pluto", "midheaven")).toBe(
      `With an orb of 5°0', this aspect is a meaningful part of your chart.${orbNote}`,
    );
  });

  it("builds subtle-tier strength copy with chart phrasing", () => {
    expect(buildAspectStrengthParagraph(5.5, "trine", "mercury", "uranus")).toBe(
      "With an orb of 5°30', this aspect may emerge in specific situations in your chart. (An orb is how many degrees off the exact angle of 120° this aspect is.)",
    );
  });

  it("filters aspects beyond type max orb", () => {
    expect(
      aspectWithinInterpretOrb({
        type: "sextile",
        orb_deg: 7,
        body_a: "mercury",
        body_b: "uranus",
      }),
    ).toBe(false);
    expect(
      aspectWithinInterpretOrb({
        type: "trine",
        orb_deg: 9,
        body_a: "sun",
        body_b: "moon",
      }),
    ).toBe(true);
    expect(
      aspectWithinInterpretOrb({
        type: "quincunx",
        orb_deg: 5.5,
        body_a: "sun",
        body_b: "mars",
      }),
    ).toBe(false);
    expect(
      aspectWithinInterpretOrb({
        type: "quincunx",
        orb_deg: 3.5,
        body_a: "mercury",
        body_b: "uranus",
      }),
    ).toBe(false);
  });
});
