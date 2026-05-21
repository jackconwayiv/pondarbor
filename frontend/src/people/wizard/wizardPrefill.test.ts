import { describe, expect, it } from "vitest";

import { testPerson } from "../testPerson";
import { buildWizardPrefill, hasAnySiblings } from "./wizardPrefill";
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
    expect(hasAnySiblings(prefill)).toBe(true);
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
