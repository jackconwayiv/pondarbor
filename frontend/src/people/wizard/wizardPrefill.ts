import {
  findSelf,
  grandparentIdsForParent,
  isAuntUnclePerson,
  isBioParentToSelf,
  isChildPerson,
  isCousinPerson,
  isExtraParentFigure,
  isFriendPerson,
  isDirectSiblingPerson,
  isGrandparentPerson,
  isNieceNephewPerson,
  isPetPerson,
  isSiblingInLawPartnerOfDirectSibling,
  isSiblingInLawPerson,
  isSpousePerson,
  isStepParentToSelf,
  siblingPartnerId,
} from "./wizardClassify";
import type { PeopleGraphBundle, PeoplePerson } from "../types";

export type ParentSlots = {
  mother: PeoplePerson | null;
  father: PeoplePerson | null;
  stepMother: PeoplePerson | null;
  stepFather: PeoplePerson | null;
  extra: PeoplePerson[];
};

export type WizardPrefill = {
  self: PeoplePerson | null;
  parentSlots: ParentSlots;
  siblings: PeoplePerson[];
  children: PeoplePerson[];
  pets: PeoplePerson[];
  /** Grandparents grouped by bio parent id on self. */
  grandparentsByParent: Record<string, PeoplePerson[]>;
  spouses: PeoplePerson[];
  auntsUncles: PeoplePerson[];
  cousins: PeoplePerson[];
  /** Nieces/nephews grouped by sibling id. */
  niecesBySibling: Record<string, PeoplePerson[]>;
  /** Brother/sister-in-law not shown as a direct sibling's partner subtext. */
  standaloneSiblingInLaws: PeoplePerson[];
  /** Niece/nephew with relation label only, not bio-linked to a sibling household. */
  standaloneNiecesNephews: PeoplePerson[];
  /** Grandma/grandpa with relation label only, not structurally linked to a bio parent. */
  standaloneGrandparents: PeoplePerson[];
  friends: PeoplePerson[];
};

function personById(people: PeoplePerson[], id: string | null): PeoplePerson | null {
  if (!id) return null;
  return people.find((p) => p.id === id) ?? null;
}

