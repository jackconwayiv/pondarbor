import { describe, expect, it } from "vitest";

import { chebyshevMoveActionCost, kingMarchStepCost } from "./adjacency";
import {
  applyStackDragEnd,
  applyStackSplit,
  classifyStackDragEnd,
  marchAdjacentStepCostOrNull,
  mergeSurvivorStackId,
  PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY,
  stackCanStartAdjacentMarchToday,
} from "./pondsteadUnits";
import type { UnitStack } from "./pondsteadUnits";
import type { MapCell, ParsedMap } from "./types";

function stack(
  id: string,
  row: number,
  col: number,
  kind: UnitStack["kind"] = "worker",
): UnitStack {
  return { id, kind, count: 1, row, col, ownerId: 0 };
}

const cell = (row: number, col: number) => ({ row, col });

function grassMap(w: number, h: number): ParsedMap {
  const cells: MapCell[][] = [];
  for (let r = 0; r < h; r++) {
    const row: MapCell[] = [];
    for (let c = 0; c < w; c++) {
      row.push({ symbol: ".", ground: "grass", resource: "none", building: "none" });
    }
    cells.push(row);
  }
  return { width: w, height: h, cells };
}

function revealAll(w: number, h: number): Set<string> {
  const s = new Set<string>();
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      s.add(`${r}-${c}`);
    }
  }
  return s;
}

function revealAllExcept(w: number, h: number, exceptKey: string): Set<string> {
  const s = revealAll(w, h);
  s.delete(exceptKey);
  return s;
}

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

describe("kingMarchStepCost (one king step + water)", () => {
  it("orthogonal grass = 1", () => {
    expect(kingMarchStepCost(cell(1, 1), cell(1, 2), "grass")).toBe(1);
  });
  it("diagonal grass = 1.5", () => {
    expect(kingMarchStepCost(cell(1, 1), cell(2, 2), "grass")).toBe(1.5);
  });
  it("orthogonal into water +1", () => {
    expect(kingMarchStepCost(cell(1, 1), cell(1, 2), "water")).toBe(2);
  });
  it("orthogonal into marsh +0.5", () => {
    expect(kingMarchStepCost(cell(1, 1), cell(1, 2), "marsh")).toBe(1.5);
  });
});

describe("stackCanStartAdjacentMarchToday", () => {
  const cap = PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY;

  it("is false when less than one full move point remains", () => {
    expect(stackCanStartAdjacentMarchToday({ a: cap - 0.5 }, "a", cap)).toBe(false);
  });

  it("is true when at least one full move point remains", () => {
    expect(stackCanStartAdjacentMarchToday({ a: cap - 1 }, "a", cap)).toBe(true);
  });
});

describe("marchAdjacentStepCostOrNull (fog, walls, terrain)", () => {
  const r9 = () => revealAll(9, 9);

  it("returns null when destination is not revealed", () => {
    const m = grassMap(9, 9);
    const revealed = revealAllExcept(9, 9, "0-1");
    expect(marchAdjacentStepCostOrNull(m, 0, 0, 0, 1, revealed, 0)).toBeNull();
  });

  it("returns null for adjacent enemy wall", () => {
    const m = grassMap(9, 9);
    m.cells[0]![1] = { ...m.cells[0]![1]!, building: "wall", buildingOwnerId: 99 };
    expect(marchAdjacentStepCostOrNull(m, 0, 0, 0, 1, r9(), 0)).toBeNull();
  });

  it("allows own wall at orthogonal cost", () => {
    const m = grassMap(9, 9);
    m.cells[0]![1] = { ...m.cells[0]![1]!, building: "wall", buildingOwnerId: 0 };
    expect(marchAdjacentStepCostOrNull(m, 0, 0, 0, 1, r9(), 0)).toBe(1);
  });

  it("adds marsh surcharge on top of base step", () => {
    const m = grassMap(9, 9);
    m.cells[0]![1] = { ...m.cells[0]![1]!, ground: "marsh" };
    expect(marchAdjacentStepCostOrNull(m, 0, 0, 0, 1, r9(), 0)).toBe(1.5);
  });
});

