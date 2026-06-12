import { describe, expect, it } from "vitest";

import { getDenizenDef } from "./denizens";
import { DENIZENS } from "./denizens";
import {
  DENIZEN_DEPTH_ORDER,
  depthZoneBackground,
  depthZoneForDenizen,
  depthZoneLabelOnDark,
  partitionTimelineByDenizen,
  POND_DEPTH_CHART_MAX_VISIBLE_GLYPHS,
  POND_DEPTH_CHART_WRAP,
  POND_DEPTH_ZONE_COLORS,
  wrapEmojiGlyphEntries,
} from "./pondDepthChartModel";

describe("pondDepthChart", () => {
  it("returns no rows for an empty timeline", () => {
    expect(partitionTimelineByDenizen([])).toEqual([]);
  });

  it("groups a single denizen type", () => {
    const ripples = getDenizenDef("ripples")!;
    expect(partitionTimelineByDenizen(["🌊", "🌊"])).toEqual([
      {
        def: ripples,
        count: 2,
        glyphsJoined: "🌊🌊",
        glyphLines: ["🌊🌊"],
        zoneIndex: 2,
      },
    ]);
  });

  it("preserves per-type purchase order oldest to newest left to right", () => {
    const ripples = getDenizenDef("ripples")!;
    const sediment = getDenizenDef("sediment")!;
    // Timeline newest-first: sediment, ripple, sediment, ripple
    const rows = partitionTimelineByDenizen(["🪨", "🌊", "🪨", "🌊"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      def: ripples,
      count: 2,
      glyphsJoined: "🌊🌊",
    });
    expect(rows[1]).toMatchObject({
      def: sediment,
      count: 2,
      glyphsJoined: "🪨🪨",
    });
  });

  it("returns rows in depth order with transcendence on top and sediment on bottom", () => {
    const rows = partitionTimelineByDenizen(["🪨", "🌊", "♾️"]);
    expect(rows.map((r) => r.def.id)).toEqual([
      "transcendence",
      "ripples",
      "sediment",
    ]);
    expect(DENIZEN_DEPTH_ORDER[0]).toBe("transcendence");
    expect(DENIZEN_DEPTH_ORDER.at(-1)).toBe("sediment");
    const leviIdx = DENIZEN_DEPTH_ORDER.indexOf("leviathans");
    const abyssIdx = DENIZEN_DEPTH_ORDER.indexOf("abyssals");
    expect(leviIdx).toBeGreaterThan(-1);
    expect(abyssIdx).toBe(leviIdx + 1);
  });

  it("wraps glyphs every 30 emojis", () => {
    const ripples = getDenizenDef("ripples")!;
    const entries = Array.from({ length: 31 }, () => "🌊");
    expect(wrapEmojiGlyphEntries(entries)).toEqual([
      Array.from({ length: POND_DEPTH_CHART_WRAP }, () => "🌊").join(""),
      "🌊",
    ]);
    const rows = partitionTimelineByDenizen(entries);
    expect(rows[0]?.glyphLines).toHaveLength(2);
    expect(rows[0]?.def).toBe(ripples);
  });

  it("does not split multi-codepoint emojis when wrapping", () => {
    const human = getDenizenDef("humans")!.emoji;
    const entries = Array.from({ length: 31 }, () => human);
    const lines = wrapEmojiGlyphEntries(entries);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(Array.from({ length: 30 }, () => human).join(""));
    expect(lines[1]).toBe(human);

    const rows = partitionTimelineByDenizen(entries);
    expect(rows[0]?.def.id).toBe("humans");
    expect(rows[0]?.glyphLines).toEqual(lines);
  });

  it("lists every denizen id exactly once in depth order", () => {
    expect(DENIZEN_DEPTH_ORDER).toHaveLength(DENIZENS.length);
    expect(new Set(DENIZEN_DEPTH_ORDER).size).toBe(DENIZENS.length);
  });

  it("orders margin and shore life above purely aquatic fish", () => {
    const amphibians = DENIZEN_DEPTH_ORDER.indexOf("amphibians");
    const reptiles = DENIZEN_DEPTH_ORDER.indexOf("reptiles");
    const darters = DENIZEN_DEPTH_ORDER.indexOf("small_swimmers");
    const largeFish = DENIZEN_DEPTH_ORDER.indexOf("large_fish");
    expect(amphibians).toBeLessThan(darters);
    expect(reptiles).toBeLessThan(darters);
    expect(darters).toBeLessThan(largeFish);
  });

  it("keeps decomposers and sediment at the floor below open-water hunters", () => {
    const largeFish = DENIZEN_DEPTH_ORDER.indexOf("large_fish");
    const invertebrates = DENIZEN_DEPTH_ORDER.indexOf("invertebrates");
    const leviathans = DENIZEN_DEPTH_ORDER.indexOf("leviathans");
    const sediment = DENIZEN_DEPTH_ORDER.indexOf("sediment");
    expect(largeFish).toBeLessThan(invertebrates);
    expect(invertebrates).toBeLessThan(leviathans);
    expect(leviathans).toBeLessThan(sediment);
  });

  it("ignores unknown emojis", () => {
    const ripples = getDenizenDef("ripples")!;
    expect(partitionTimelineByDenizen(["🌊", "❓"])).toEqual([
      {
        def: ripples,
        count: 1,
        glyphsJoined: "🌊",
        glyphLines: ["🌊"],
        zoneIndex: 2,
      },
    ]);
  });

  it("materializes only the visible glyph window for large purchase counts", () => {
    const ripples = getDenizenDef("ripples")!;
    const timeline = Array.from({ length: 80 }, () => "🌊");
    const rows = partitionTimelineByDenizen(timeline);
    expect(rows[0]?.count).toBe(80);
    expect(rows[0]?.glyphsJoined).toBe(
      Array.from({ length: POND_DEPTH_CHART_MAX_VISIBLE_GLYPHS }, () => "🌊").join(
        "",
      ),
    );
    expect(rows[0]?.glyphLines).toHaveLength(2);
    expect(rows[0]?.def).toBe(ripples);
  });

  it("uses six fixed zone colors top to bottom", () => {
    expect(POND_DEPTH_ZONE_COLORS).toEqual([
      "#EBF2F7",
      "#D2E3F0",
      "#A9CCE0",
      "#6FAA8F",
      "#456B82",
      "#887560",
    ]);
    expect(depthZoneBackground(0)).toBe("#EBF2F7");
    expect(depthZoneBackground(5)).toBe("#887560");
    expect(depthZoneForDenizen("sediment")).toBe(5);
    expect(depthZoneForDenizen("transcendence")).toBe(0);
    expect(depthZoneForDenizen("ripples")).toBe(2);
    expect(depthZoneLabelOnDark(0)).toBe(false);
    expect(depthZoneLabelOnDark(4)).toBe(true);
  });
});
