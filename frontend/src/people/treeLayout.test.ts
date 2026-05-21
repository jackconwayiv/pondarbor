import { describe, expect, it } from "vitest";

import {
  cellOccupant,
  ensureGridPadding,
  expandGridOnPlacement,
  seedLayoutFromPeople,
  swapPeopleInLayout,
  trimGridAroundOccupied,
} from "./treeLayout";
import type { PeoplePerson, PeopleTreeLayout } from "./types";

function person(id: string, overrides: Partial<PeoplePerson> = {}): PeoplePerson {
  return {
    id,
    name: id,
    image_key: "",
    image_url: "",
    relation_prefix_tokens: [],
    relation_core: "brother",
    relation_suffix_tokens: [],
    relation_alias: "",
    birthday: null,
    death_date: null,
    gender: null,
    is_self: false,
    bio_mother_id: null,
    bio_father_id: null,
    step_mother_id: null,
    step_father_id: null,
    partnerships: [],
    guardian_links: [],
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("treeLayout", () => {
  it("ensureGridPadding adds 2 cells beyond furthest occupant", () => {
    const layout: PeopleTreeLayout = {
      positions: { a: { col: 0, row: 0 }, b: { col: 4, row: -2 } },
      min_col: 0,
      min_row: 0,
      max_col: 4,
      max_row: 0,
    };
    const padded = ensureGridPadding(layout, 2);
    expect(padded.min_col).toBe(-2);
    expect(padded.min_row).toBe(-4);
    expect(padded.max_col).toBe(6);
    expect(padded.max_row).toBe(2);
  });

  it("trimGridAroundOccupied shrinks bloated bounds to occupied + 2", () => {
    const layout: PeopleTreeLayout = {
      positions: { a: { col: 0, row: 0 }, b: { col: 4, row: -2 } },
      min_col: -20,
      min_row: -20,
      max_col: 20,
      max_row: 20,
    };
    const trimmed = trimGridAroundOccupied(layout, 2);
    expect(trimmed.min_col).toBe(-2);
    expect(trimmed.min_row).toBe(-4);
    expect(trimmed.max_col).toBe(6);
    expect(trimmed.max_row).toBe(2);
  });

  it("swapPeopleInLayout exchanges two people and trims grid", () => {
    const layout: PeopleTreeLayout = {
      positions: {
        self: { col: 0, row: 0 },
        a: { col: 2, row: 0 },
        b: { col: 4, row: 0 },
      },
      min_col: -2,
      min_row: -2,
      max_col: 6,
      max_row: 2,
    };
    const people = [
      person("self", { is_self: true, relation_core: "self" }),
      person("a"),
      person("b"),
    ];
    const next = swapPeopleInLayout(layout, "a", 4, 0, people);
    expect(next).not.toBeNull();
    expect(next!.positions.a).toEqual({ col: 4, row: 0 });
    expect(next!.positions.b).toEqual({ col: 2, row: 0 });
    expect(next!.min_col).toBe(-2);
    expect(next!.max_col).toBe(6);
    expect(next!.min_row).toBe(-2);
    expect(next!.max_row).toBe(2);
  });

  it("swapPeopleInLayout rejects dragging self", () => {
    const layout: PeopleTreeLayout = {
      positions: { self: { col: 0, row: 0 }, a: { col: 2, row: 0 } },
      min_col: -2,
      min_row: -2,
      max_col: 4,
      max_row: 2,
    };
    const people = [
      person("self", { is_self: true, relation_core: "self" }),
      person("a"),
    ];
    expect(swapPeopleInLayout(layout, "self", 2, 0, people)).toBeNull();
  });

  it("seedLayoutFromPeople places self at origin row", () => {
    const people = [
      person("self", { is_self: true, relation_core: "self", name: "Me" }),
      person("mom", { relation_core: "mother" }),
    ];
    const layout = seedLayoutFromPeople(people, []);
    expect(layout.positions.self).toEqual({ col: 0, row: 0 });
    expect(layout.positions.mom).toBeDefined();
    expect(layout.positions.mom!.row).toBeLessThan(0);
  });

  it("seedLayoutFromPeople places partners on adjacent columns", () => {
    const people = [
      person("self", { is_self: true, relation_core: "self", gender: "male" }),
      person("spouse", { relation_core: "wife", gender: "female" }),
    ];
    const partnerships = [
      {
        id: "p1",
        person_a_id: "self",
        person_b_id: "spouse",
        status: "current" as const,
        anniversary_date: null,
      },
    ];
    const layout = seedLayoutFromPeople(people, partnerships);
    expect(layout.positions.self).toEqual({ col: 0, row: 0 });
    expect(layout.positions.spouse).toEqual({ col: 1, row: 0 });
  });

  it("expandGridOnPlacement grows max_col when dropping on right edge", () => {
    const layout: PeopleTreeLayout = {
      positions: { a: { col: 4, row: 0 } },
      min_col: 0,
      min_row: 0,
      max_col: 4,
      max_row: 0,
    };
    const expanded = expandGridOnPlacement(layout, 4, 0);
    expect(expanded.max_col).toBeGreaterThanOrEqual(6);
  });

  it("cellOccupant finds person at coordinates", () => {
    const layout: PeopleTreeLayout = {
      positions: { x: { col: 1, row: 2 } },
      min_col: 0,
      min_row: 0,
      max_col: 3,
      max_row: 3,
    };
    expect(cellOccupant(layout, 1, 2)).toBe("x");
    expect(cellOccupant(layout, 0, 0)).toBeNull();
  });
});
