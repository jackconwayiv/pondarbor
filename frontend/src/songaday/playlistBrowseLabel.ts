export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(key: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{1,2})$/.exec(key.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

/** `Oct '25` for month tab labels. */
export function formatMonthTabLabel(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  const mon = d.toLocaleDateString(undefined, { month: "short" });
  const yy = year % 100;
  return `${mon} '${String(yy).padStart(2, "0")}`;
}

/** `Jane Doe (31)` when month is selected in the tabber. */
export function formatPlaylistUserLabel(displayName: string, submissionCount: number): string {
  return `${displayName} (${submissionCount})`;
}

/** `Oct '25 Jane Doe (31)` for browse playlist rows (full label). */
export function formatPlaylistBrowseLabel(
  year: number,
  month: number,
  displayName: string,
  submissionCount: number,
): string {
  return `${formatMonthTabLabel(year, month)} ${formatPlaylistUserLabel(displayName, submissionCount)}`;
}

export function monthPlayerTitle(year: number, month: number, displayName: string): string {
  const d = new Date(year, month - 1, 1);
  const monYear = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return `${monYear} — ${displayName}`;
}

export function formatEntryDayLabel(entryDate: string): string {
  const parts = entryDate.split("-");
  if (parts.length !== 3) return entryDate;
  const m = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(m) || !Number.isFinite(day)) return entryDate;
  return `${m}/${day}`;
}
