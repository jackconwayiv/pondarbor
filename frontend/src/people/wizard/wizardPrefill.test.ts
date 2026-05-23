import { describe, expect, it } from "vitest";

import { testPerson } from "../testPerson";
import {
  buildWizardPrefill,
  hasAnySiblings,
  hasNiecesWizardPage,
  wizardDisplayBucketIds,
} from "./wizardPrefill";
import { firstIncompleteWizardPage } from "./wizardResume";
import type { PeopleGraphBundle } from "../types";

function bundle(people: ReturnType<typeof testPerson>[]): PeopleGraphBundle {
  return { count: people.length, people, partnerships: [], guardian_links: [] };
}

describe("buildWizardPrefill", () => {
  it("fills parent slots from self bio links", () => {
    const mom = testPerson("mom", { relation_core: "mother" });
    const self = testPerson("self", {
      is_self: true,
      relation_core: "self",
      bio_mother_id: "mom",
    });
    const prefill = buildWizardPrefill(bundle([self, mom]));
    expect(prefill.parentSlots.mother?.id).toBe("mom");
  });

  it("groups nieces under sibling", () => {
    const self = testPerson("self", { is_self: true, relation_core: "self" });
    const sib = testPerson("sib", { relation_core: "brother", gender: "male" });
    const niece = testPerson("n", {
      relation_core: "niece",
      bio_father_id: "sib",
    });
    const prefill = buildWizardPrefill(bundle([self, sib, niece]));
    expect(prefill.niecesBySibling.sib).toHaveLength(1);
    expect(prefill.standaloneNiecesNephews).toHaveLength(0);
    expect(hasAnySiblings(prefill)).toBe(true);
  });

  it("groups nieces under direct sibling household only, not in-law section", () => {
    const self = testPerson("self", { is_self: true, relation_core: "self" });
    const brother = testPerson("bro", { relation_core: "brother", gender: "male" });
    const inLaw = testPerson("sil", {
      relation_core: "sister",
      gender: "female",
      relation_suffix_tokens: ["in_law"],
    });
    const niece = testPerson("n", {
      relation_core: "niece",
      bio_father_id: "bro",
      bio_mother_id: "sil",
    });
    const prefill = buildWizardPrefill({
      count: 4,
      people: [self, brother, inLaw, niece],
      partnerships: [
        {
          id: "p1",
          person_a_id: "bro",
          person_b_id: "sil",
          status: "current",
          anniversary_date: null,
        },
      ],
      guardian_links: [],
    });
    expect(prefill.siblings.map((p) => p.id)).toEqual(["bro"]);
    expect(prefill.niecesBySibling.bro).toHaveLength(1);
    expect(prefill.niecesBySibling.sil).toBeUndefined();
    expect(prefill.standaloneSiblingInLaws).toHaveLength(0);
  });

  it("includes unlinked sibling-in-law in standalone list", () => {
    const self = testPerson("self", { is_self: true, relation_core: "self" });
    const sil = testPerson("sil", {
      relation_core: "sister",
      relation_suffix_tokens: ["in_law"],
    });
    const prefill = buildWizardPrefill(bundle([self, sil]));
    expect(prefill.siblings).toHaveLength(0);
    expect(prefill.standaloneSiblingInLaws.map((p) => p.id)).toEqual(["sil"]);
  });

  it("excludes sibling spouse from standalone sibling-in-law list", () => {
    const self = testPerson("self", { is_self: true, relation_core: "self" });
    const bro = testPerson("bro", { relation_core: "brother" });
    const sil = testPerson("sil", {
      relation_core: "sister",
      relation_suffix_tokens: ["in_law"],
    });
    const prefill = buildWizardPrefill({
      count: 3,
      people: [self, bro, sil],
      partnerships: [
        {
          id: "p1",
          person_a_id: "bro",
          person_b_id: "sil",
          status: "current",
          anniversary_date: null,
        },
      ],
      guardian_links: [],
    });
    expect(prefill.standaloneSiblingInLaws).toHaveLength(0);
  });

  it("includes unlinked niece in standalone list", () => {
    const self = testPerson("self", { is_self: true, relation_core: "self" });
    const niece = testPerson("n", { relation_core: "niece" });
    const prefill = buildWizardPrefill(bundle([self, niece]));
    expect(prefill.standaloneNiecesNephews.map((p) => p.id)).toEqual(["n"]);
    expect(hasNiecesWizardPage(prefill)).toBe(true);
  });

  it("includes unlinked grandparent in standalone list", () => {
    const self = testPerson("self", {
      is_self: true,
      relation_core: "self",
      bio_mother_id: "mom",
    });
    const mom = testPerson("mom", { relation_core: "mother" });
    const gma = testPerson("gma", { relation_core: "grandma" });
    const linked = testPerson("gpa", { relation_core: "grandpa", bio_father_id: "mom" });
    const prefill = buildWizardPrefill(bundle([self, mom, gma, linked]));
    expect(prefill.grandparentsByParent.mom?.map((p) => p.id)).toContain("gpa");
    expect(prefill.standaloneGrandparents.map((p) => p.id)).toEqual(["gma"]);
  });
});

describe("wizardDisplayBucketIds", () => {
  it("assigns each non-self person to exactly one bucket", () => {
    const self = testPerson("self", {
      is_self: true,
      relation_core: "self",
      bio_mother_id: "mom",
      bio_father_id: "dad",
    });
    const mom = testPerson("mom", { relation_core: "mother" });
    const dad = testPerson("dad", { relation_core: "father" });
    const spouse = testPerson("sp", { relation_core: "spouse" });
    const sib = testPerson("sib", { relation_core: "brother" });
    const sil = testPerson("sil", {
      relation_core: "brother",
      relation_suffix_tokens: ["in_law"],
    });
    const child = testPerson("kid", { relation_core: "child" });
    const gma = testPerson("gma", { relation_core: "grandma" });
    const aunt = testPerson("aunt", { relation_core: "aunt" });
    const cousin = testPerson("cousin", { relation_core: "cousin" });
    const niece = testPerson("n", { relation_core: "niece" });
    const friend = testPerson("f", { relation_core: "friend" });

    const prefill = buildWizardPrefill(
      bundle([self, mom, dad, spouse, sib, sil, child, gma, aunt, cousin, niece, friend]),
    );
    const bucketIds = wizardDisplayBucketIds(prefill).filter((id) => id !== "self");
    const unique = new Set(bucketIds);
    expect(bucketIds.length).toBe(unique.size);
    expect(unique.size).toBe(11);
    expect(unique.has("sil")).toBe(true);
    expect(unique.has("n")).toBe(true);
    expect(unique.has("gma")).toBe(true);
  });
});

describe("firstIncompleteWizardPage", () => {
  it("starts on You when self has no image", () => {
    const self = testPerson("self", { is_self: true, relation_core: "self", image_key: "" });
    expect(firstIncompleteWizardPage(bundle([self]))).toBe("you");
  });

  it("starts on Spouse when self has image but no spouse or partner", () => {
    const self = testPerson("self", {
      is_self: true,
      relation_core: "self",
      image_key: "img/self",
    });
    expect(firstIncompleteWizardPage(bundle([self]))).toBe("spouse");
  });
});
