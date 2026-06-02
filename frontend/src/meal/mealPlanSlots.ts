const MIN_SLOTS = 1;
const MAX_SLOTS = 5;

export function profileMealSlotsPerDay(profile: { meal_slots_per_day?: number } | undefined): number {
  const n = profile?.meal_slots_per_day;
  if (typeof n === "number" && n >= MIN_SLOTS && n <= MAX_SLOTS) return n;
  return 3;
}

export function defaultPlanSlots(slotsPerDay: number) {
  const out: { day_index: number; slot_index: number; meal_ids: number[] }[] = [];
  for (let d = 0; d < 7; d++) {
    for (let s = 0; s < slotsPerDay; s++) {
      out.push({ day_index: d, slot_index: s, meal_ids: [] });
    }
  }
  return out;
}

export function mergedPlanSlots(
  slotsPerDay: number,
  source: { day_index: number; slot_index: number; meal_ids: number[] }[],
) {
  const out = defaultPlanSlots(slotsPerDay);
  for (const row of source) {
    const idx = out.findIndex((x) => x.day_index === row.day_index && x.slot_index === row.slot_index);
    if (idx >= 0) out[idx] = { ...out[idx], meal_ids: row.meal_ids.slice() };
  }
  return out;
}
