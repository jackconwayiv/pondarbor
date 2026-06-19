import { describe, expect, it } from "vitest";

import { buildAspectInterpretWriteup } from "./buildAspectInterpretWriteup";
import { buildInterpretWriteup, buildInterpretPlacementTiles } from "./buildInterpretWriteup";
import {
  aspectsForPlacementTile,
  filterAspectsForInterpret,
} from "./zodiacAspectFilters";
import { interpretAspectPageIndex, buildInterpretPages } from "./buildInterpretPages";
import type { NatalChartPayload } from "./chartTypes";
import {
  aspectPairTheme,
  canonicalPairKey,
  planetFunctionForBody,
} from "./zodiacAspectLexicon";

function fixtureChart(): NatalChartPayload {
  return {
    schema_version: 1,
    meta: {},
    points: {
      sun: { longitude_deg: 120, sign: "leo" },
      moon: { longitude_deg: 95, sign: "cancer" },
      mercury: { longitude_deg: 130, sign: "leo" },
      venus: { longitude_deg: 150, sign: "virgo" },
      mars: { longitude_deg: 10, sign: "aries" },
      jupiter: { longitude_deg: 200, sign: "libra" },
      saturn: { longitude_deg: 250, sign: "sagittarius" },
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
        body_a: "jupiter",
        body_b: "saturn",
        type: "sextile",
        nominal_angle_deg: 60,
        orb_deg: 1.5,
      },
      {
        body_a: "midheaven",
        body_b: "jupiter",
        type: "sextile",
        nominal_angle_deg: 60,
        orb_deg: 3.75,
      },
      {
        body_a: "sun",
        body_b: "mars",
        type: "square",
        nominal_angle_deg: 90,
        orb_deg: 1.0,
      },
      {
        body_a: "mercury",
        body_b: "jupiter",
        type: "trine",
        nominal_angle_deg: 120,
        orb_deg: 2.5,
      },
    ],
  };
}

describe("zodiacAspectLexicon", () => {
  it("builds canonical pair keys independent of body order", () => {
    expect(canonicalPairKey("venus", "moon")).toBe("moon|venus");
    expect(canonicalPairKey("moon", "venus")).toBe("moon|venus");
  });

  it("returns hand-authored moon-venus pair theme", () => {
    const pair = aspectPairTheme("moon", "venus");
    expect(pair.theme).toBe("emotions and relating");
  });

  it("falls back procedurally for unlisted pairs", () => {
    const pair = aspectPairTheme("chiron", "ceres");
    expect(pair.theme).toContain("and");
  });

  it("maps chart bodies to life functions", () => {
    expect(planetFunctionForBody("pluto").noun).toBe("transformation");
    expect(planetFunctionForBody("ascendant").noun).toBe("persona");
    expect(planetFunctionForBody("midheaven").noun).toBe("public life");
    expect(planetFunctionForBody("mercury").noun).toBe("communication");
  });
});

