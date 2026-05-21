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

  it("places unlinked uncle one row above self, not with grandparents", () => {
    const people = [
      testPerson("self", { is_self: true, relation_core: "self", bio_mother_id: "mom" }),
      testPerson("mom", { relation_core: "mother" }),
      testPerson("dad", { relation_core: "father" }),
      testPerson("gpa", { relation_core: "grandpa", bio_mother_id: "gma" }),
      testPerson("gma", { relation_core: "grandma" }),
      testPerson("unc", { relation_core: "uncle" }),
    ];
    const ranks = computePersonRanks(people, []);
    expect(ranks.get("self")).toBe(0);
    expect(ranks.get("mom")).toBe(-1);
    expect(ranks.get("unc")).toBe(-1);
    expect(ranks.get("gpa")).toBe(-2);
    expect(ranks.get("gma")).toBe(-2);
  });

  it("hints aunt, cousin, niece, grandpa from relation_core without FK", () => {
    const people = [
      testPerson("self", { is_self: true, relation_core: "self" }),
      testPerson("aunt", { relation_core: "aunt" }),
      testPerson("cousin", { relation_core: "cousin" }),
      testPerson("niece", { relation_core: "niece" }),
      testPerson("gpa", { relation_core: "grandpa" }),
    ];
    const ranks = computePersonRanks(people, []);
    expect(ranks.get("aunt")).toBe(-1);
    expect(ranks.get("cousin")).toBe(0);
    expect(ranks.get("niece")).toBe(1);
    expect(ranks.get("gpa")).toBe(-2);
  });

  it("shifts great-uncle one generation older than uncle", () => {
    const people = [
      testPerson("self", { is_self: true, relation_core: "self" }),
      testPerson("gunc", {
        relation_core: "uncle",
        relation_prefix_tokens: ["great"],
      }),
    ];
    const ranks = computePersonRanks(people, []);
    expect(ranks.get("gunc")).toBe(-2);
  });

  it("keeps mother and father on same rank when uncle shares bio_mother", () => {
    const people = [
      testPerson("self", {
        is_self: true,
        relation_core: "self",
        bio_mother_id: "mom",
        bio_father_id: "dad",
      }),
      testPerson("mom", { relation_core: "mother" }),
      testPerson("dad", { relation_core: "father" }),
      testPerson("unc", { relation_core: "uncle", bio_mother_id: "mom" }),
    ];
    const ranks = computePersonRanks(people, []);
    expect(ranks.get("mom")).toBe(ranks.get("dad"));
    expect(ranks.get("mom")).toBe(-1);
  });

  it("keeps FK-derived mother rank when relation_core also says mother", () => {
    const people = [
      testPerson("self", {
        is_self: true,
        relation_core: "self",
        bio_mother_id: "mom",
        bio_father_id: "dad",
      }),
      testPerson("mom", { relation_core: "mother" }),
      testPerson("dad", { relation_core: "father" }),
    ];
    const ranks = computePersonRanks(people, []);
    expect(ranks.get("mom")).toBe(-1);
    expect(ranks.get("dad")).toBe(-1);
  });

  it("places pet one row below self", () => {
    const people = [
      testPerson("self", { is_self: true, relation_core: "self" }),
      testPerson("dog", { relation_core: "pet" }),
    ];
    const ranks = computePersonRanks(people, []);
    expect(ranks.get("dog")).toBe(1);
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
