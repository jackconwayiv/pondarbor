import { describe, expect, it } from "vitest";

import { computeTreeEdges } from "./peopleTreeEdges";
import { computePetLeashLinks } from "./petLinks";
import type { PeopleGraphBundle } from "./types";
import { testPerson } from "./testPerson";

describe("petLinks", () => {
  it("links pets to self as owner", () => {
    const people = [
      testPerson("self", { is_self: true, relation_core: "self" }),
      testPerson("dog", { relation_core: "pet", name: "Rex" }),
    ];
    expect(computePetLeashLinks(people)).toEqual([{ ownerId: "self", petId: "dog" }]);
  });

  it("emits petLeash tree edge", () => {
    const bundle: PeopleGraphBundle = {
      count: 2,
      people: [
        testPerson("self", { is_self: true, relation_core: "self" }),
        testPerson("dog", { relation_core: "pet" }),
      ],
      partnerships: [],
      guardian_links: [],
    };
    const edges = computeTreeEdges(bundle);
    expect(edges).toContainEqual({ kind: "petLeash", ownerId: "self", petId: "dog" });
  });
});
