import { describe, expect, it } from "vitest";

import {
  BLOSSOM_RING_CAPACITIES,
  BLOSSOM_RING_EMOJIS,
  BLOSSOM_RING_MAX,
  BLOSSOM_SLOT_COORDS,
  BLOSSOM_SLOT_FILL_ORDER,
  BLOSSOMS_PER_MILESTONE,
  buildBlossomSlotCoordinates,
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

  it("defines 100 canonical slot coordinates in ring order", () => {
    expect(BLOSSOM_SLOT_COORDS).toHaveLength(100);
    expect(buildBlossomSlotCoordinates()).toEqual(BLOSSOM_SLOT_COORDS);
    expect(BLOSSOM_RING_CAPACITIES.reduce((a, b) => a + b, 0)).toBe(100);
    expect(BLOSSOM_SLOT_COORDS[0]!.ringIndex).toBe(0);
    expect(BLOSSOM_SLOT_COORDS[24]!.ringIndex).toBe(0);
    expect(BLOSSOM_SLOT_COORDS[25]!.ringIndex).toBe(1);
    expect(BLOSSOM_SLOT_COORDS[99]!.ringIndex).toBe(3);
  });

  it("uses a fixed permutation for earn order to slot index", () => {
    expect(BLOSSOM_SLOT_FILL_ORDER).toHaveLength(100);
    expect(new Set(BLOSSOM_SLOT_FILL_ORDER).size).toBe(100);
    for (const slot of BLOSSOM_SLOT_FILL_ORDER) {
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThan(100);
    }
    expect(BLOSSOM_SLOT_FILL_ORDER[0]).toBe(12);
    expect(BLOSSOM_SLOT_FILL_ORDER[1]).toBe(62);
  });

  it("only places earned blossoms up to 100 slots", () => {
    expect(blossomRingPlacements(0)).toEqual([]);
    expect(blossomRingPlacements(3)).toHaveLength(3);
    expect(blossomRingPlacements(100)).toHaveLength(100);
    expect(blossomRingPlacements(150)).toHaveLength(BLOSSOM_RING_MAX);
  });

  it("is deterministic and maps earn index to shuffled slot coordinates", () => {
    const a = blossomRingPlacements(5);
    const b = blossomRingPlacements(5);
    expect(a).toEqual(b);
    for (let i = 0; i < 5; i++) {
      const slot = BLOSSOM_SLOT_FILL_ORDER[i]!;
      const coord = BLOSSOM_SLOT_COORDS[slot]!;
      expect(a[i]!.left).toBe(coord.left);
      expect(a[i]!.top).toBe(coord.top);
      expect(a[i]!.ringIndex).toBe(coord.ringIndex);
      expect(a[i]!.emoji).toBe(blossomEmojiAt(i));
    }
  });

  it("scatters early blossoms across rings instead of filling inner ring first", () => {
    const few = blossomRingPlacements(3);
    const ringIndices = few.map((p) => p.ringIndex);
    expect(new Set(ringIndices).size).toBeGreaterThan(1);
    expect(few[0]!.ringIndex).toBe(BLOSSOM_SLOT_COORDS[12]!.ringIndex);
  });

  it("inner ring slots sit closer to center than outer ring slots", () => {
    const innerR = Math.hypot(
      BLOSSOM_SLOT_COORDS[0]!.left - 50,
      BLOSSOM_SLOT_COORDS[0]!.top - 50,
    );
    const outerR = Math.hypot(
      BLOSSOM_SLOT_COORDS[99]!.left - 50,
      BLOSSOM_SLOT_COORDS[99]!.top - 50,
    );
    expect(outerR).toBeGreaterThan(innerR);
  });

  it("uses a taller vertical axis than horizontal on the inner ring", () => {
    const innerSlots = BLOSSOM_SLOT_COORDS.slice(0, 25);
    const maxDx = Math.max(...innerSlots.map((p) => Math.abs(p.left - 50)));
    const maxDy = Math.max(...innerSlots.map((p) => Math.abs(p.top - 50)));
    expect(maxDy).toBeGreaterThan(maxDx);
  });
});
