/** Stored prompts must include `{subject}`; this is the standard prefix staff/proposers extend. */
export const WHATIF_QUESTION_PROMPT_PREFIX = "What if {subject} ";

export function isStandardWhatIfPromptPrefix(full: string): boolean {
  return full === "" || full.startsWith(WHATIF_QUESTION_PROMPT_PREFIX);
}

export function promptSuffixFromStored(full: string): string {
  if (full.startsWith(WHATIF_QUESTION_PROMPT_PREFIX)) {
    return full.slice(WHATIF_QUESTION_PROMPT_PREFIX.length);
  }
  return full;
}

/** Builds the full prompt for the API from the suffix field, or preserves a pasted full prompt. */
export function storedPromptFromSuffix(suffix: string): string {
  if (suffix.length === 0) return "";
  const trimmed = suffix.trim();
  if (trimmed.startsWith("What if ") && trimmed.includes("{subject}")) {
    return suffix;
  }
  if (!trimmed) return "";
  return WHATIF_QUESTION_PROMPT_PREFIX + suffix;
}
