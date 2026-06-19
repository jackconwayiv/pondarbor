import { describe, expect, it } from "vitest";

import { modernRulingPlanetForSign } from "./astroLexicon";
import { housesRuledByPlacement } from "./buildHouseInterpretWriteup";
import type { NatalChartPayload } from "./chartTypes";

function chartWithCusps(cusps: number[]): NatalChartPayload {
  return {
    schema_version: 1,
    meta: {},
    points: {
      sun: { longitude_deg: 120, sign: "leo" },
      mars: { longitude_deg: 10, sign: "aries" },
      pluto: { longitude_deg: 220, sign: "libra" },
      saturn: { longitude_deg: 250, sign: "sagittarius" },
      uranus: { longitude_deg: 300, sign: "aquarius" },
    },
    angles: {
      ascendant: { longitude_deg: 15, sign: "aries" },
      midheaven: { longitude_deg: 280, sign: "capricorn" },
    },
    houses: {
      system: "placidus",
      cusps_longitude_deg: cusps,
    },
    aspects: [],
  };
}

describe("sign ruling planets", () => {
  it("uses Pluto for Scorpio and Uranus for Aquarius", () => {
    expect(modernRulingPlanetForSign("scorpio")).toBe("Pluto");
    expect(modernRulingPlanetForSign("aquarius")).toBe("Uranus");
    expect(modernRulingPlanetForSign("Scorpio")).toBe("Pluto");
    expect(modernRulingPlanetForSign("Aquarius")).toBe("Uranus");
  });
});

describe("housesRuledByPlacement", () => {
  it("assigns Scorpio-cusp houses to Pluto, not Mars", () => {
    const cusps = Array.from({ length: 12 }, (_, i) => (i * 30) % 360);
    cusps[0] = 210; // 1st house cusp in Scorpio
    const chart = chartWithCusps(cusps);

    const plutoRuled = housesRuledByPlacement(chart, "pluto");
    const marsRuled = housesRuledByPlacement(chart, "mars");

    expect(plutoRuled.map((r) => r.house)).toContain(1);
    expect(marsRuled.map((r) => r.house)).not.toContain(1);
  });

  it("assigns Aquarius-cusp houses to Uranus, not Saturn", () => {
    const cusps = Array.from({ length: 12 }, (_, i) => (i * 30) % 360);
    cusps[10] = 300; // 11th house cusp in Aquarius
    const chart = chartWithCusps(cusps);

    const uranusRuled = housesRuledByPlacement(chart, "uranus");
    const saturnRuled = housesRuledByPlacement(chart, "saturn");

    expect(uranusRuled.map((r) => r.house)).toContain(11);
    expect(saturnRuled.map((r) => r.house)).not.toContain(11);
  });
});