export function buildWizardPrefill(bundle: PeopleGraphBundle): WizardPrefill {
  const self = findSelf(bundle.people) ?? null;
  const others = bundle.people.filter((p) => !p.is_self);

  const parentSlots: ParentSlots = {
    mother: self ? personById(bundle.people, self.bio_mother_id) : null,
    father: self ? personById(bundle.people, self.bio_father_id) : null,
    stepMother: self ? personById(bundle.people, self.step_mother_id) : null,
    stepFather: self ? personById(bundle.people, self.step_father_id) : null,
    extra: [],
  };

  if (self) {
    for (const p of others) {
      if (isExtraParentFigure(p, self)) {
        parentSlots.extra.push(p);
      } else if (isBioParentToSelf(p, self)) {
        if (p.relation_core === "mother" && !parentSlots.mother) parentSlots.mother = p;
        if (p.relation_core === "father" && !parentSlots.father) parentSlots.father = p;
      } else if (isStepParentToSelf(p, self)) {
        if (p.relation_core === "mother" && !parentSlots.stepMother) {
          parentSlots.stepMother = p;
        }
        if (p.relation_core === "father" && !parentSlots.stepFather) {
          parentSlots.stepFather = p;
        }
      }
    }
  }

  const siblings = others.filter(isDirectSiblingPerson);
  const children = others.filter(isChildPerson);
  const pets = others.filter(isPetPerson);
  const spouses = others.filter(isSpousePerson);
  const auntsUncles = others.filter(isAuntUnclePerson);
  const cousins = others.filter(isCousinPerson);
  const friends = others.filter(isFriendPerson);

  const grandparentsByParent: Record<string, PeoplePerson[]> = {};
  if (self?.bio_mother_id) {
    const ids = grandparentIdsForParent(bundle, self.bio_mother_id);
    grandparentsByParent[self.bio_mother_id] = ids
      .map((id) => bundle.people.find((p) => p.id === id))
      .filter((p): p is PeoplePerson => Boolean(p));
  }
  if (self?.bio_father_id) {
    const ids = grandparentIdsForParent(bundle, self.bio_father_id);
    grandparentsByParent[self.bio_father_id] = ids
      .map((id) => bundle.people.find((p) => p.id === id))
      .filter((p): p is PeoplePerson => Boolean(p));
  }

  const niecesBySibling: Record<string, PeoplePerson[]> = {};
  for (const sib of siblings) {
    const partnerId = siblingPartnerId(bundle, sib.id);
    const householdIds = new Set([sib.id, ...(partnerId ? [partnerId] : [])]);
    const seen = new Set<string>();
    const list: PeoplePerson[] = [];
    for (const p of others) {
      if (!isNieceNephewPerson(p)) continue;
      if (!householdIds.has(p.bio_mother_id ?? "") && !householdIds.has(p.bio_father_id ?? "")) {
        continue;
      }
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      list.push(p);
    }
    niecesBySibling[sib.id] = list;
  }

  const linkedGrandparentIds = new Set<string>();
  for (const list of Object.values(grandparentsByParent)) {
    for (const g of list) linkedGrandparentIds.add(g.id);
  }
  const standaloneGrandparents = others.filter(
    (p) => isGrandparentPerson(p) && !linkedGrandparentIds.has(p.id),
  );

  const linkedNieceIds = new Set<string>();
  for (const list of Object.values(niecesBySibling)) {
    for (const n of list) linkedNieceIds.add(n.id);
  }
  const standaloneNiecesNephews = others.filter(
    (p) => isNieceNephewPerson(p) && !linkedNieceIds.has(p.id),
  );

  const standaloneSiblingInLaws = others.filter(
    (p) =>
      isSiblingInLawPerson(p) &&
      !isSiblingInLawPartnerOfDirectSibling(bundle, p.id, siblings),
  );

  return {
    self,
    parentSlots,
    siblings,
    children,
    pets,
    grandparentsByParent,
    spouses,
    auntsUncles,
    cousins,
    niecesBySibling,
    standaloneSiblingInLaws,
    standaloneNiecesNephews,
    standaloneGrandparents,
    friends,
  };
}

export function hasAnySiblings(prefill: WizardPrefill): boolean {
  return prefill.siblings.length > 0;
}

export function hasNiecesWizardPage(prefill: WizardPrefill): boolean {
  return prefill.siblings.length > 0 || prefill.standaloneNiecesNephews.length > 0;
}

/** Every person id assigned to a wizard display bucket (for coverage tests). */
export function wizardDisplayBucketIds(prefill: WizardPrefill): string[] {
  const ids: string[] = [];
  if (prefill.self) ids.push(prefill.self.id);
  const { parentSlots } = prefill;
  for (const p of [
    parentSlots.mother,
    parentSlots.father,
    parentSlots.stepMother,
    parentSlots.stepFather,
    ...parentSlots.extra,
  ]) {
    if (p) ids.push(p.id);
  }
  for (const list of [
    prefill.siblings,
    prefill.standaloneSiblingInLaws,
    prefill.children,
    prefill.pets,
    prefill.spouses,
    prefill.auntsUncles,
    prefill.cousins,
    prefill.standaloneNiecesNephews,
    prefill.standaloneGrandparents,
    prefill.friends,
  ]) {
    for (const p of list) ids.push(p.id);
  }
  for (const list of Object.values(prefill.grandparentsByParent)) {
    for (const p of list) ids.push(p.id);
  }
  for (const list of Object.values(prefill.niecesBySibling)) {
    for (const p of list) ids.push(p.id);
  }
  return ids;
}

export function siblingSpousePerson(
  bundle: PeopleGraphBundle,
  sibling: PeoplePerson,
): PeoplePerson | null {
  const pid = siblingPartnerId(bundle, sibling.id);
  if (!pid) return null;
  return bundle.people.find((p) => p.id === pid) ?? null;
}

export function siblingHouseholdTitle(
  sibling: PeoplePerson,
  spouse: PeoplePerson | null,
): string {
  if (spouse) return `${sibling.name} & ${spouse.name}'s children`;
  return `${sibling.name}'s children`;
}
