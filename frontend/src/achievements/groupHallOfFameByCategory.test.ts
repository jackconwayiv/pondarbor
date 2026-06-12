import { describe, expect, it } from "vitest";
import {
  groupHallOfFameEarnedByCategory,
  groupHallOfFameLockedByCategory,
} from "./groupHallOfFameByCategory";
import type { HallOfFameRow } from "./types";

function row(
  slug: string,
  opts: Partial<HallOfFameRow> & { category?: string } = {},
): HallOfFameRow {
  const isEarned = opts.is_earned ?? true;
  return {
    slug,
    title: slug,
    description: isEarned ? "desc" : "",
    category: opts.category ?? "goals",
    display_group: "",
    display_group_order: 0,
    catalog_order: opts.catalog_order ?? 10,
    is_earned: isEarned,
    earner_count: isEarned ? (opts.earner_count ?? 1) : 0,
    earners:
      opts.earners ??
      (isEarned
        ? [{ id: 1, nickname: "me", avatar_url: "", unlocked_at: "" }]
        : []),
    ...opts,
  };
}

describe("groupHallOfFameEarnedByCategory", () => {
  it("only includes earned rows per category", () => {
    const groups = groupHallOfFameEarnedByCategory(
      [
        row("locked_goal", { is_earned: false, category: "goals", catalog_order: 20 }),
        row("solo_viewer", { category: "goals", catalog_order: 10 }),
      ],
      1,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.earnedRows.map((r) => r.slug)).toEqual(["solo_viewer"]);
    expect(groups[0]?.lockedRows).toEqual([]);
  });
});

describe("groupHallOfFameLockedByCategory", () => {
  it("only includes locked rows per category", () => {
    const groups = groupHallOfFameLockedByCategory(
      [
        row("locked_goal", { is_earned: false, category: "goals", catalog_order: 20 }),
        row("solo_viewer", { category: "goals", catalog_order: 10 }),
      ],
      1,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.lockedRows.map((r) => r.slug)).toEqual(["locked_goal"]);
    expect(groups[0]?.earnedRows).toEqual([]);
  });
});
