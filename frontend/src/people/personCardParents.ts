import type { PeopleGraphBundle, PeoplePerson } from "./types";

export type PersonParentsLine =
  | { kind: "my-parents"; text: string }
  | { kind: "their-parents"; text: string };

export function personParentsLine(
  person: PeoplePerson,
  bundle: PeopleGraphBundle,
): PersonParentsLine | null {
  const motherName = person.bio_mother_id
    ? bundle.people.find((p) => p.id === person.bio_mother_id)?.name
    : null;
  const fatherName = person.bio_father_id
    ? bundle.people.find((p) => p.id === person.bio_father_id)?.name
    : null;
  if (!motherName && !fatherName) return null;

  const parts = [motherName, fatherName].filter(Boolean).join(", ");
  return {
    kind: person.is_self ? "my-parents" : "their-parents",
    text: parts,
  };
}
