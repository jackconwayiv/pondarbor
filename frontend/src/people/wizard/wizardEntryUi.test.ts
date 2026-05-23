import { describe, expect, it } from "vitest";

import { testPerson } from "../testPerson";
import {
  wizardEntryInProgress,
  wizardParentsAddBlocked,
  wizardParentsSlotsIncomplete,
  type WizardEntryInProgressState,
} from "./wizardEntryUi";

const idleEntry: WizardEntryInProgressState = {
  editingId: null,
  draftCount: 0,
  spouseForSiblingId: null,
  showStepMotherForm: false,
  showStepFatherForm: false,
};

const emptyParents = { mother: null, father: null };

describe("wizardEntryInProgress", () => {
  it("is false when no add/edit is active", () => {
    expect(wizardEntryInProgress(idleEntry)).toBe(false);
  });

  it("is true when a draft exists", () => {
    expect(wizardEntryInProgress({ ...idleEntry, draftCount: 1 })).toBe(true);
  });

  it("is true when editing a person", () => {
    expect(wizardEntryInProgress({ ...idleEntry, editingId: "p1" })).toBe(true);
  });
});

describe("wizardParentsSlotsIncomplete", () => {
  it("is true when mother or father slot is empty", () => {
    expect(wizardParentsSlotsIncomplete(emptyParents)).toBe(true);
    expect(
      wizardParentsSlotsIncomplete({
        mother: testPerson("m", { relation_core: "mother" }),
        father: null,
      }),
    ).toBe(true);
  });

  it("is false when both slots are filled", () => {
    expect(
      wizardParentsSlotsIncomplete({
        mother: testPerson("m", { relation_core: "mother" }),
        father: testPerson("f", { relation_core: "father" }),
      }),
    ).toBe(false);
  });
});

describe("wizardParentsAddBlocked", () => {
  it("blocks parents-page extras when bio slots are empty", () => {
    expect(wizardParentsAddBlocked(idleEntry, emptyParents)).toBe(true);
  });

  it("does not conflate parent slots with entryInProgress (spouse step regression)", () => {
    expect(wizardEntryInProgress(idleEntry)).toBe(false);
    expect(wizardParentsSlotsIncomplete(emptyParents)).toBe(true);
  });
});