describe("buildAspectInterpretWriteup", () => {
  it("builds placement-led sextile copy with sign adjectives and domain concerns", () => {
    const chart = fixtureChart();
    const writeup = buildAspectInterpretWriteup(chart.aspects[0]!, chart);
    expect(writeup?.title).toBe("Moon in Cancer Sextile Venus in Virgo");
    expect(writeup?.paragraphs).toHaveLength(4);
    expect(writeup?.paragraphs[0]).toBe(
      "Your Moon in Cancer forms a sextile with your Venus in Virgo. This sextile provides you with an opportunity for growth.",
    );
    expect(writeup?.paragraphs[1]).toBe(
      "Your nurturing and intuitive approach to emotions supports your meticulous and analytical approach to relating.",
    );
    expect(writeup?.paragraphs[2]).toBe(
      "Growth comes through consciously combining these energies. When you honor your feelings and emotional needs, you may find new support for your relationships, pleasure, and sense of harmony. Likewise, when you express affection and align with what you value, you can strengthen your inner security, comfort, and emotional well-being.",
    );
    expect(writeup?.paragraphs[3]).toBe(
      "With an orb of 2°15', this is a particularly powerful aspect in your chart. (An orb is how many degrees off the exact angle of 60° this aspect is.)",
    );
    expect(writeup?.summaryText).toBe(writeup?.paragraphs.join(" "));
  });

  it("orders effort and influence from the placement anchor body", () => {
    const chart = fixtureChart();
    const aspect = chart.aspects[0]!;
    const moonLed = buildAspectInterpretWriteup(aspect, chart)!;
    const venusLed = buildAspectInterpretWriteup(aspect, chart, { placementTileId: "venus" })!;
    expect(moonLed.paragraphs[2]).toContain("honor your feelings");
    expect(moonLed.paragraphs[2]).toContain("express affection");
    expect(venusLed.paragraphs[2]).toContain("express affection");
    expect(venusLed.paragraphs[2]).toContain("honor your feelings");
  });

  it("builds square copy with challenges verb and tension outcome", () => {
    const chart = fixtureChart();
    const writeup = buildAspectInterpretWriteup(chart.aspects[3]!, chart);
    expect(writeup?.title).toBe("Sun in Leo Square Mars in Aries");
    expect(writeup?.paragraphs[1]).toMatch(/ challenges your /);
    expect(writeup?.paragraphs[2]).toMatch(
      /^Growth comes through resolving tension between these energies\. When you express your identity and live from a clearer sense of purpose, friction around your drive, momentum, and how you pursue what you want can become a source of growth\. Likewise, when you act with courage, follow through, and assert yourself cleanly, tension around your confidence, vitality, and how you show up as yourself may sharpen\.$/,
    );
    expect(writeup?.paragraphs[3]).toBe(
      "With an orb of 1°0', this is a particularly powerful aspect in your chart. (An orb is how many degrees off the exact angle of 90° this aspect is.)",
    );
  });

  it("builds trine copy with aligns-with verb and natural reinforcement outcome", () => {
    const chart = fixtureChart();
    const writeup = buildAspectInterpretWriteup(chart.aspects[4]!, chart);
    expect(writeup?.title).toBe("Mercury in Leo Trine Jupiter in Libra");
    expect(writeup?.paragraphs[1]).toMatch(/ aligns with your /);
    expect(writeup?.paragraphs[2]).toMatch(
      /^These energies tend to support and strengthen one another naturally\. As you think clearly, communicate thoughtfully, and stay curious, your growth, meaning, and openness to opportunity tend to flow more easily\. Likewise, as you expand your perspective and aim higher with good faith, your learning, conversation, and everyday decision-making tend to strengthen naturally\.$/,
    );
  });

  it("builds opposition copy with conflict and integration paragraphs", () => {
    const chart = fixtureChart();
    chart.points.mercury = { longitude_deg: 350, sign: "pisces" };
    chart.points.saturn = { longitude_deg: 170, sign: "virgo" };
    chart.aspects.push({
      body_a: "mercury",
      body_b: "saturn",
      type: "opposition",
      nominal_angle_deg: 180,
      orb_deg: 2,
    });
    const writeup = buildAspectInterpretWriteup(chart.aspects[chart.aspects.length - 1]!, chart);
    expect(writeup?.paragraphs).toHaveLength(5);
    expect(writeup?.paragraphs[1]).toBe(
      "Your empathetic and creative approach to communication and your meticulous and analytical approach to structure.",
    );
    expect(writeup?.paragraphs[2]).toBe(
      "These energies may sometimes pull you in different directions. At times, your desire to imagine, explore possibilities, and communicate intuitively can seem at odds with your need for precision, discipline, and practical results. Growth comes from recognizing the value of both perspectives.",
    );
    expect(writeup?.paragraphs[3]).toBe(
      "As you develop balance between these energies, your communication can inform your structure, while your structure provides grounding and perspective for your communication. Over time, what first feels like a contradiction can become a source of greater awareness and maturity.",
    );
  });

  it("excludes outer-planet-only and overly wide aspects from interpret filter", () => {
    const chart = fixtureChart();
    chart.aspects.push({
      body_a: "mercury",
      body_b: "venus",
      type: "sextile",
      nominal_angle_deg: 60,
      orb_deg: 7,
    });
    const filtered = filterAspectsForInterpret(chart.aspects, { birthTimeUnknown: false });
    expect(filtered.map((a) => `${a.body_a}-${a.body_b}-${a.type}`)).toEqual([
      "sun-mars-square",
      "moon-venus-sextile",
      "mercury-jupiter-trine",
      "midheaven-jupiter-sextile",
    ]);
    expect(filtered.some((a) => a.body_a === "jupiter" && a.body_b === "saturn")).toBe(false);
    expect(filtered.some((a) => a.body_a === "mercury" && a.body_b === "venus")).toBe(false);
  });

  it("includes wide luminary trines within extended max orb", () => {
    const chart = fixtureChart();
    chart.aspects.push({
      body_a: "sun",
      body_b: "moon",
      type: "trine",
      nominal_angle_deg: 120,
      orb_deg: 9,
    });
    const filtered = filterAspectsForInterpret(chart.aspects, { birthTimeUnknown: false });
    expect(filtered.some((a) => a.body_a === "sun" && a.body_b === "moon" && a.type === "trine")).toBe(
      true,
    );
    const writeup = buildAspectInterpretWriteup(
      chart.aspects.find((a) => a.body_a === "sun" && a.body_b === "moon")!,
      chart,
    );
    expect(writeup?.paragraphs[3]).toBe(
      "With an orb of 9°0', this aspect may operate more subtly in the background of your chart. (An orb is how many degrees off the exact angle of 120° this aspect is.)",
    );
  });

  it("builds occupant cards with full placement lead copy including midheaven", () => {
    const chart = fixtureChart();
    const writeup = buildAspectInterpretWriteup(chart.aspects[2]!, chart);
    expect(writeup?.occupants).toHaveLength(2);
    expect(writeup?.occupants.map((o) => o.label)).toEqual(["Midheaven", "Jupiter"]);
    expect(writeup?.occupants[0]?.summary).toMatch(
      /^With Capricorn Midheaven, your .+ manifest as .+\.$/,
    );
  });

  it("builds placement-led copy for pluto and midheaven", () => {
    const chart = fixtureChart();
    chart.points.pluto = { longitude_deg: 220, sign: "libra" };
    chart.aspects.push({
      body_a: "pluto",
      body_b: "midheaven",
      type: "sextile",
      nominal_angle_deg: 60,
      orb_deg: 5,
    });
    const aspect = chart.aspects[chart.aspects.length - 1]!;
    const writeup = buildAspectInterpretWriteup(aspect, chart);
    expect(writeup?.paragraphs[0]).toBe(
      "Your Pluto in Libra forms a sextile with your Midheaven in Capricorn. This sextile provides you with an opportunity for growth.",
    );
    expect(writeup?.paragraphs[1]).toBe(
      "Your diplomatic and charming approach to transformation supports your ambitious and disciplined approach to public life.",
    );
    expect(writeup?.paragraphs[2]).toBe(
      "Growth comes through consciously combining these energies. When you evolve, renew, or deepen your understanding of yourself, you may find new support for your long-term ambitions, reputation, and sense of purpose. Likewise, when you commit to your vocation and long-term direction, you can strengthen your transformation, personal power, and psychological depth.",
    );
    expect(writeup?.paragraphs[3]).toBe(
      "With an orb of 5°0', this aspect is a meaningful part of your chart. (An orb is how many degrees off the exact angle of 60° this aspect is.)",
    );
    expect(writeup?.occupants.map((o) => o.label)).toEqual(["Pluto", "Midheaven"]);
    expect(writeup?.occupants[0]?.summary).toContain("With your Pluto in Libra, your");
  });
});

