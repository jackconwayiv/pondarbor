import { describe, expect, it } from "vitest";

import { partnerLinkCandidates } from "./partnerLinkCandidates";
import { testPerson } from "./testPerson";

describe("partnerLinkCandidates", () => {
  it("excludes subject and existing partners", () => {
    const list = [testPerson("sister"), testPerson("husband"), testPerson("cousin")];
    const out = partnerLinkCandidates(list, "sister", ["husband"]);
    expect(out.map((p) => p.id)).toEqual(["cousin"]);
  });
});
