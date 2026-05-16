import { describe, expect, it } from "vitest";

import { allStepParentLinks, inferStepParentLinksFromLabels } from "./stepParentLinks";
import { testPerson } from "./testPerson";

describe("stepParentLinks", () => {
  it("infers dashed link from step-father label to self", () => {
    const people = [
      testPerson("self", { is_self: true, relation_core: "self" }),
      testPerson("sf", { relation_core: "father", relation_prefix_tokens: ["step"] }),
    ];
    const links = inferStepParentLinksFromLabels(people);
    expect(links).toEqual([{ parentId: "sf", childId: "self" }]);
  });

  it("uses explicit step_father_id on child", () => {
    const people = [
      testPerson("kid", { step_father_id: "sf" }),
      testPerson("sf", { relation_core: "father" }),
    ];
    const links = allStepParentLinks(people);
    expect(links).toContainEqual({ parentId: "sf", childId: "kid" });
  });
});
