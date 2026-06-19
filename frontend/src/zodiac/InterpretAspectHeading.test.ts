import { describe, expect, it } from "vitest";

import {
  buildAspectHeadingParts,
  buildTightestPlacementAspectNote,
  formatAspectHeadingText,
} from "./InterpretAspectHeading";
import type { NatalChartPayload } from "./chartTypes";

function fixtureChart(): NatalChartPayload {
  return {
    schema_version: 1,
    meta: {},
    points: {
      sun: { longitude_deg: 120, sign: "leo" },
      moon: { longitude_deg: 95, sign: "cancer" },
      venus: { longitude_deg: 150, sign: "virgo" },
      mars: { longitude_deg: 155, sign: "virgo" },
      jupiter: { longitude_deg: 158, sign: "virgo" },
    },
    angles: {
      ascendant: { longitude_deg: 15, sign: "aries" },
      midheaven: { longitude_deg: 280, sign: "capricorn" },
    },
    houses: {
      system: "placidus",
      cusps_longitude_deg: Array.from({ length: 12 }, (_, i) => i * 30),
    },
    aspects: [
      {
        body_a: "moon",
        body_b: "venus",
        type: "sextile",
        nominal_angle_deg: 60,
        orb_deg: 2.25,
      },
      {
        body_a: "mars",
        body_b: "jupiter",
        type: "conjunction",
        nominal_angle_deg: 0,
        orb_deg: 1.5,
      },
    ],
  };
}

describe("InterpretAspectHeading", () => {
  it("places each body sign inline on full aspect pages", () => {
    const chart = fixtureChart();
    const parts = buildAspectHeadingParts(chart.aspects[0]!, chart);
    expect(formatAspectHeadingText(parts!)).toBe("Moon in Cancer Sextile Venus in Virgo");
    expect(parts?.accessibleLabel).toBe("Moon in Cancer Sextile Venus in Virgo");
    expect(parts?.firstBody.label).toBe("Moon");
    expect(parts?.secondBody.label).toBe("Venus");
  });

  it("uses Conjunct for conjunction headings", () => {
    const chart = fixtureChart();
    const parts = buildAspectHeadingParts(chart.aspects[1]!, chart);
    expect(formatAspectHeadingText(parts!)).toBe("Mars in Virgo Conjunct Jupiter in Virgo");
    expect(parts?.aspect.label).toBe("Conjunct");
  });

  it("formats rising as sign-first (Pisces Rising)", () => {
    const chart = fixtureChart();
    chart.points.sun = { longitude_deg: 350, sign: "pisces" };
    chart.angles.ascendant = { longitude_deg: 355, sign: "pisces" };
    chart.aspects.push({
      body_a: "sun",
      body_b: "ascendant",
      type: "conjunction",
      nominal_angle_deg: 0,
      orb_deg: 1,
    });
    const parts = buildAspectHeadingParts(chart.aspects[2]!, chart);
    expect(formatAspectHeadingText(parts!)).toBe("Sun in Pisces Conjunct Pisces Rising");
  });

  it("shows both inline signs on placement-led headings", () => {
    const chart = fixtureChart();
    const parts = buildAspectHeadingParts(chart.aspects[0]!, chart, "moon");
    expect(formatAspectHeadingText(parts!)).toBe("Moon in Cancer Sextile Venus in Virgo");
    expect(parts?.firstBody.label).toBe("Moon");
    expect(parts?.secondBody.label).toBe("Venus");
  });

  it("reorders bodies so the placement anchor is first", () => {
    const chart = fixtureChart();
    const parts = buildAspectHeadingParts(chart.aspects[0]!, chart, "venus");
    expect(formatAspectHeadingText(parts!)).toBe("Venus in Virgo Sextile Moon in Cancer");
    expect(parts?.firstBody.label).toBe("Venus");
    expect(parts?.secondBody.label).toBe("Moon");
  });
});

describe("buildTightestPlacementAspectNote", () => {
  it("returns a note for very tight placement aspects", () => {
    const chart = fixtureChart();
    expect(buildTightestPlacementAspectNote("moon", chart, { birthTimeUnknown: false })).toMatch(
      /close sextile with Venus/,
    );
  });

  it("returns null when the closest aspect is wider than 3 degrees", () => {
    const chart = fixtureChart();
    chart.aspects[0]!.orb_deg = 4;
    expect(buildTightestPlacementAspectNote("moon", chart, { birthTimeUnknown: false })).toBeNull();
  });
});
