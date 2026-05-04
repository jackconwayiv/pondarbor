import type {
  WhatIfQuestionAdmin,
  WhatIfQuestionListFilter,
} from "./api";

/** Mirrors backend GET /whatif/questions/?list_filter=… semantics. */
export function questionMatchesListFilter(
  q: WhatIfQuestionAdmin,
  f: WhatIfQuestionListFilter,
): boolean {
  if (q.deleted_at) return false;
  if (f === "all") return true;
  if (f === "rejected") return q.review_status === "rejected";
  if (f === "active") return q.is_active;
  if (f === "inactive") return !q.is_active;
  return true;
}

/** Apply a single updated row to the current filtered list without refetching the full list. */
export function mergeQuestionAfterMutation(
  prev: WhatIfQuestionAdmin[],
  updated: WhatIfQuestionAdmin,
  filter: WhatIfQuestionListFilter,
): WhatIfQuestionAdmin[] {
  const without = prev.filter((x) => x.id !== updated.id);
  if (!questionMatchesListFilter(updated, filter)) return without;
  return [updated, ...without];
}

/** Merge bulk-created rows into the list for the active filter. */
export function mergeBulkQuestionsIntoList(
  prev: WhatIfQuestionAdmin[],
  imported: WhatIfQuestionAdmin[],
  filter: WhatIfQuestionListFilter,
): WhatIfQuestionAdmin[] {
  const importedIds = new Set(imported.map((q) => q.id));
  const rest = prev.filter((q) => !importedIds.has(q.id));
  const head = imported.filter((q) => questionMatchesListFilter(q, filter));
  return [...head, ...rest];
}
