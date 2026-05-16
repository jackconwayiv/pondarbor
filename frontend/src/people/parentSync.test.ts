import { describe, expect, it } from "vitest";

import {
  selfLinkPatchForParentRelation,
  selfPatchFromParentPicks,
  selfUnlinkPatchForParentRelation,
  shouldLinkAsTreeParent,
} from "./parentSync";
import { parentRelationHintText } from "./parentRelationHint";
import { testPerson } from "./testPerson";

function self(overrides: Parameters<typeof testPerson>[1] = {}) {
  return testPerson("self", {
    name: "Me",
    relation_core: "self",
    is_self: true,
    ...overrides,
  });
}

describe("parentSync", () => {
  it("links self to father relation", () => {
    const patch = selfLinkPatchForParentRelation(self(), "dad", "father");
    expect(patch).toEqual({ bio_father_id: "dad" });
  });

  it("does not link step-father as tree parent", () => {
    expect(shouldLinkAsTreeParent("father", ["step"], [])).toBe(false);
    expect(selfLinkPatchForParentRelation(self(), "dad", "father", ["step"], [])).toBeNull();
  });

  it("does not link father-in-law as tree parent", () => {
    expect(shouldLinkAsTreeParent("father", [], ["in_law"])).toBe(false);
  });

  it("hint mentions dashed step-father line", () => {
    expect(parentRelationHintText("father", ["step"], [])).toContain("step-father");
    expect(parentRelationHintText("father", ["step"], [])).toContain("dashed");
  });

  it("clears self father link when relation changes away", () => {
    const patch = selfUnlinkPatchForParentRelation(
      self({ bio_father_id: "dad" }),
      "dad",
      "father",
      "cousin",
    );
    expect(patch).toEqual({ bio_father_id: null });
  });

  it("builds self patch from parent picks", () => {
    const patch = selfPatchFromParentPicks(self(), "mom", "");
    expect(patch).toEqual({ bio_mother_id: "mom", bio_father_id: null });
  });
});
