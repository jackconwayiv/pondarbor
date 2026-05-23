import { formatDefaultRelationLine } from "../formatRelation";
import { emptyPersonForm, type PersonFormState } from "../personFormState";
import type { PeoplePerson } from "../types";

export type WizardParentSlots = {
  mother: PeoplePerson | null;
  father: PeoplePerson | null;
};

export type WizardEntryInProgressState = {
  editingId: string | null;
  draftCount: number;
  spouseForSiblingId: string | null;
  showStepMotherForm: boolean;
  showStepFatherForm: boolean;
};

/** True when the user is mid add/edit on any wizard step (hides other "Add …" buttons). */
export function wizardEntryInProgress(state: WizardEntryInProgressState): boolean {
  return (
    state.editingId !== null ||
    state.draftCount > 0 ||
    state.spouseForSiblingId !== null ||
    state.showStepMotherForm ||
    state.showStepFatherForm
  );
}

/** True when bio mother or father slot is still empty (Parents-step gating only). */
export function wizardParentsSlotsIncomplete(parentSlots: WizardParentSlots): boolean {
  return !parentSlots.mother || !parentSlots.father;
}

export function wizardParentsAddBlocked(
  entryState: WizardEntryInProgressState,
  parentSlots: WizardParentSlots,
): boolean {
  return wizardEntryInProgress(entryState) || wizardParentsSlotsIncomplete(parentSlots);
}

export function relationLabelFromForm(form: PersonFormState): string {
  return formatDefaultRelationLine({
    relation_core: form.core,
    relation_prefix_tokens: form.prefix,
    relation_suffix_tokens: form.suffix,
  } as PeoplePerson);
}

/** Default hint for editable relation-to-me in Add details. */
export function suggestedRelationHint(
  form: PersonFormState,
  extra = "Change under Add details if needed.",
): string {
  return `Suggested relation to me: ${relationLabelFromForm(form)}. ${extra}`;
}

export type WizardDraftKind =
  | "sibling"
  | "child"
  | "grandparent"
  | "niece"
  | "spouse"
  | "aunt"
  | "cousin"
  | "friend"
  | "extraParent";

export type WizardDraft = {
  draftId: string;
  kind: WizardDraftKind;
  form: PersonFormState;
  grandparentParentId?: string;
  nieceSiblingId?: string;
};

export function defaultMotherForm(): PersonFormState {
  return emptyPersonForm({ core: "mother", gender: "female" });
}

export function defaultFatherForm(): PersonFormState {
  return emptyPersonForm({ core: "father", gender: "male" });
}

export function newWizardDraft(
  kind: WizardDraftKind,
  formOverrides: Partial<PersonFormState> = {},
  meta?: Pick<WizardDraft, "grandparentParentId" | "nieceSiblingId">,
): WizardDraft {
  return {
    draftId: crypto.randomUUID(),
    kind,
    form: emptyPersonForm(formOverrides),
    ...meta,
  };
}

/** Props shared by most wizard add/edit rows (relation editable in Add details). */
export function suggestedRelationEntryProps(
  form: PersonFormState,
  hintExtra?: string,
): {
  showRelationFields: false;
  relationInDetails: true;
  relationHint: string;
} {
  return {
    showRelationFields: false,
    relationInDetails: true,
    relationHint: suggestedRelationHint(form, hintExtra),
  };
}
