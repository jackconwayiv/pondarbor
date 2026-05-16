import type { PeoplePerson } from "./types";

/** Minimal valid `PeoplePerson` for unit tests. */
export function testPerson(
  id: string,
  overrides: Partial<PeoplePerson> = {},
): PeoplePerson {
  return {
    id,
    name: id,
    image_key: "",
    image_url: "",
    relation_prefix_tokens: [],
    relation_core: "cousin",
    relation_suffix_tokens: [],
    relation_alias: "",
    birthday: null,
    death_date: null,
    gender: null,
    is_self: false,
    bio_mother_id: null,
    bio_father_id: null,
    step_mother_id: null,
    step_father_id: null,
    partnerships: [],
    guardian_links: [],
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}
