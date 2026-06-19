import { describe, expect, it } from "vitest";

import {
  buildAspectInteractionParagraph,
  buildOppositionConflictParagraph,
  buildOppositionIntegrationParagraph,
  ASPECT_TYPE_COPY,
} from "./zodiacAspectCopy";

const dynamics = {
  effortFromFirst: "act with courage, follow through, and assert yourself cleanly",
  influenceOnSecond: "growth, meaning, and openness to opportunity",
  effortFromSecond: "expand your perspective and aim higher with good faith",
  influenceOnFirst: "drive, momentum, and how you pursue what you want",
};

const mercurySaturnProceduralSlots = {
  planetADomain: "communication",
  planetAStrength: "desire to imagine, explore possibilities, and communicate intuitively",
  planetBDomain: "structure",
  planetBStrength: "need for precision, discipline, and practical results",
};

describe("buildAspectInteractionParagraph", () => {
  it("uses unified-force lead for conjunctions", () => {
    expect(
      buildAspectInteractionParagraph("conjunction", ASPECT_TYPE_COPY.conjunction, dynamics),
    ).toBe(
      "These energies become closely intertwined and often operate as a unified force. When you act with courage, follow through, and assert yourself cleanly, your growth, meaning, and openness to opportunity often strengthens. Likewise, when you expand your perspective and aim higher with good faith, your drive, momentum, and how you pursue what you want can deepen.",
    );
  });

  it("uses natural-flow wording for trines", () => {
    expect(buildAspectInteractionParagraph("trine", ASPECT_TYPE_COPY.trine, dynamics)).toBe(
      "These energies tend to support and strengthen one another naturally. As you act with courage, follow through, and assert yourself cleanly, your growth, meaning, and openness to opportunity tend to flow more easily. Likewise, as you expand your perspective and aim higher with good faith, your drive, momentum, and how you pursue what you want tend to strengthen naturally.",
    );
    expect(
      buildAspectInteractionParagraph("trine", ASPECT_TYPE_COPY.trine, dynamics),
    ).not.toContain("Efforts to");
  });

  it("uses tension wording for squares", () => {
    expect(
      buildAspectInteractionParagraph("square", ASPECT_TYPE_COPY.square, {
        effortFromFirst: "trust your imagination, compassion, and subtle intuition",
        influenceOnSecond: "first impressions, personal style, and social presence",
        effortFromSecond: "show up authentically and refine how you meet the world",
        influenceOnFirst: "creativity, spirituality, and sensitivity to what is unseen",
      }),
    ).toBe(
      "Growth comes through resolving tension between these energies. When you trust your imagination, compassion, and subtle intuition, friction around your first impressions, personal style, and social presence can become a source of growth. Likewise, when you show up authentically and refine how you meet the world, tension around your creativity, spirituality, and sensitivity to what is unseen may sharpen.",
    );
  });
});

describe("buildOppositionParagraphs", () => {
  it("builds procedural conflict copy from body strengths", () => {
    expect(buildOppositionConflictParagraph(mercurySaturnProceduralSlots)).toBe(
      "These energies may sometimes pull you in different directions. At times, your desire to imagine, explore possibilities, and communicate intuitively can seem at odds with your need for precision, discipline, and practical results. Growth comes from recognizing the value of both perspectives.",
    );
  });

  it("builds procedural integration copy from body domains", () => {
    expect(buildOppositionIntegrationParagraph(mercurySaturnProceduralSlots)).toBe(
      "As you develop balance between these energies, your communication can inform your structure, while your structure provides grounding and perspective for your communication. Over time, what first feels like a contradiction can become a source of greater awareness and maturity.",
    );
  });
});
