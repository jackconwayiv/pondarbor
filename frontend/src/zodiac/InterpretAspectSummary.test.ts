import { describe, expect, it } from "vitest";

import {
  combineAspectLeadParagraphs,
  visibleAspectSummaryParagraphs,
} from "./InterpretAspectSummary";

describe("InterpretAspectSummary", () => {
  const paragraphs = [
    "Your Moon in Cancer forms a sextile with your Venus in Virgo. This sextile provides you with an opportunity for growth.",
    "Your nurturing and intuitive approach to emotions supports your meticulous and analytical approach to relating.",
    "Growth often comes through consciously combining emotions and relating.",
    "With an orb of 2°15', this is a particularly powerful aspect in your chart.",
  ];

  it("combines lead paragraphs with a colon on full aspect pages", () => {
    expect(visibleAspectSummaryParagraphs(paragraphs, false)).toEqual([
      combineAspectLeadParagraphs(paragraphs[0]!, paragraphs[1]!),
      paragraphs[2],
      paragraphs[3],
    ]);
    expect(combineAspectLeadParagraphs(paragraphs[0]!, paragraphs[1]!)).toBe(
      "Your Moon in Cancer forms a sextile with your Venus in Virgo. This sextile provides you with an opportunity for growth: your nurturing and intuitive approach to emotions supports your meticulous and analytical approach to relating.",
    );
  });

  it("shows only the cooperation paragraph on placement inline cards", () => {
    expect(visibleAspectSummaryParagraphs(paragraphs, true)).toEqual([paragraphs[1]]);
  });
});
