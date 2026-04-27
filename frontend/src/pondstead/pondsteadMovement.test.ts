import { describe, expect, it } from "vitest";

import { chebyshevMoveActionCost } from "./adjacency";
import { canAffordActionCost, canAffordOneFullAction } from "./pondsteadHudMetrics";
import {
  applyStackDragEnd,
  applyStackSplit,
  classifyStackDragEnd,
  mergeSurvivorStackId,
  PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY,
} from "./pondsteadUnits";
import type { UnitStack } from "./pondsteadUnits";

function stack(
  id: string,
  row: number,
  col: number,
  kind: UnitStack["kind"] = "worker",
): UnitStack {
  return { id, kind, count: 1, row, col, ownerId: 0 };
}

const cell = (row: number, col: number) => ({ row, col });

describe("chebyshevMoveActionCost (diagonal 1.5, orthogonal 1 per step)", () => {
  it("1 orthogonal = 1", () => {
    expect(chebyshevMoveActionCost(cell(0, 0), cell(0, 1))).toBe(1);
  });
  it("1 diagonal = 1.5", () => {
    expect(chebyshevMoveActionCost(cell(0, 0), cell(1, 1))).toBe(1.5);
  });
  it("2 diagonal = 3", () => {
    expect(chebyshevMoveActionCost(cell(0, 0), cell(2, 2))).toBe(3);
  });
  it("3 orth + 1 orth worth of (2,1) delta: one diag + one orth = 2.5", () => {
    expect(chebyshevMoveActionCost(cell(0, 0), cell(2, 1))).toBe(2.5);
  });
});

describe("action affordance", () => {
  it("1-cost actions need at least 1, not 0.5", () => {
    expect(canAffordOneFullAction(1)).toBe(true);
    expect(canAffordOneFullAction(0.5)).toBe(false);
  });
  it("canAffordActionCost uses half-increments", () => {
    expect(canAffordActionCost(1.5, 1.5)).toBe(true);
    expect(canAffordActionCost(1, 1.5)).toBe(false);
  });
});

describe("classifyStackDragEnd (king moves, daily cap)", () => {
  it("allows a diagonal jump up to Chebyshev distance 3 when fresh", () => {
    const stacks = [stack("a", 4, 4)];
    expect(classifyStackDragEnd(stacks, "a", 1, 1, 9, 9, {})).toBe("move");
  });

  it("returns out_of_march when the move exceeds remaining daily squares", () => {
    const stacks = [stack("a", 0, 0)];
    expect(classifyStackDragEnd(stacks, "a", 0, 4, 9, 9, {})).toBe("out_of_march");
  });

  it("returns merge for king-adjacent same kind (8 directions)", () => {
    const stacks: UnitStack[] = [
      { id: "a", kind: "worker", count: 1, row: 0, col: 0, ownerId: 0 },
      { id: "b", kind: "worker", count: 1, row: 1, col: 1, ownerId: 0 },
    ];
    expect(classifyStackDragEnd(stacks, "a", 1, 1, 9, 9, {})).toBe("merge");
  });

  it("treats adjacent same-kind merge as a 1-tile march: out_of_march when the dragged stack cannot pay 1", () => {
    const stacks: UnitStack[] = [
      { id: "a", kind: "worker", count: 1, row: 0, col: 0, ownerId: 0 },
      { id: "b", kind: "worker", count: 1, row: 1, col: 0, ownerId: 0 },
    ];
    const used = { a: PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY };
    expect(classifyStackDragEnd(stacks, "a", 1, 0, 9, 9, used)).toBe("out_of_march");
  });

  it("same-tile same-kind merge is free and ignores march (even if dragged stack is out of march)", () => {
    const stacks: UnitStack[] = [
      { id: "a", kind: "worker", count: 2, row: 0, col: 0, ownerId: 0 },
      { id: "b", kind: "worker", count: 2, row: 0, col: 0, ownerId: 0 },
    ];
    const used = { b: PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY };
    expect(classifyStackDragEnd(stacks, "b", 0, 0, 9, 9, used)).toBe("merge_same_cell");
    const after = applyStackDragEnd(stacks, "b", 0, 0, 9, 9, used);
    expect(after).not.toBeNull();
    const workers = after!.filter((s) => s.kind === "worker" && s.row === 0 && s.col === 0);
    expect(workers).toHaveLength(1);
    expect(workers[0]!.count).toBe(4);
  });

  it("blocks further marching after the daily budget is used", () => {
    const stacks = [stack("a", 0, 0)];
    const used = { a: PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY };
    expect(classifyStackDragEnd(stacks, "a", 0, 1, 9, 9, used)).toBe("out_of_march");
  });
});

describe("applyStackSplit", () => {
  it("adds one new stack; UI should copy parent march used onto the new id (same spent / remaining)", () => {
    const stacks: UnitStack[] = [
      { id: "a", kind: "worker", count: 4, row: 0, col: 0, ownerId: 0 },
    ];
    const beforeIds = new Set(stacks.map((s) => s.id));
    const next = applyStackSplit(stacks, "a", 2);
    expect(next).not.toBeNull();
    const newStack = next!.find((s) => !beforeIds.has(s.id));
    expect(newStack).toBeDefined();
    expect(next!.find((s) => s.id === "a")!.count).toBe(2);
    expect(newStack!.count).toBe(2);
    const parentUsed = 2;
    const prev: Record<string, number> = { a: parentUsed };
    const afterMarch: Record<string, number> = { ...prev, [newStack!.id]: parentUsed };
    expect(afterMarch.a).toBe(2);
    expect(afterMarch[newStack!.id]).toBe(2);
  });
});

describe("mergeSurvivorStackId", () => {
  it("is the destination pile (first same-kind on tile), not the dragged id", () => {
    const stacks: UnitStack[] = [
      { id: "tired", kind: "worker", count: 1, row: 0, col: 0, ownerId: 0 },
      { id: "fresh", kind: "worker", count: 2, row: 1, col: 0, ownerId: 0 },
    ];
    expect(mergeSurvivorStackId(stacks, "tired", 1, 0)).toBe("fresh");
  });
});
