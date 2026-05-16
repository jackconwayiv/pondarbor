import type { PeoplePerson } from "./types";

const STEP_PARENT_CORES = new Set(["mother", "father"]);
const STEP_CHILD_CORES = new Set(["son", "daughter", "child"]);

export type StepParentLink = { parentId: string; childId: string };

function linkKey(parentId: string, childId: string): string {
  return `${parentId}\0${childId}`;
}

/** Step parent links stored on each child row. */
export function stepParentLinksFromFields(people: PeoplePerson[]): StepParentLink[] {
  const links: StepParentLink[] = [];
  const seen = new Set<string>();
  for (const p of people) {
    for (const parId of [p.step_mother_id, p.step_father_id]) {
      if (!parId) continue;
      const key = linkKey(parId, p.id);
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ parentId: parId, childId: p.id });
    }
  }
  return links;
}

/**
 * Step links from Relation to me labels (Step + parent/child role).
 * Only when no explicit step-parent field already covers the pair.
 */
export function inferStepParentLinksFromLabels(people: PeoplePerson[]): StepParentLink[] {
  const self = people.find((p) => p.is_self);
  if (!self) return [];

  const explicit = new Set<string>();
  for (const p of people) {
    for (const parId of [p.step_mother_id, p.step_father_id]) {
      if (parId) explicit.add(linkKey(parId, p.id));
    }
  }

  const links: StepParentLink[] = [];
  const seen = new Set<string>();
  for (const p of people) {
    if (p.id === self.id) continue;
    if (!(p.relation_prefix_tokens || []).includes("step")) continue;

    let link: StepParentLink | null = null;
    if (STEP_PARENT_CORES.has(p.relation_core)) {
      link = { parentId: p.id, childId: self.id };
    } else if (STEP_CHILD_CORES.has(p.relation_core)) {
      link = { parentId: self.id, childId: p.id };
    }
    if (!link) continue;

    const key = linkKey(link.parentId, link.childId);
    if (seen.has(key) || explicit.has(key)) continue;
    seen.add(key);
    links.push(link);
  }
  return links;
}

export function allStepParentLinks(people: PeoplePerson[]): StepParentLink[] {
  const fromFields = stepParentLinksFromFields(people);
  const inferred = inferStepParentLinksFromLabels(people);
  const seen = new Set(fromFields.map((l) => linkKey(l.parentId, l.childId)));
  const out = [...fromFields];
  for (const l of inferred) {
    const key = linkKey(l.parentId, l.childId);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}
