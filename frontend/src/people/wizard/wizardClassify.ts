import { shouldLinkAsTreeParent } from "../parentSync";
import type { PeopleGraphBundle, PeoplePerson } from "../types";

const SIBLING_CORES = new Set(["brother", "sister"]);
const CHILD_CORES = new Set(["child", "son", "daughter"]);
const SPOUSE_CORES = new Set(["spouse", "partner", "significant_other"]);
const AUNT_UNCLE_CORES = new Set(["aunt", "uncle"]);
const GRAND_CORES = new Set(["grandma", "grandpa"]);

export function findSelf(people: PeoplePerson[]): PeoplePerson | undefined {
  return people.find((p) => p.is_self);
}

export function isSiblingPerson(p: PeoplePerson): boolean {
  return SIBLING_CORES.has(p.relation_core);
}

/** Bio sibling on your tree, not an in-law stored as brother/sister + in_law suffix. */
export function isDirectSiblingPerson(p: PeoplePerson): boolean {
  return isSiblingPerson(p) && !p.relation_suffix_tokens.includes("in_law");
}

export function isSiblingInLawPerson(p: PeoplePerson): boolean {
  return isSiblingPerson(p) && p.relation_suffix_tokens.includes("in_law");
}

/** True when person is the current partner of a direct sibling (shown as spouse subtext). */
export function isSiblingInLawPartnerOfDirectSibling(
  bundle: PeopleGraphBundle,
  personId: string,
  directSiblings: PeoplePerson[],
): boolean {
  for (const sib of directSiblings) {
    if (siblingPartnerId(bundle, sib.id) === personId) return true;
  }
  return false;
}

export function isChildPerson(p: PeoplePerson): boolean {
  return CHILD_CORES.has(p.relation_core);
}

export function isPetPerson(p: PeoplePerson): boolean {
  return p.relation_core === "pet";
}

export function isSpousePerson(p: PeoplePerson): boolean {
  return SPOUSE_CORES.has(p.relation_core);
}

export function isAuntUnclePerson(p: PeoplePerson): boolean {
  return AUNT_UNCLE_CORES.has(p.relation_core);
}

export function isCousinPerson(p: PeoplePerson): boolean {
  return p.relation_core === "cousin";
}

export function isNieceNephewPerson(p: PeoplePerson): boolean {
  return p.relation_core === "niece" || p.relation_core === "nephew";
}

export function isFriendPerson(p: PeoplePerson): boolean {
  return p.relation_core === "friend";
}

export function isGrandparentPerson(p: PeoplePerson): boolean {
  return GRAND_CORES.has(p.relation_core);
}

export function isBioParentToSelf(p: PeoplePerson, _self: PeoplePerson): boolean {
  return (
    shouldLinkAsTreeParent(
      p.relation_core,
      p.relation_prefix_tokens,
      p.relation_suffix_tokens,
    ) &&
    (p.relation_core === "mother" || p.relation_core === "father")
  );
}

export function isStepParentToSelf(p: PeoplePerson, self: PeoplePerson): boolean {
  if (p.id === self.step_mother_id && p.relation_core === "mother") return true;
  if (p.id === self.step_father_id && p.relation_core === "father") return true;
  return (
    p.relation_prefix_tokens.includes("step") &&
    (p.relation_core === "mother" || p.relation_core === "father")
  );
}

export function isExtraParentFigure(p: PeoplePerson, self: PeoplePerson): boolean {
  if (p.is_self) return false;
  if (isBioParentToSelf(p, self)) {
    if (p.relation_core === "mother" && p.id === self.bio_mother_id) return false;
    if (p.relation_core === "father" && p.id === self.bio_father_id) return false;
    return true;
  }
  if (isStepParentToSelf(p, self)) {
    if (p.id === self.step_mother_id || p.id === self.step_father_id) return false;
    return true;
  }
  return (
    (p.relation_core === "mother" || p.relation_core === "father") &&
    !shouldLinkAsTreeParent(
      p.relation_core,
      p.relation_prefix_tokens,
      p.relation_suffix_tokens,
    )
  );
}

export function siblingPartnerId(
  bundle: PeopleGraphBundle,
  siblingId: string,
): string | null {
  for (const pr of bundle.partnerships) {
    if (pr.status !== "current") continue;
    if (pr.person_a_id === siblingId) return pr.person_b_id;
    if (pr.person_b_id === siblingId) return pr.person_a_id;
  }
  return null;
}

export function grandparentIdsForParent(
  bundle: PeopleGraphBundle,
  parentId: string,
): string[] {
  const parent = bundle.people.find((p) => p.id === parentId);
  if (!parent) return [];
  const ids = new Set<string>();
  if (parent.bio_mother_id) ids.add(parent.bio_mother_id);
  if (parent.bio_father_id) ids.add(parent.bio_father_id);
  for (const p of bundle.people) {
    if (!isGrandparentPerson(p)) continue;
    if (p.bio_mother_id === parentId || p.bio_father_id === parentId) {
      ids.add(p.id);
    }
  }
  return [...ids];
}

/** Which parent FK slot on `child` should reference `sibling` by gender. */
export function siblingParentSlotForNiece(
  sibling: PeoplePerson,
): "mother" | "father" | "choose" {
  if (sibling.gender === "female") return "mother";
  if (sibling.gender === "male") return "father";
  return "choose";
}

export function grandparentSlotForCore(core: string): "mother" | "father" {
  return core === "grandma" ? "mother" : "father";
}
