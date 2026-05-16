import { describe, expect, it } from "vitest";

import { buildTreeRows, computePersonRanks, groupPeopleByRank, isTreeFriend } from "./rankPeople";
import { testPerson } from "./testPerson";

describe("computePersonRanks", () => {
  it("keeps siblings on the same row as self", () => {
    const people = [
      testPerson("self", { is_self: true, relation_core: "self", bio_mother_id: "mom" }),
      testPerson("bro", {
        relation_core: "brother",
        bio_mother_id: "mom",
        bio_father_id: "dad",
      }),
      testPerson("mom", { relation_core: "mother" }),
      testPerson("dad", { relation_core: "father" }),
    ];
    const ranks = computePersonRanks(people, []);
    expect(ranks.get("self")).toBe(ranks.get("bro"));
    const partnerships = [
      {
        id: "p1",
        person_a_id: "bro",
        person_b_id: "spouse",
        status: "current" as const,
        anniversary_date: null,
      },
    ];
    const peopleWithSpouse = [
      ...people,
      {
        ...testPerson("spouse", { name: "Alex", relation_core: "partner", gender: "male" }),
      },
    ];
    const ranks2 = computePersonRanks(peopleWithSpouse, partnerships);
    const rows = groupPeopleByRank(peopleWithSpouse, ranks2, partnerships);
    const selfRow = rows.get(ranks2.get("self")!)!.map((p) => p.id);
    expect(selfRow).toContain("bro");
    const broIdx = selfRow.indexOf("bro");
    const spouseIdx = selfRow.indexOf("spouse");
    expect(spouseIdx).toBe(broIdx - 1);
  });

  it("aligns brother label to self even without bio links on sibling", () => {
    const people = [
      testPerson("self", { is_self: true, relation_core: "self" }),
      testPerson("bro", { relation_core: "brother" }),
    ];
    const ranks = computePersonRanks(people, []);
    expect(ranks.get("self")).toBe(ranks.get("bro"));
  });
});

describe("buildTreeRows", () => {
  it("puts relation_core friend in friendRow, not family ranks", () => {
    const people = [
      testPerson("self", { is_self: true, relation_core: "self" }),
      testPerson("mom", { relation_core: "mother" }),
      testPerson("pal", { relation_core: "friend" }),
    ];
    expect(isTreeFriend(people[2]!)).toBe(true);
    const { rowsByRank, friendRow } = buildTreeRows(people, []);
    const familyIds = rowsByRank.flatMap((r) => r.people.map((p) => p.id));
    expect(familyIds).toContain("self");
    expect(familyIds).toContain("mom");
    expect(familyIds).not.toContain("pal");
    expect(friendRow.map((p) => p.id)).toEqual(["pal"]);
  });
});
