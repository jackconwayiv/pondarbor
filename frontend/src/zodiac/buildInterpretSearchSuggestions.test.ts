import { describe, expect, it } from "vitest";

import { buildInterpretSearchSuggestions } from "./buildInterpretSearchSuggestions";
import type { NatalChartPayload } from "./chartTypes";

function fixtureChart(): NatalChartPayload {
  return {
    schema_version: 1,
    meta: {},
    points: {
      sun: { longitude_deg: 350, sign: "pisces", house: 12 },
      moon: { longitude_deg: 95, sign: "cancer", house: 4 },
      venus: { longitude_deg: 330, sign: "aquarius", house: 11 },
    },
    angles: {
      ascendant: { longitude_deg: 15, sign: "aries" },
      midheaven: { longitude_deg: 280, sign: "capricorn" },
    },
    houses: {
      system: "placidus",
      cusps_longitude_deg: Array.from({ length: 12 }, (_, i) => i * 30),
    },
    aspects: [],
  };
}

describe("buildInterpretSearchSuggestions", () => {
  it("keeps placement-specific tags on planet pages, not generic sign or house", () => {
    const chart = fixtureChart();
    const suggestions = buildInterpretSearchSuggestions(
      {
        kind: "placement",
        tile: {
          id: "sun",
          label: "Sun",
          sign: "pisces",
          house: 12,
          bodyPhrases: [],
          bodyHeading: "Sun",
        },
      },
      chart,
    );

    expect(suggestions).toContain("sun in pisces");
    expect(suggestions).toContain("sun in 12th house");
    expect(suggestions).not.toContain("pisces sign");
    expect(suggestions).not.toContain("12th house");
  });

  it("omits generic house and sign tags on rising and midheaven pages", () => {
    const chart = fixtureChart();
    const rising = buildInterpretSearchSuggestions(
      {
        kind: "placement",
        tile: {
          id: "rising",
          label: "Rising",
          sign: "aries",
          house: 1,
          bodyPhrases: [],
          bodyHeading: "Rising / Ascendant",
        },
      },
      chart,
    );
    expect(rising).toContain("aries rising");
    expect(rising).not.toContain("1st house");
    expect(rising).not.toContain("aries sign");

    const midheaven = buildInterpretSearchSuggestions(
      {
        kind: "placement",
        tile: {
          id: "midheaven",
          label: "Midheaven",
          sign: "capricorn",
          house: 10,
          bodyPhrases: [],
          bodyHeading: "Midheaven / MC",
        },
      },
      chart,
    );
    expect(midheaven).toContain("midheaven in capricorn");
    expect(midheaven).not.toContain("10th house");
    expect(midheaven).not.toContain("capricorn sign");
  });

  it("includes signless aspect phrases on aspect pages", () => {
    const chart = fixtureChart();
    chart.points.jupiter = { longitude_deg: 170, sign: "virgo" };
    chart.aspects.push({
      body_a: "sun",
      body_b: "jupiter",
      type: "opposition",
      nominal_angle_deg: 180,
      orb_deg: 2,
    });
    const suggestions = buildInterpretSearchSuggestions(
      { kind: "aspect", aspect: chart.aspects[0]! },
      chart,
    );
    expect(suggestions).toContain("sun opposite jupiter");
    expect(suggestions).toContain("sun in pisces opposite jupiter in virgo");
  });

  it("omits bare house and sign tags on house and sign pages", () => {
    const chart = fixtureChart();
    const house = buildInterpretSearchSuggestions({ kind: "house", house: 12 }, chart);
    expect(house.some((s) => s === "12th house")).toBe(false);
    expect(house.some((s) => s.includes(" on 12th house cusp"))).toBe(true);

    const sign = buildInterpretSearchSuggestions({ kind: "sign", sign: "pisces" }, chart);
    expect(sign).not.toContain("pisces sign");
    expect(sign).not.toContain("pisces");
  });
});