describe("classifyStackDragEnd (adjacent only, march points)", () => {
  const m9 = grassMap(9, 9);
  const r9 = revealAll(9, 9);

  it("allows a single diagonal step when fresh", () => {
    const stacks = [stack("a", 4, 4)];
    expect(classifyStackDragEnd(stacks, "a", 3, 3, m9, r9, {}, PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY)).toBe("move");
  });

  it("returns invalid for non-adjacent destination", () => {
    const stacks = [stack("a", 0, 0)];
    expect(classifyStackDragEnd(stacks, "a", 0, 4, m9, r9, {}, PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY)).toBe("invalid");
  });

  it("returns invalid when adjacent tile is fogged", () => {
    const stacks = [stack("a", 0, 0)];
    const revealed = revealAllExcept(9, 9, "0-1");
    expect(classifyStackDragEnd(stacks, "a", 0, 1, m9, revealed, {}, PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY)).toBe(
      "invalid",
    );
  });

  it("returns invalid when adjacent tile has enemy wall", () => {
    const m = grassMap(9, 9);
    m.cells[0]![1] = { ...m.cells[0]![1]!, building: "wall", buildingOwnerId: 99 };
    const stacks = [stack("a", 0, 0)];
    expect(classifyStackDragEnd(stacks, "a", 0, 1, m, r9, {}, PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY)).toBe("invalid");
  });

  it("returns merge for king-adjacent same kind (8 directions)", () => {
    const stacks: UnitStack[] = [
      { id: "a", kind: "worker", count: 1, row: 0, col: 0, ownerId: 0 },
      { id: "b", kind: "worker", count: 1, row: 1, col: 1, ownerId: 0 },
    ];
    expect(classifyStackDragEnd(stacks, "a", 1, 1, m9, r9, {}, PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY)).toBe("merge");
  });

  it("treats adjacent same-kind merge as paying diagonal march cost when diagonal", () => {
    const stacks: UnitStack[] = [
      { id: "a", kind: "worker", count: 1, row: 0, col: 0, ownerId: 0 },
      { id: "b", kind: "worker", count: 1, row: 1, col: 1, ownerId: 0 },
    ];
    const used = { a: PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY - 1 }; // 1 point left; merge needs 1.5
    expect(classifyStackDragEnd(stacks, "a", 1, 1, m9, r9, used, PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY)).toBe(
      "out_of_march",
    );
  });

  it("same-tile same-kind merge is free and ignores march (even if dragged stack is out of march)", () => {
    const stacks: UnitStack[] = [
      { id: "a", kind: "worker", count: 2, row: 0, col: 0, ownerId: 0 },
      { id: "b", kind: "worker", count: 2, row: 0, col: 0, ownerId: 0 },
    ];
    const used = { b: PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY };
    expect(classifyStackDragEnd(stacks, "b", 0, 0, m9, r9, used, PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY)).toBe(
      "merge_same_cell",
    );
    const after = applyStackDragEnd(stacks, "b", 0, 0, m9, r9, used, PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY);
    expect(after).not.toBeNull();
    const workers = after!.filter((s) => s.kind === "worker" && s.row === 0 && s.col === 0);
    expect(workers).toHaveLength(1);
    expect(workers[0]!.count).toBe(4);
  });

  it("blocks adjacent orth move when march budget is exhausted", () => {
    const stacks = [stack("a", 0, 0)];
    const used = { a: PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY };
    expect(classifyStackDragEnd(stacks, "a", 0, 1, m9, r9, used, PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY)).toBe(
      "out_of_march",
    );
  });

  it("blocks any adjacent tile step when less than 1 move point remains (e.g. 0.5 left)", () => {
    const stacks = [stack("a", 0, 0)];
    const used = { a: PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY - 0.5 };
    expect(classifyStackDragEnd(stacks, "a", 0, 1, m9, r9, used, PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY)).toBe(
      "out_of_march",
    );
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
  it("returns the surviving stack id on destination", () => {
    const stacks: UnitStack[] = [
      { id: "a", kind: "worker", count: 1, row: 0, col: 0, ownerId: 0 },
      { id: "b", kind: "worker", count: 2, row: 1, col: 0, ownerId: 0 },
    ];
    expect(mergeSurvivorStackId(stacks, "a", 1, 0)).toBe("b");
  });
});
