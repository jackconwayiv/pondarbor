import { describe, expect, it } from "vitest";

import { testPerson } from "../testPerson";
import {
  inLawCoreForSiblingSpouse,
  newSiblingSpouseForm,
  relationLabelFromForm,
} from "./siblingSpouseForm";

describe("siblingSpouseForm", () => {
  it("defaults brother's spouse to sister-in-law", () => {
    const sib = testPerson("sib", { relation_core: "brother" });
    const form = newSiblingSpouseForm(sib);
    expect(form.core).toBe("sister");
    expect(form.suffix).toContain("in_law");
    expect(relationLabelFromForm(form)).toMatch(/sister.*in-law/i);
  });

  it("uses brother-in-law when spouse gender is male", () => {
    const sib = testPerson("sib", { relation_core: "sister" });
    expect(inLawCoreForSiblingSpouse(sib, "male")).toBe("brother");
  });
});
