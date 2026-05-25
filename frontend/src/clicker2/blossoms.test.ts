import { describe, expect, it } from "vitest";

import {
  BLOSSOM_RING_CAPACITIES,
  BLOSSOM_RING_EMOJIS,
  BLOSSOM_RING_MAX,
  BLOSSOMS_PER_MILESTONE,
  blossomCountFromMilestoneTotal,
  blossomEmojiAt,
  blossomRingGlyphs,
  blossomRingJoined,
  blossomRingPlacements,
} from "./blossoms";

describe("blossoms", () => {
  it("counts one blossom per five milestones reached", () => {
    expect(blossomCountFromMilestoneTotal(12)).toBe(2);
    expect(blossomCountFromMilestoneTotal(4)).toBe(0);
    expect(BLOSSOMS_PER_MILESTONE).toBe(5);
  });

  it("cycles ring emojis and joins compactly", () => {
    expect(blossomEmojiAt(0)).toBe("🪷");
    expect(blossomEmojiAt(8)).toBe("🏵️");
    expect(blossomEmojiAt(9)).toBe("🪷");
    expect(blossomRingGlyphs(3)).toEqual(["🪷", "🌺", "🌼"]);
    expect(blossomRingJoined(3)).toBe("🪷🌺🌼");
    expect(BLOSSOM_RING_EMOJIS.length).toBe(9);
  });

  it("only places earned blossoms up to 100 slots", () => {
    expect(blossomRingPlacements(0)).toEqual([]);
    expect(blossomRingPlacements(3)).toHaveLength(3);
    expect(blossomRingPlacements(26)).toHaveLength(26);
    expect(blossomRingPlacements(100)).toHaveLength(100);
    expect(blossomRingPlacements(150)).toHaveLength(BLOSSOM_RING_MAX);
    expect(BLOSSOM_RING_CAPACITIES.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("spaces few blossoms on the inner ring and adds outer rings when full", () => {
    const few = blossomRingPlacements(3);
    expect(few.every((p) => p.ringIndex === 0)).toBe(true);

    const ring0Full = blossomRingPlacements(25);
    expect(ring0Full.every((p) => p.ringIndex === 0)).toBe(true);

    const spill = blossomRingPlacements(26);
    expect(spill.filter((p) => p.ringIndex === 0)).toHaveLength(25);
    expect(spill.filter((p) => p.ringIndex === 1)).toHaveLength(1);
    expect(spill[25]!.ringIndex).toBe(1);
  });

  it("places inner ring closer to center than outer ring", () => {
    const fullInner = blossomRingPlacements(25);
    const withOuter = blossomRingPlacements(26);
    const innerR = Math.hypot(
      fullInner[0]!.left - 50,
      fullInner[0]!.top - 50,
    );
    const outerR = Math.hypot(
      withOuter[25]!.left - 50,
      withOuter[25]!.top - 50,
    );
    expect(outerR).toBeGreaterThan(innerR);
  });

  it("uses a taller vertical axis than horizontal on the same ring", () => {
    const ring = blossomRingPlacements(25);
    const maxDx = Math.max(...ring.map((p) => Math.abs(p.left - 50)));
    const maxDy = Math.max(...ring.map((p) => Math.abs(p.top - 50)));
    expect(maxDy).toBeGreaterThan(maxDx);
  });
});
