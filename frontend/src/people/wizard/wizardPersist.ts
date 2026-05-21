import {
  createPartnership,
  createPerson,
  patchPerson,
} from "../api";
import { personPayloadFromForm } from "../personPayload";
import type { PersonFormState } from "../personFormState";
import {
  grandparentSlotForCore,
  siblingParentSlotForNiece,
} from "./wizardClassify";
import { syncSelfParentLinks } from "../parentSync";
import type { PeopleGraphBundle, PeoplePerson } from "../types";

export type WizardPersistDeps = {
  getToken: () => Promise<string>;
  bundle: PeopleGraphBundle;
  refresh: () => Promise<void>;
};

export async function persistSelfImage(
  deps: WizardPersistDeps,
  self: PeoplePerson,
  imageKey: string,
): Promise<void> {
  const token = await deps.getToken();
  if (imageKey.trim() && imageKey !== (self.image_key || "")) {
    await patchPerson(token, self.id, { image_key: imageKey.trim() });
  }
  await deps.refresh();
}

export async function persistNewPerson(
  deps: WizardPersistDeps,
  form: PersonFormState,
  opts: {
    isCreate?: boolean;
    linkSelfParents?: boolean;
    partnershipWithId?: string;
    patchParentId?: string;
    patchParentSlot?: "mother" | "father";
    setSelfStepMother?: boolean;
    setSelfStepFather?: boolean;
    nieceSibling?: PeoplePerson;
    nieceSecondParentId?: string;
  } = {},
): Promise<PeoplePerson> {
  const token = await deps.getToken();
  const created = await createPerson(
    token,
    personPayloadFromForm(form, { isCreate: opts.isCreate ?? true }),
  );

  if (opts.linkSelfParents !== false) {
    await syncSelfParentLinks(token, deps.bundle, patchPerson, {
      editedPersonId: created.id,
      relationCore: form.core,
      prefixTokens: form.prefix,
      suffixTokens: form.suffix,
    });
  }

  const self = deps.bundle.people.find((p) => p.is_self);
  if (self) {
    if (opts.setSelfStepMother) {
      await patchPerson(token, self.id, {
        step_mother_id: created.id,
        step_father_id: self.step_father_id,
      });
    }
    if (opts.setSelfStepFather) {
      await patchPerson(token, self.id, {
        step_mother_id: self.step_mother_id,
        step_father_id: created.id,
      });
    }
  }

  if (opts.patchParentId && opts.patchParentSlot) {
    const patch =
      opts.patchParentSlot === "mother"
        ? { bio_mother_id: created.id }
        : { bio_father_id: created.id };
    await patchPerson(token, opts.patchParentId, patch);
  }

  if (opts.nieceSibling) {
    const slot = siblingParentSlotForNiece(opts.nieceSibling);
    const niecePatch: { bio_mother_id?: string; bio_father_id?: string } = {};
    if (slot === "mother" || (slot === "choose" && form.mother)) {
      niecePatch.bio_mother_id = opts.nieceSibling.id;
    } else if (slot === "father" || (slot === "choose" && form.father)) {
      niecePatch.bio_father_id = opts.nieceSibling.id;
    } else {
      niecePatch.bio_mother_id = opts.nieceSibling.id;
    }
    if (opts.nieceSecondParentId) {
      const second = deps.bundle.people.find((p) => p.id === opts.nieceSecondParentId);
      if (second?.gender === "male") {
        niecePatch.bio_father_id = opts.nieceSecondParentId;
      } else if (second?.gender === "female") {
        niecePatch.bio_mother_id = opts.nieceSecondParentId;
      } else if (!niecePatch.bio_father_id) {
        niecePatch.bio_father_id = opts.nieceSecondParentId;
      } else {
        niecePatch.bio_mother_id = opts.nieceSecondParentId;
      }
    }
    await patchPerson(token, created.id, niecePatch);
  }

  if (opts.partnershipWithId) {
    await createPartnership(token, {
      person_one_id: created.id,
      person_two_id: opts.partnershipWithId,
    });
  }

  await deps.refresh();
  return created;
}

export async function persistPersonPatch(
  deps: WizardPersistDeps,
  personId: string,
  form: PersonFormState,
  opts: {
    editingSelf?: boolean;
    previousCore?: string;
    previousPrefixTokens?: string[];
    previousSuffixTokens?: string[];
    partnershipWithId?: string;
    patchParentId?: string;
    patchParentSlot?: "mother" | "father";
  } = {},
): Promise<void> {
  const token = await deps.getToken();
  await patchPerson(
    token,
    personId,
    personPayloadFromForm(form, { editingSelf: opts.editingSelf }),
  );
  await syncSelfParentLinks(token, deps.bundle, patchPerson, {
    editedPersonId: personId,
    relationCore: form.core,
    prefixTokens: form.prefix,
    suffixTokens: form.suffix,
    previousCore: opts.previousCore,
    previousPrefixTokens: opts.previousPrefixTokens ?? [],
    previousSuffixTokens: opts.previousSuffixTokens ?? [],
    editingSelf: opts.editingSelf,
    formMother: form.mother,
    formFather: form.father,
  });
  if (opts.patchParentId && opts.patchParentSlot) {
    const patch =
      opts.patchParentSlot === "mother"
        ? { bio_mother_id: personId }
        : { bio_father_id: personId };
    await patchPerson(token, opts.patchParentId, patch);
  }
  if (opts.partnershipWithId) {
    await createPartnership(token, {
      person_one_id: personId,
      person_two_id: opts.partnershipWithId,
    });
  }
  await deps.refresh();
}

export async function persistGrandparent(
  deps: WizardPersistDeps,
  form: PersonFormState,
  bioParentId: string,
): Promise<PeoplePerson> {
  const slot = grandparentSlotForCore(form.core);
  return persistNewPerson(deps, form, {
    isCreate: true,
    linkSelfParents: false,
    patchParentId: bioParentId,
    patchParentSlot: slot,
  });
}

export async function persistSpouseWithSelf(
  deps: WizardPersistDeps,
  form: PersonFormState,
): Promise<PeoplePerson> {
  const self = deps.bundle.people.find((p) => p.is_self);
  if (!self) throw new Error("Self person missing.");
  return persistNewPerson(deps, form, {
    partnershipWithId: self.id,
  });
}

export async function persistChildOfSelf(
  deps: WizardPersistDeps,
  form: PersonFormState,
): Promise<PeoplePerson> {
  const self = deps.bundle.people.find((p) => p.is_self);
  const childForm = { ...form };
  if (self?.bio_mother_id) childForm.mother = self.bio_mother_id;
  if (self?.bio_father_id) childForm.father = self.bio_father_id;
  return persistNewPerson(deps, childForm, { linkSelfParents: false });
}
