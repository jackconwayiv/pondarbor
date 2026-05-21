import type { PeoplePerson } from "./types";

/** Shared add/edit form state for PeoplePage and the setup wizard. */
export type PersonFormState = {
  name: string;
  core: string;
  alias: string;
  prefix: string[];
  suffix: string[];
  birth: string;
  death: string;
  gender: string;
  imageKey: string;
  imageUrl: string;
  mother: string;
  father: string;
  stepMother: string;
  stepFather: string;
  partnerOther: string;
  guardian: string;
};

export function emptyPersonForm(overrides: Partial<PersonFormState> = {}): PersonFormState {
  return {
    name: "",
    core: "cousin",
    alias: "",
    prefix: [],
    suffix: [],
    birth: "",
    death: "",
    gender: "",
    imageKey: "",
    imageUrl: "",
    mother: "",
    father: "",
    stepMother: "",
    stepFather: "",
    partnerOther: "",
    guardian: "",
    ...overrides,
  };
}

export function personToFormState(p: PeoplePerson): PersonFormState {
  return {
    name: p.name,
    core: p.relation_core,
    alias: p.relation_alias || "",
    prefix: [...(p.relation_prefix_tokens || [])],
    suffix: [...(p.relation_suffix_tokens || [])],
    birth: p.birthday || "",
    death: p.death_date || "",
    gender: p.gender || "",
    imageKey: p.image_key || "",
    imageUrl: p.image_url || "",
    mother: p.bio_mother_id || "",
    father: p.bio_father_id || "",
    stepMother: p.step_mother_id || "",
    stepFather: p.step_father_id || "",
    partnerOther: "",
    guardian: "",
  };
}

export function applyPersonFormField<K extends keyof PersonFormState>(
  prev: PersonFormState,
  key: K,
  value: PersonFormState[K],
): PersonFormState {
  const next = { ...prev, [key]: value };
  if (key === "core" && value !== "friend" && prev.suffix.includes("best")) {
    next.suffix = prev.suffix.filter((t) => t !== "best");
  }
  if (
    key === "core" &&
    (value === "mother" || value === "father") &&
    value !== prev.core
  ) {
    next.mother = "";
    next.father = "";
  }
  return next;
}
