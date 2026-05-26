/** Long-form date with year (member natal tab). */
export function formatBirthDateLong(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  try {
    const d = new Date(`${iso.trim()}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { dateStyle: "long" });
  } catch {
    return iso;
  }
}

/** Month and day only for friend profile display (no year). */
export function formatBirthMonthDay(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  try {
    const d = new Date(`${iso.trim()}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  } catch {
    return null;
  }
}
