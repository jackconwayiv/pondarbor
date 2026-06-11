import type { Meal } from "./types";

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Monday=0 … Sunday=6 (matches `meal_week_starts_on` / Python `date.weekday()`). */
export const WEEKDAY_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function dayColumnOrder(weekStartsOn: number): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
}

export function mealPlanSlotSummary(
  meal: Pick<Meal, "upcoming_slot_count" | "past_slot_count">,
): string | null {
  const parts: string[] = [];
  const upcoming = meal.upcoming_slot_count ?? 0;
  const past = meal.past_slot_count ?? 0;
  if (upcoming > 0) parts.push(`Upcoming: ${upcoming}`);
  if (past > 0) parts.push(`Past: ${past}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function mealLabel(m: Meal): string {
  const title = (m.title ?? "").trim();
  if (title) return title.length > 48 ? `${title.slice(0, 48)}…` : title;
  const b = (m.blurb ?? "").trim();
  if (b) return b.length > 48 ? `${b.slice(0, 48)}…` : b;
  return `Meal #${m.id}`;
}
