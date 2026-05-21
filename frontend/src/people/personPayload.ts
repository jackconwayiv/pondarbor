import { normalizePartialDateForApi } from "./partialDate";
import { isParentRelationCore } from "./parentSync";
import type { PersonFormState } from "./personFormState";
import type { PeoplePersonCreatePayload } from "./types";

export type { PersonFormState };

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
    birthday: normalizePartialDateForApi(form.birth),
    death_date: normalizePartialDateForApi(form.death),
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
