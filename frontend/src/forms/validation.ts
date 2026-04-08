/** Align with backend where applicable; otherwise safe UI caps. */

export const QUOTE_BODY_MAX_CHARS = 50_000;
export const QUOTE_LABEL_NAME_MAX = 255;

export const CLOSET_ITEM_NAME_MAX = 255;
export const CLOSET_CATEGORY_MAX = 120;
export const CLOSET_TEXT_SOFT_MAX = 20_000;
export const CLOSET_TAG_MAX = 80;

/** Join/host display names are further limited in UI; API allows 80. */
export const WHATIF_DISPLAY_NAME_MAX = 80;
export const WHATIF_BULK_TEXT_MAX = 500_000;
/** Matches WhatIfQuestion answer_* CharField. */
export const WHATIF_ANSWER_MAX = 255;
export const WHATIF_PROMPT_MAX = 20_000;

export function validateQuoteBody(trimmed: string): string | null {
  if (!trimmed) return "Quote body cannot be empty.";
  if (trimmed.length > QUOTE_BODY_MAX_CHARS) {
    return `Quote body must be at most ${QUOTE_BODY_MAX_CHARS} characters.`;
  }
  return null;
}

export function validateQuoteLabelNames(names: string[]): string | null {
  for (const n of names) {
    const t = n.trim();
    if (!t) return "Tag and attribution entries cannot be empty.";
    if (t.length > QUOTE_LABEL_NAME_MAX) {
      return `Each tag or attribution must be at most ${QUOTE_LABEL_NAME_MAX} characters.`;
    }
  }
  return null;
}

export function validateClosetItemName(trimmed: string): string | null {
  if (!trimmed) return "Name is required.";
  if (trimmed.length > CLOSET_ITEM_NAME_MAX) {
    return `Name must be at most ${CLOSET_ITEM_NAME_MAX} characters.`;
  }
  return null;
}

export function validateClosetCategory(trimmed: string): string | null {
  if (trimmed.length > CLOSET_CATEGORY_MAX) {
    return `Category must be at most ${CLOSET_CATEGORY_MAX} characters.`;
  }
  return null;
}

export function validateClosetFreeText(value: string, fieldLabel: string, max = CLOSET_TEXT_SOFT_MAX): string | null {
  if (value.length > max) {
    return `${fieldLabel} must be at most ${max} characters.`;
  }
  return null;
}

export function validateClosetTagList(tags: string[]): string | null {
  for (const t of tags) {
    const s = t.trim();
    if (s.length > CLOSET_TAG_MAX) {
      return `Each tag must be at most ${CLOSET_TAG_MAX} characters.`;
    }
  }
  return null;
}

export function validateIsoDateRequired(value: string, fieldLabel: string): string | null {
  const t = value.trim();
  if (!t) return `${fieldLabel} is required.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return `${fieldLabel} must be YYYY-MM-DD.`;
  return null;
}

export function validateWhatIfDisplayName(trimmed: string): string | null {
  if (!trimmed) return "Name is required.";
  if (trimmed.length > WHATIF_DISPLAY_NAME_MAX) {
    return `Name must be at most ${WHATIF_DISPLAY_NAME_MAX} characters.`;
  }
  return null;
}

export function validateWhatIfBulkText(text: string): string | null {
  if (text.length > WHATIF_BULK_TEXT_MAX) {
    return `Bulk text must be at most ${WHATIF_BULK_TEXT_MAX} characters.`;
  }
  return null;
}

export function validateWhatIfAnswerField(value: string, label: string): string | null {
  if (value.length > WHATIF_ANSWER_MAX) {
    return `${label} must be at most ${WHATIF_ANSWER_MAX} characters.`;
  }
  return null;
}

export function validateWhatIfPromptField(value: string): string | null {
  if (value.length > WHATIF_PROMPT_MAX) {
    return `Prompt must be at most ${WHATIF_PROMPT_MAX} characters.`;
  }
  return null;
}

export function validateWhatIfRoomCode4(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  if (t.length !== 4) {
    return "Room code must be exactly 4 characters.";
  }
  if (!/^[A-Z0-9]+$/.test(t)) {
    return "Room code must use only letters and numbers.";
  }
  return null;
}

export function validateWhatIfQuestionDraft(fields: {
  prompt: string;
  answer_1: string;
  answer_2: string;
  answer_3: string;
  answer_4: string;
  answer_5: string;
  answer_6: string;
}): string | null {
  const pErr = validateWhatIfPromptField(fields.prompt);
  if (pErr) return pErr;
  if (!fields.prompt.trim()) {
    return "Prompt is required.";
  }
  const answers: [string, string][] = [
    [fields.answer_1, "Answer 1"],
    [fields.answer_2, "Answer 2"],
    [fields.answer_3, "Answer 3"],
    [fields.answer_4, "Answer 4"],
    [fields.answer_5, "Answer 5"],
    [fields.answer_6, "Answer 6"],
  ];
  for (const [val, label] of answers) {
    const aErr = validateWhatIfAnswerField(val, label);
    if (aErr) return aErr;
  }
  return null;
}
