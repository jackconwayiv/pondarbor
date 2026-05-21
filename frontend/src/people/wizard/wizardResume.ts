import { buildWizardPrefill, hasAnySiblings } from "./wizardPrefill";
import { activeWizardPages, type WizardPageId } from "./wizardSteps";
import { grandparentIdsForParent } from "./wizardClassify";
import type { PeopleGraphBundle } from "../types";

function parentsPageComplete(bundle: PeopleGraphBundle): boolean {
  const prefill = buildWizardPrefill(bundle);
  const self = prefill.self;
  if (!self) return false;
  const hasBio =
    Boolean(self.bio_mother_id) ||
    Boolean(self.bio_father_id) ||
    Boolean(prefill.parentSlots.mother) ||
    Boolean(prefill.parentSlots.father);
  const hasStep =
    Boolean(self.step_mother_id) ||
    Boolean(self.step_father_id) ||
    Boolean(prefill.parentSlots.stepMother) ||
    Boolean(prefill.parentSlots.stepFather);
  const hasExtra = prefill.parentSlots.extra.length > 0;
  return hasBio || hasStep || hasExtra;
}

function grandparentsPageComplete(bundle: PeopleGraphBundle): boolean {
  const prefill = buildWizardPrefill(bundle);
  const self = prefill.self;
  if (!self) return true;
  const parentIds = [self.bio_mother_id, self.bio_father_id].filter(
    (id): id is string => Boolean(id),
  );
  if (parentIds.length === 0) return true;
  return parentIds.every((pid) => grandparentIdsForParent(bundle, pid).length > 0);
}

function bucketPageComplete(count: number): boolean {
  return count > 0;
}

export function isWizardPageComplete(
  bundle: PeopleGraphBundle,
  pageId: WizardPageId,
): boolean {
  const prefill = buildWizardPrefill(bundle);
  switch (pageId) {
    case "you":
      return Boolean(prefill.self?.image_key?.trim());
    case "parents":
      return parentsPageComplete(bundle);
    case "siblings":
      return bucketPageComplete(prefill.siblings.length);
    case "children":
      return bucketPageComplete(prefill.children.length + prefill.pets.length);
    case "grandparents":
      return grandparentsPageComplete(bundle);
    case "spouse":
      return bucketPageComplete(prefill.spouses.length);
    case "aunts":
      return bucketPageComplete(prefill.auntsUncles.length);
    case "cousins":
      return bucketPageComplete(prefill.cousins.length);
    case "nieces":
      return Object.values(prefill.niecesBySibling).some((arr) => arr.length > 0);
    case "friends":
      return bucketPageComplete(prefill.friends.length);
    default:
      return true;
  }
}

/** First page that still looks empty/incomplete; falls back to first active page. */
export function firstIncompleteWizardPage(bundle: PeopleGraphBundle): WizardPageId {
  const active = activeWizardPages(hasAnySiblings(buildWizardPrefill(bundle)));
  for (const pageId of active) {
    if (!isWizardPageComplete(bundle, pageId)) return pageId;
  }
  return active[0] ?? "you";
}
