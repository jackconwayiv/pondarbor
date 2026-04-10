import type { MealPlanInstance } from "./types";

/** Parse `YYYY-MM-DD` as a local calendar date (midnight). */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Today's date as `YYYY-MM-DD` in local time. */
export function localDateIso(d: Date = new Date()): string {
  const x = startOfLocalDay(d);
  const y = x.getFullYear();
  const mo = String(x.getMonth() + 1).padStart(2, "0");
  const da = String(x.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/**
 * Find a plan instance whose week contains `day` (inclusive of week start through +6 days).
 * `week_start` from the API is aligned to the user's week-start preference.
 */
export function instanceCoveringDate(
  instances: MealPlanInstance[],
  day: Date,
): MealPlanInstance | null {
  const t = startOfLocalDay(day).getTime();
  for (const inst of instances) {
    const ws = startOfLocalDay(parseLocalDate(inst.week_start)).getTime();
    const end = ws + 6 * 86400000;
    if (t >= ws && t <= end) return inst;
  }
  return null;
}

/** Day offset 0–6 within that instance’s week, or `null` if `day` is outside the instance range. */
export function dayIndexInInstance(inst: MealPlanInstance, day: Date): number | null {
  const ws = startOfLocalDay(parseLocalDate(inst.week_start)).getTime();
  const t = startOfLocalDay(day).getTime();
  const diff = Math.round((t - ws) / 86400000);
  if (diff < 0 || diff > 6) return null;
  return diff;
}

/** Display `YYYY-MM-DD` week start as MM/DD/YY (e.g. 04/06/26). */
export function formatWeekStartShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  const yy = String(y).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

/** e.g. "Thursday, April 9, 2026" in the user locale. */
export function formatLongCalendarDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
