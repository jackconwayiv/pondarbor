import { describe, expect, it } from "vitest";

import { computeTreeEdges } from "./peopleTreeEdges";
import type { PeopleGraphBundle } from "./types";
import { testPerson } from "./testPerson";

describe("computeTreeEdges", () => {
  it("emits parent, partner, and guardian edges", () => {
    const bundle: PeopleGraphBundle = {
      count: 4,
      people: [
        testPerson("mom", { relation_core: "mother" }),
        testPerson("kid", { bio_mother_id: "mom" }),
        testPerson("a"),
        testPerson("b"),
      ],
      partnerships: [
        {
          id: "p1",
          person_a_id: "a",
          person_b_id: "b",
          status: "current",
          anniversary_date: null,
        },
      ],
      guardian_links: [{ id: "g1", child_id: "kid", guardian_id: "a", note: "" }],
    };
    const edges = computeTreeEdges(bundle);
    expect(edges).toContainEqual({ kind: "parent", parentId: "mom", childId: "kid" });
    expect(edges).toContainEqual({
      kind: "partner",
      aId: "a",
      bId: "b",
      former: false,
    });
    expect(edges).toContainEqual({
      kind: "guardian",
      guardianId: "a",
      childId: "kid",
    });
  });

  it("emits dashed step-parent edges from fields", () => {
    const bundle: PeopleGraphBundle = {
      count: 3,
      people: [
        testPerson("kid", { step_father_id: "sf" }),
        testPerson("sf", { relation_core: "father" }),
        testPerson("self", { is_self: true }),
      ],
      partnerships: [],
      guardian_links: [],
    };
    const edges = computeTreeEdges(bundle);
    expect(edges).toContainEqual({
      kind: "stepParent",
      parentId: "sf",
      childId: "kid",
    });
  });

  it("dedupes twin parent links to the same child", () => {
    const bundle: PeopleGraphBundle = {
      count: 3,
      people: [
        testPerson("mom", { relation_core: "mother" }),
        testPerson("dad", { relation_core: "father" }),
        testPerson("kid", { bio_mother_id: "mom", bio_father_id: "dad" }),
      ],
      partnerships: [],
      guardian_links: [],
    };
    const edges = computeTreeEdges(bundle);
    const parentEdges = edges.filter((e) => e.kind === "parent");
    expect(parentEdges).toHaveLength(2);
  });
});
