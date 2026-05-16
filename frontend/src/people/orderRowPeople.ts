import type { PeoplePartnershipRow, PeoplePerson } from "./types";

/** Lower = prefer left in a partner pair. */
function leftPartnerPriority(p: PeoplePerson): number {
  if (p.gender === "male") return 0;
  if (p.gender === "female") return 1;
  const masculine = new Set([
    "father",
    "brother",
    "son",
    "grandpa",
    "uncle",
    "nephew",
  ]);
  const feminine = new Set([
    "mother",
    "sister",
    "daughter",
    "grandma",
    "aunt",
    "niece",
  ]);
  if (masculine.has(p.relation_core)) return 0;
  if (feminine.has(p.relation_core)) return 1;
  return 2;
}

/** [left, right] for a partner line between two people in the same row. */
export function orderPartnerPair(a: PeoplePerson, b: PeoplePerson): [PeoplePerson, PeoplePerson] {
  const pa = leftPartnerPriority(a);
  const pb = leftPartnerPriority(b);
  if (pa !== pb) return pa < pb ? [a, b] : [b, a];
  return a.name.localeCompare(b.name) <= 0 ? [a, b] : [b, a];
}

function sharedBioParentIds(a: PeoplePerson, b: PeoplePerson): boolean {
  const bParents = new Set(
    [b.bio_mother_id, b.bio_father_id].filter((id): id is string => Boolean(id)),
  );
  return [a.bio_mother_id, a.bio_father_id].some(
    (id) => id != null && bParents.has(id),
  );
}

/**
 * Order people within one generation row: partners adjacent (typically male/left),
 * self first, then siblings of self, then others by name.
 */
export type OrderRowOptions = {
  /** Row immediately above (older generation); used to tuck pets under their owner. */
  prevRow?: PeoplePerson[];
};

export function orderPeopleInRow(
  rowPeople: PeoplePerson[],
  partnerships: PeoplePartnershipRow[],
  self: PeoplePerson | undefined,
  options: OrderRowOptions = {},
): PeoplePerson[] {
  if (rowPeople.length <= 1) return rowPeople;

  const pets = rowPeople.filter((p) => p.relation_core === "pet");
  const nonPets = rowPeople.filter((p) => p.relation_core !== "pet");
  const orderedNonPets =
    nonPets.length === 0
      ? []
      : orderPeopleInRowCore(nonPets, partnerships, self);

  if (pets.length === 0) return orderedNonPets;

  const sortedPets = [...pets].sort((a, b) => a.name.localeCompare(b.name));
  const ownerIdx =
    self && options.prevRow ? options.prevRow.findIndex((p) => p.id === self.id) : -1;
  const insertAt = ownerIdx >= 0 ? Math.min(ownerIdx + 1, orderedNonPets.length) : orderedNonPets.length;

  return [
    ...orderedNonPets.slice(0, insertAt),
    ...sortedPets,
    ...orderedNonPets.slice(insertAt),
  ];
}

function orderPeopleInRowCore(
  rowPeople: PeoplePerson[],
  partnerships: PeoplePartnershipRow[],
  self: PeoplePerson | undefined,
): PeoplePerson[] {
  const byId = new Map(rowPeople.map((p) => [p.id, p]));
  const rowIds = new Set(rowPeople.map((p) => p.id));

  const partnerOf = new Map<string, string[]>();
  for (const row of partnerships) {
    if (!rowIds.has(row.person_a_id) || !rowIds.has(row.person_b_id)) continue;
    if (!partnerOf.has(row.person_a_id)) partnerOf.set(row.person_a_id, []);
    if (!partnerOf.has(row.person_b_id)) partnerOf.set(row.person_b_id, []);
    partnerOf.get(row.person_a_id)!.push(row.person_b_id);
    partnerOf.get(row.person_b_id)!.push(row.person_a_id);
  }

  const placed = new Set<string>();
  const result: PeoplePerson[] = [];

  const append = (p: PeoplePerson) => {
    if (placed.has(p.id)) return;
    placed.add(p.id);
    result.push(p);
  };

  const unplacedPartners = (p: PeoplePerson): PeoplePerson[] =>
    (partnerOf.get(p.id) ?? [])
      .map((id) => byId.get(id))
      .filter((x): x is PeoplePerson => x != null && !placed.has(x.id));

  const placeUnit = (p: PeoplePerson) => {
    if (placed.has(p.id)) return;
    for (const partner of unplacedPartners(p)) {
      const [left] = orderPartnerPair(partner, p);
      if (left.id === partner.id) placeUnit(partner);
    }
    append(p);
    for (const partner of unplacedPartners(p)) {
      append(partner);
    }
  };

  const seeds = [...rowPeople].sort((a, b) => {
    if (a.is_self) return -1;
    if (b.is_self) return 1;
    if (self) {
      const aSib = sharedBioParentIds(a, self);
      const bSib = sharedBioParentIds(b, self);
      if (aSib !== bSib) return aSib ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  for (const seed of seeds) {
    placeUnit(seed);
  }

  return result;
}
