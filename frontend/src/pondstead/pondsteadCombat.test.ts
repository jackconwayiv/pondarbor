import { describe, expect, it } from "vitest";

import {
  effectiveDamageFromRoll,
  mergeStacksForCombat,
  removeUnitsFromOwnerOnCell,
  resolveDayStartCombat,
} from "./pondsteadCombat";
import type { ParsedMap } from "./types";
import type { UnitStack } from "./pondsteadUnits";

function tinyMap(ground: "grass" | "marsh"): ParsedMap {
  return {
    width: 1,
    height: 1,
    cells: [
      [
        {
          symbol: ground === "marsh" ? "M" : "G",
          ground,
          resource: "none",
          building: "none",
        },
      ],
    ],
  };
}

describe("mergeStacksForCombat", () => {
  it("merges same owner, cell, and kind", () => {
    const stacks: UnitStack[] = [
      { id: "a", kind: "soldier", count: 1, row: 0, col: 0, ownerId: 0 },
      { id: "b", kind: "soldier", count: 2, row: 0, col: 0, ownerId: 0 },
    ];
    const m = mergeStacksForCombat(stacks);
    expect(m).toHaveLength(1);
    expect(m[0]!.count).toBe(3);
  });
});

describe("effectiveDamageFromRoll", () => {
  it("halves worker-only force damage", () => {
    const stacks: UnitStack[] = [
      { id: "w", kind: "worker", count: 2, row: 0, col: 0, ownerId: 1 },
    ];
    expect(effectiveDamageFromRoll(5, stacks, 0, 0, 1)).toBe(2);
  });

  it("uses full roll when a soldier is present", () => {
    const stacks: UnitStack[] = [
      { id: "w", kind: "worker", count: 1, row: 0, col: 0, ownerId: 1 },
      { id: "s", kind: "soldier", count: 1, row: 0, col: 0, ownerId: 1 },
    ];
    expect(effectiveDamageFromRoll(5, stacks, 0, 0, 1)).toBe(5);
  });
});

describe("removeUnitsFromOwnerOnCell", () => {
  it("removes soldiers before workers", () => {
    const stacks: UnitStack[] = [
      { id: "w", kind: "worker", count: 2, row: 0, col: 0, ownerId: 0 },
      { id: "s", kind: "soldier", count: 1, row: 0, col: 0, ownerId: 0 },
    ];
    const { stacks: next, absorbed } = removeUnitsFromOwnerOnCell(stacks, 0, 0, 0, 2);
    expect(absorbed).toBe(2);
    const soldiers = next.filter((x) => x.kind === "soldier");
    const workers = next.filter((x) => x.kind === "worker");
    expect(soldiers.length).toBe(0);
    expect(workers[0]!.count).toBe(1);
  });
});

describe("resolveDayStartCombat", () => {
  it("resolves 2P with deterministic rng", () => {
    const map = tinyMap("grass");
    const stacks: UnitStack[] = [
      { id: "p0", kind: "soldier", count: 1, row: 0, col: 0, ownerId: 0 },
      { id: "p1", kind: "soldier", count: 1, row: 0, col: 0, ownerId: 1 },
    ];
    const rng = () => 0;
    const out = resolveDayStartCombat(map, stacks, rng);
    expect(out.combatLines.length).toBeGreaterThan(0);
    const totalUnits = out.stacks.reduce((n, s) => n + s.count, 0);
    expect(totalUnits).toBeLessThan(2);
  });

  it("applies marsh −1 to rolls", () => {
    const map = tinyMap("marsh");
    const stacks: UnitStack[] = [
      { id: "p0", kind: "soldier", count: 1, row: 0, col: 0, ownerId: 0 },
      { id: "p1", kind: "soldier", count: 1, row: 0, col: 0, ownerId: 1 },
    ];
    const rng = () => 0.99;
    const out = resolveDayStartCombat(map, stacks, rng);
    expect(out.combatLines.some((l) => l.includes("rolled 0"))).toBe(true);
  });

  it("handles 3+ players on one tile", () => {
    const map = tinyMap("grass");
    const stacks: UnitStack[] = [
      { id: "a", kind: "soldier", count: 1, row: 0, col: 0, ownerId: 0 },
      { id: "b", kind: "soldier", count: 1, row: 0, col: 0, ownerId: 1 },
      { id: "c", kind: "soldier", count: 1, row: 0, col: 0, ownerId: 2 },
    ];
    const rng = () => 0;
    const out = resolveDayStartCombat(map, stacks, rng);
    expect(out.combatLines.some((l) => l.includes("3 players"))).toBe(true);
  });
});
