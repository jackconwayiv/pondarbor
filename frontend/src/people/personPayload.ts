import { isParentRelationCore } from "./parentSync";
import type { PeoplePersonCreatePayload } from "./types";

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
  mother: string;
  father: string;
  stepMother: string;
  stepFather: string;
};

function suffixTokensForCore(core: string, suffix: string[]): string[] {
  if (core === "friend") return suffix;
  return suffix.filter((t) => t !== "best");
}

export type PersonPayloadOptions = {
  /** Creating a Mother/Father-to-me row: parent links go on self, not the new person. */
  isCreate?: boolean;
  /** Self row: parent picks are stored on this person. */
  editingSelf?: boolean;
};

/** Build PATCH/POST body from form state (omits undefined optional fields). */
export function personPayloadFromForm(
  form: PersonFormState,
  options: PersonPayloadOptions = {},
): PeoplePersonCreatePayload {
  const imageKey = form.imageKey.trim();
  const skipTheirParents =
    options.isCreate && isParentRelationCore(form.core) && !options.editingSelf;

  return {
    name: form.name.trim(),
    relation_core: form.core,
    relation_alias: form.alias.trim(),
    relation_prefix_tokens: form.prefix,
    relation_suffix_tokens: suffixTokensForCore(form.core, form.suffix),
    birthday: form.birth || null,
    death_date: form.death || null,
    gender: form.gender || null,
    ...(imageKey ? { image_key: imageKey } : {}),
    ...(skipTheirParents
      ? {}
      : {
          bio_mother_id: form.mother || null,
          bio_father_id: form.father || null,
          step_mother_id: form.stepMother || null,
          step_father_id: form.stepFather || null,
        }),
  };
}
