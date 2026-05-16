import type { PeoplePerson } from "./types";

export type PetLeashLink = { ownerId: string; petId: string };

/** Pets are labeled relation_core "pet" relative to the tree owner (self). */
export function computePetLeashLinks(people: PeoplePerson[]): PetLeashLink[] {
  const self = people.find((p) => p.is_self);
  if (!self) return [];

  return people
    .filter((p) => p.id !== self.id && p.relation_core === "pet")
    .map((pet) => ({ ownerId: self.id, petId: pet.id }));
}