describe("buildInterpretPages aspects", () => {
  it("includes aspect pages and midheaven placement", () => {
    const chart = fixtureChart();
    const pages = buildInterpretPages(chart, { includeHouses: true, includeRising: true });
    const midheavenPage = pages.find((p) => p.kind === "placement" && p.tile.id === "midheaven");
    expect(midheavenPage).toBeTruthy();

    const aspectIdx = interpretAspectPageIndex(pages, chart.aspects[0]!);
    expect(aspectIdx).not.toBeNull();
    expect(pages[aspectIdx!]?.kind).toBe("aspect");
  });

  it("lists moon aspects on the moon placement page filter", () => {
    const chart = fixtureChart();
    const moonAspects = aspectsForPlacementTile("moon", chart, { birthTimeUnknown: false });
    expect(moonAspects).toHaveLength(1);
    expect(moonAspects[0]?.body_b).toBe("venus");
  });

  it("maps rising tile to ascendant aspects", () => {
    const chart = fixtureChart();
    chart.aspects.push({
      body_a: "ascendant",
      body_b: "mars",
      type: "sextile",
      nominal_angle_deg: 60,
      orb_deg: 4,
    });
    const risingAspects = aspectsForPlacementTile("rising", chart, { birthTimeUnknown: false });
    expect(risingAspects.some((a) => a.body_a === "ascendant" || a.body_b === "ascendant")).toBe(
      true,
    );
  });
});

describe("midheaven interpret writeup", () => {
  it("builds a midheaven placement writeup with 10th house follow-up", () => {
    const chart = fixtureChart();
    const tile = buildInterpretPlacementTiles(chart, { includeRising: true }).find(
      (t) => t.id === "midheaven",
    );
    expect(tile).toBeTruthy();
    const writeup = buildInterpretWriteup(tile!, chart);
    expect(writeup?.planetDomainsLead.isMidheaven).toBe(true);
    expect(writeup?.houseFollowUp?.house).toBe(10);
  });
});
