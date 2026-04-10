import type { Meal } from "./types";

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function dayColumnOrder(weekStartsOn: number): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
}

export function mealLabel(m: Meal): string {
  const title = (m.title ?? "").trim();
  if (title) return title.length > 48 ? `${title.slice(0, 48)}…` : title;
  const b = (m.blurb ?? "").trim();
  if (b) return b.length > 48 ? `${b.slice(0, 48)}…` : b;
  return `Meal #${m.id}`;
}
