import { emptyPersonForm, type PersonFormState } from "../personFormState";
import { relationLabelFromForm } from "./wizardEntryUi";
import type { PeoplePerson } from "../types";

export { relationLabelFromForm };

/** Brother/sister-in-law to self (not spouse). */
export function inLawCoreForSiblingSpouse(
  sibling: PeoplePerson,
  spouseGender: string,
): "brother" | "sister" {
  if (spouseGender === "female") return "sister";
  if (spouseGender === "male") return "brother";
  return sibling.relation_core === "brother" ? "sister" : "brother";
}

export function newSiblingSpouseForm(sibling: PeoplePerson): PersonFormState {
  return emptyPersonForm({
    core: inLawCoreForSiblingSpouse(sibling, ""),
    suffix: ["in_law"],
    prefix: [],
  });
}

