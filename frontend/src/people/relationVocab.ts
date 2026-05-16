/** Mirrors backend `people/relation_vocab.py` for form validation and labels. */

export const RELATION_PREFIX_TOKENS: { value: string; label: string }[] = [
  { value: "great", label: "Great" },
  { value: "step", label: "Step" },
  { value: "half", label: "Half" },
  { value: "adopted", label: "Adopted" },
  { value: "adoptive", label: "Adoptive" },
  { value: "distant", label: "Distant" },
  { value: "god", label: "God" },
  { value: "younger", label: "Younger" },
  { value: "older", label: "Older" },
  { value: "foster", label: "Foster" },
  { value: "twin", label: "Twin" },
  { value: "triplet", label: "Triplet" },
];

export const RELATION_CORE_SELF = { value: "self", label: "Self" } as const;

export const RELATION_CORE_OPTIONS: { value: string; label: string }[] = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "brother", label: "Brother" },
  { value: "sister", label: "Sister" },
  { value: "child", label: "Child" },
  { value: "son", label: "Son" },
  { value: "daughter", label: "Daughter" },
  { value: "aunt", label: "Aunt" },
  { value: "uncle", label: "Uncle" },
  { value: "niece", label: "Niece" },
  { value: "nephew", label: "Nephew" },
  { value: "cousin", label: "Cousin" },
  { value: "spouse", label: "Spouse" },
  { value: "partner", label: "Partner" },
  { value: "significant_other", label: "Significant other" },
  { value: "grandpa", label: "Grandpa" },
  { value: "grandma", label: "Grandma" },
  { value: "friend", label: "Friend" },
  { value: "pet", label: "Pet" },
];

export function relationCoreSelectOptions(currentCore: string): { value: string; label: string }[] {
  if (currentCore === "self") {
    return [RELATION_CORE_SELF, ...RELATION_CORE_OPTIONS];
  }
  return RELATION_CORE_OPTIONS;
}

export function labelForRelationCore(core: string): string {
  if (core === "self") return RELATION_CORE_SELF.label;
  return RELATION_CORE_OPTIONS.find((o) => o.value === core)?.label ?? core;
}
