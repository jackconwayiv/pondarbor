/** Stored values: ``YYYY-MM-DD`` or ``MM-DD`` when year is unknown. */

export type PartialDateParts = {
  month: string;
  day: string;
  year: string;
};

const MONTH_NAMES = [
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

export function daysInMonth(month: number, year: number | null): number {
  if (month < 1 || month > 12) return 31;
  if (year != null && year > 0) {
    return new Date(year, month, 0).getDate();
  }
  if (month === 2) return 29;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

export function parsePartialDate(value: string | null | undefined): PartialDateParts {
  const raw = (value ?? "").trim();
  if (!raw) return { month: "", day: "", year: "" };
  const parts = raw.split("-").map((p) => p.trim());
  if (parts.length === 3) {
    return {
      year: parts[0] ?? "",
      month: parts[1]?.replace(/^0+/, "") || parts[1] || "",
      day: parts[2]?.replace(/^0+/, "") || parts[2] || "",
    };
  }
  if (parts.length === 2) {
    return {
      year: "",
      month: parts[0]?.replace(/^0+/, "") || parts[0] || "",
      day: parts[1]?.replace(/^0+/, "") || parts[1] || "",
    };
  }
  return { month: "", day: "", year: "" };
}

export function encodePartialDate(parts: PartialDateParts): string {
  const month = Number.parseInt(parts.month, 10);
  const day = Number.parseInt(parts.day, 10);
  if (!Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12) {
    return "";
  }
  const maxDay = daysInMonth(month, parts.year.trim() ? Number.parseInt(parts.year, 10) : null);
  if (day < 1 || day > maxDay) return "";

  const monthStr = String(month).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");
  const yearStr = parts.year.trim();
  if (yearStr) {
    const year = Number.parseInt(yearStr, 10);
    if (!Number.isFinite(year) || year < 1 || year > 9999) return "";
    return `${String(year).padStart(4, "0")}-${monthStr}-${dayStr}`;
  }
  return `${monthStr}-${dayStr}`;
}

export function formatPartialDateDisplay(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const { month, day, year } = parsePartialDate(raw);
  const monthNum = Number.parseInt(month, 10);
  const dayNum = Number.parseInt(day, 10);
  if (!Number.isFinite(monthNum) || !Number.isFinite(dayNum)) return raw;
  const monthName = MONTH_NAMES[monthNum - 1];
  if (!monthName) return raw;
  if (year.trim()) return `${monthName} ${dayNum}, ${year.trim()}`;
  return `${monthName} ${dayNum}`;
}

export function normalizePartialDateForApi(value: string | null | undefined): string | null {
  const encoded = encodePartialDate(parsePartialDate(value ?? ""));
  return encoded || null;
}
