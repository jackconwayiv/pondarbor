export type PeoplePartnershipRow = {
  id: string;
  person_a_id: string;
  person_b_id: string;
  status: "current" | "former";
  anniversary_date: string | null;
};

export type PeopleGuardianLinkRow = {
  id: string;
  child_id: string;
  guardian_id: string;
  note: string;
};

export type PeoplePersonPartnership = {
  id: string;
  other_person_id: string;
  status: "current" | "former";
  anniversary_date: string | null;
};

export type PeoplePerson = {
  id: string;
  name: string;
  image_key: string;
  image_url: string;
  relation_prefix_tokens: string[];
  relation_core: string;
  relation_suffix_tokens: string[];
  relation_alias: string;
  birthday: string | null;
  death_date: string | null;
  gender: string | null;
  is_self: boolean;
  bio_mother_id: string | null;
  bio_father_id: string | null;
  step_mother_id: string | null;
  step_father_id: string | null;
  partnerships: PeoplePersonPartnership[];
  guardian_links: { id: string; guardian_id: string; note: string }[];
  created_at: string;
  updated_at: string;
};

export type PeopleGraphBundle = {
  count: number;
  people: PeoplePerson[];
  partnerships: PeoplePartnershipRow[];
  guardian_links: PeopleGuardianLinkRow[];
};

export type PeoplePersonCreatePayload = {
  name: string;
  relation_core: string;
  relation_prefix_tokens?: string[];
  relation_suffix_tokens?: string[];
  relation_alias?: string;
  birthday?: string | null;
  death_date?: string | null;
  gender?: string | null;
  image_key?: string;
  bio_mother_id?: string | null;
  bio_father_id?: string | null;
  step_mother_id?: string | null;
  step_father_id?: string | null;
};

export type PeoplePersonPatchPayload = Partial<PeoplePersonCreatePayload>;
