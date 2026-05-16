import { describe, expect, it } from "vitest";

import { computeTreeEdges } from "./peopleTreeEdges";
import { parentIdsWithChildInNextRank } from "./peopleTreeGuides";
import type { PeopleGraphBundle } from "./types";
import { testPerson } from "./testPerson";

describe("peopleTreeGuides", () => {
  it("only marks parents with a child in the next rank", () => {
    const bundle: PeopleGraphBundle = {
      count: 4,
      people: [
        testPerson("bro", { relation_core: "brother" }),
        testPerson("mom", { relation_core: "mother" }),
        testPerson("self", { is_self: true, bio_mother_id: "mom" }),
      ],
      partnerships: [],
      guardian_links: [],
    };
    const edges = computeTreeEdges(bundle);
    const ranksOrdered = [["mom"], ["self", "bro"]];
    const stubDown = parentIdsWithChildInNextRank(edges, ranksOrdered);
    expect(stubDown.has("mom")).toBe(true);
    expect(stubDown.has("bro")).toBe(false);
  });
});
