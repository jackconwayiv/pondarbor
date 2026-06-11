/**
 * Preset meal-slot names for Meal Maestro. Must match backend `ALLOWED_MEAL_SLOT_NAMES`
 * in `backend/users/serializers.py`.
 */
export const MEAL_SLOT_NAME_OPTIONS = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Brunch",
  "Snack",
  "Supper",
  "Second breakfast",
  "Happy hour",
] as const;

export type MealSlotNameOption = (typeof MEAL_SLOT_NAME_OPTIONS)[number];

export const MEAL_SLOT_LABEL_MAX_LEN = 64;

export function normalizeMealSlotLabel(raw: string): string {
  return raw.trim().slice(0, MEAL_SLOT_LABEL_MAX_LEN);
}

const DEFAULTS: Record<number, readonly string[]> = {
  1: ["Breakfast"],
  2: ["Brunch", "Dinner"],
  3: ["Breakfast", "Lunch", "Dinner"],
  4: ["Breakfast", "Lunch", "Snack", "Dinner"],
  5: ["Breakfast", "Snack", "Lunch", "Snack", "Dinner"],
};

export function defaultSlotLabelsForCount(n: number): string[] {
  const d = DEFAULTS[n];
  if (d) return [...d];
  return Array.from({ length: n }, (_, i) => `Slot ${i + 1}`);
}

function isValidCustomRow(n: number, labels: string[]): boolean {
  if (labels.length !== n) return false;
  return labels.every((s) => {
    const t = normalizeMealSlotLabel(s);
    return t.length > 0;
  });
}

/**
 * Resolved labels for a template/instance with `slotsPerDay` (1–5).
 * `stored` is `profile.meal_slot_labels` from the API (keys "1"…"5").
 */
export function resolveSlotLabels(
  slotsPerDay: number,
  stored: Record<string, string[]> | null | undefined,
): string[] {
  const n = Math.max(1, Math.min(5, slotsPerDay));
  const key = String(n);
  const custom = stored?.[key];
  if (custom && isValidCustomRow(n, custom)) {
    return custom.slice();
  }
  return defaultSlotLabelsForCount(n);
}
