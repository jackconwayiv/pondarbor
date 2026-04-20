export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const SHORT_WEEKDAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

/** Anchor used for the month UI: always the first day of the displayed month. */
export type MonthAnchor = { year: number; month: number };

export function monthAnchorFromDate(d: Date): MonthAnchor {
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function addMonths(anchor: MonthAnchor, offset: number): MonthAnchor {
  const total = anchor.month + offset;
  const year = anchor.year + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  return { year, month };
}

/**
 * Return the 42 (7 × 6) day cells to render for the given month.
 *
 * Each row starts on Sunday. The first cell is the Sunday on or before the
 * first of the month; the last cell is the Saturday 41 days later. Cells
 * outside the requested month carry `inMonth: false` so the grid can render
 * them muted while still allowing events that overlap the edges.
 */
export function monthGridDays(
  anchor: MonthAnchor,
): Array<{ date: Date; inMonth: boolean }> {
  const first = new Date(anchor.year, anchor.month, 1);
  const offset = first.getDay(); // 0 = Sunday
  const start = new Date(anchor.year, anchor.month, 1 - offset);
  const days: Array<{ date: Date; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push({ date: d, inMonth: d.getMonth() === anchor.month });
  }
  return days;
}

export function monthGridRangeIso(anchor: MonthAnchor): {
  start: string;
  end: string;
} {
  const days = monthGridDays(anchor);
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const start = new Date(
    first.getFullYear(),
    first.getMonth(),
    first.getDate(),
    0,
    0,
    0,
    0,
  );
  const end = new Date(
    last.getFullYear(),
    last.getMonth(),
    last.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Midnight-to-midnight UTC for an all-day event that starts on `d`. */
export function allDayUtcRangeForLocalDate(d: Date): { startUtc: Date; endUtc: Date } {
  const startUtc = new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0),
  );
  const endUtc = new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0),
  );
  return { startUtc, endUtc };
}

/** Yes, this event overlaps the calendar cell for `day`. */
export function eventOverlapsDay(
  eventStart: Date,
  eventEnd: Date,
  day: Date,
): boolean {
  const dayStart = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    0,
    0,
    0,
    0,
  );
  const dayEnd = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  return eventStart < dayEnd && eventEnd > dayStart;
}

export function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatMonthLabel(anchor: MonthAnchor): string {
  return `${MONTH_NAMES[anchor.month]} ${anchor.year}`;
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimeRange(
  startIso: string,
  endIso: string,
  allDay: boolean,
): string {
  if (allDay) return "All day";
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay = sameLocalDay(start, end);
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  const dateOpts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  if (sameDay) {
    return `${start.toLocaleTimeString(undefined, timeOpts)} – ${end.toLocaleTimeString(undefined, timeOpts)}`;
  }
  return `${start.toLocaleString(undefined, dateOpts)} – ${end.toLocaleString(undefined, dateOpts)}`;
}
