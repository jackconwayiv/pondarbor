import type { PeoplePerson } from "./types";

/** People who can be newly linked as this person's partner (excludes self and existing partners). */
export function partnerLinkCandidates(
  candidates: PeoplePerson[],
  subjectPersonId: string | undefined,
  existingPartnerIds: string[],
): PeoplePerson[] {
  const partnered = new Set(existingPartnerIds);
  return candidates.filter(
    (p) => p.id !== subjectPersonId && !partnered.has(p.id),
  );
}
