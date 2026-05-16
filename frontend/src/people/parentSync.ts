import type { PeoplePerson, PeoplePersonPatchPayload } from "./types";

export const PARENT_RELATION_CORES = ["mother", "father"] as const;

/** Prefixes that mean Mother/Father is a label only, not the tree parent slot. */
const TREE_PARENT_BLOCKING_PREFIXES = new Set([
  "step",
  "foster",
  "god",
  "adoptive",
]);

export function isParentRelationCore(core: string): boolean {
  return core === "mother" || core === "father";
}

/** Whether Mother/Father should auto-fill My parents / tree lines on self. */
export function shouldLinkAsTreeParent(
  relationCore: string,
  prefixTokens: string[] = [],
  suffixTokens: string[] = [],
): boolean {
  if (!isParentRelationCore(relationCore)) return false;
  if (suffixTokens.includes("in_law")) return false;
  if (prefixTokens.some((t) => TREE_PARENT_BLOCKING_PREFIXES.has(t))) return false;
  return true;
}

/** Patch for self when another person is labeled Mother/Father to me. */
export function selfLinkPatchForParentRelation(
  self: PeoplePerson,
  personId: string,
  relationCore: string,
  prefixTokens: string[] = [],
  suffixTokens: string[] = [],
): PeoplePersonPatchPayload | null {
  if (!shouldLinkAsTreeParent(relationCore, prefixTokens, suffixTokens)) return null;
  const patch: PeoplePersonPatchPayload = {};
  if (relationCore === "mother" && self.bio_mother_id !== personId) {
    patch.bio_mother_id = personId;
  }
  if (relationCore === "father" && self.bio_father_id !== personId) {
    patch.bio_father_id = personId;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Clear self parent slot when relation to that person is no longer Mother/Father. */
export function selfUnlinkPatchForParentRelation(
  self: PeoplePerson,
  personId: string,
  previousCore: string,
  nextCore: string,
  previousPrefixes: string[] = [],
  previousSuffixes: string[] = [],
  nextPrefixes: string[] = [],
  nextSuffixes: string[] = [],
): PeoplePersonPatchPayload | null {
  if (previousCore === nextCore || !isParentRelationCore(previousCore)) return null;
  if (shouldLinkAsTreeParent(nextCore, nextPrefixes, nextSuffixes)) return null;
  if (!shouldLinkAsTreeParent(previousCore, previousPrefixes, previousSuffixes)) return null;
  const patch: PeoplePersonPatchPayload = {};
  if (previousCore === "mother" && self.bio_mother_id === personId) {
    patch.bio_mother_id = null;
  }
  if (previousCore === "father" && self.bio_father_id === personId) {
    patch.bio_father_id = null;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Patch for self from the My parents dropdowns. */
export function selfPatchFromParentPicks(
  self: PeoplePerson,
  motherId: string,
  fatherId: string,
): PeoplePersonPatchPayload | null {
  const nextMother = motherId || null;
  const nextFather = fatherId || null;
  if (self.bio_mother_id === nextMother && self.bio_father_id === nextFather) return null;
  return {
    bio_mother_id: nextMother,
    bio_father_id: nextFather,
  };
}

/** Nudge picked parents to Mother/Father relation labels when set on self. */
export function relationCorePatchForParentPick(
  person: PeoplePerson,
  slot: "mother" | "father",
): PeoplePersonPatchPayload | null {
  const want = slot === "mother" ? "mother" : "father";
  if (person.relation_core === want) return null;
  return { relation_core: want };
}

export async function syncSelfParentLinks(
  token: string,
  bundle: { people: PeoplePerson[] },
  patchPerson: (
    token: string,
    personId: string,
    payload: PeoplePersonPatchPayload,
  ) => Promise<unknown>,
  opts: {
    editedPersonId: string;
    relationCore: string;
    prefixTokens?: string[];
    suffixTokens?: string[];
    previousCore?: string;
    previousPrefixTokens?: string[];
    previousSuffixTokens?: string[];
    editingSelf?: boolean;
    formMother?: string;
    formFather?: string;
  },
): Promise<void> {
  const self = bundle.people.find((p) => p.is_self);
  if (!self) return;

  if (opts.editingSelf) {
    const motherId = opts.formMother ?? "";
    const fatherId = opts.formFather ?? "";
    if (motherId) {
      const mom = bundle.people.find((p) => p.id === motherId);
      if (mom) {
        const rp = relationCorePatchForParentPick(mom, "mother");
        if (rp) await patchPerson(token, mom.id, rp);
      }
    }
    if (fatherId) {
      const dad = bundle.people.find((p) => p.id === fatherId);
      if (dad) {
        const rp = relationCorePatchForParentPick(dad, "father");
        if (rp) await patchPerson(token, dad.id, rp);
      }
    }
    return;
  }

  const prefixes = opts.prefixTokens ?? [];
  const suffixes = opts.suffixTokens ?? [];
  const link = selfLinkPatchForParentRelation(
    self,
    opts.editedPersonId,
    opts.relationCore,
    prefixes,
    suffixes,
  );
  if (link) await patchPerson(token, self.id, link);

  if (opts.previousCore) {
    const unlink = selfUnlinkPatchForParentRelation(
      self,
      opts.editedPersonId,
      opts.previousCore,
      opts.relationCore,
      opts.previousPrefixTokens ?? [],
      opts.previousSuffixTokens ?? [],
      prefixes,
      suffixes,
    );
    if (unlink) await patchPerson(token, self.id, unlink);
  }
}
