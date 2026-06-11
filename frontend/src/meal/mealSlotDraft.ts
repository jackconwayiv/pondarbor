import { defaultSlotLabelsForCount } from "./mealSlotLabels";

export function slotDraftFromProfile(
  raw: Record<string, string[]> | null | undefined,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const n of [1, 2, 3, 4, 5] as const) {
    const key = String(n);
    const custom = raw?.[key];
    if (custom && custom.length === n) {
      out[key] = [...custom];
    } else {
      out[key] = defaultSlotLabelsForCount(n);
    }
  }
  return out;
}
