import { defaultSlotLabelsForCount } from "./mealSlotLabels";

type PatchProfile = (body: {
  meal_slots_per_day?: number;
  meal_slot_labels?: Record<string, string[]>;
}) => Promise<unknown>;

/** Update visible slot count; when adding a row, seed default meal time names for the new count. */
export async function patchMealSlotsPerDay(
  patchMyProfile: PatchProfile,
  next: number,
  current: number,
): Promise<void> {
  const n = Math.max(1, Math.min(5, next));
  if (n > current) {
    await patchMyProfile({
      meal_slots_per_day: n,
      meal_slot_labels: { [String(n)]: defaultSlotLabelsForCount(n) },
    });
    return;
  }
  await patchMyProfile({ meal_slots_per_day: n });
}
