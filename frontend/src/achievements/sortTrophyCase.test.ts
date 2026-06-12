import { describe, expect, it } from "vitest";
import { hallOfFameCountLabel, sortHallOfFameRows } from "./sortTrophyCase";
import type { HallOfFameRow } from "./types";

function row(
  slug: string,
  earnerIds: number[],
  earnerCount = earnerIds.length,
): HallOfFameRow {
  return {
    slug,
    title: slug,
    description: "",
    category: "",
    display_group: "",
    display_group_order: 0,
    catalog_order: 0,
    is_earned: true,
    earner_count: earnerCount,
    earners: earnerIds.map((id) => ({
      id,
      nickname: `u${id}`,
      avatar_url: "",
      unlocked_at: "2024-01-01T00:00:00Z",
    })),
  };
}

describe("sortHallOfFameRows", () => {
  it("orders solo viewer, solo other, then by count", () => {
    const sorted = sortHallOfFameRows(
      [
        row("common", [1, 2, 3], 3),
        row("pair", [1, 2], 2),
        row("solo_friend", [2]),
        row("solo_viewer", [1]),
      ],
      1,
    );
    expect(sorted.map((r) => r.slug)).toEqual([
      "solo_viewer",
      "solo_friend",
      "pair",
      "common",
    ]);
  });
});

describe("hallOfFameCountLabel", () => {
  it("labels solo viewer", () => {
    expect(hallOfFameCountLabel(row("solo", [1]), 1)).toBe("Only you");
  });

  it("labels plural counts", () => {
    expect(hallOfFameCountLabel(row("x", [1, 2], 2), 1)).toBe("2 people");
  });
});
