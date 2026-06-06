/** User-facing labels for goal kinds (keep in sync across modals, cards, nav). */
export const GOAL_KIND_CONTINUOUS_LABEL = "Goal";
export const GOAL_KIND_CHORE_LABEL = "Chore";
export const GOAL_KIND_ONE_TIME_LABEL = "Project";

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? "—";
}

export function ordinalDay(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
