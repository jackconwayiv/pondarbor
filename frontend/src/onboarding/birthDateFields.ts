export const POND_ARBOR_MIN_AGE = 18;

export const POND_ARBOR_MIN_AGE_ERROR =
  "You must be 18 years or older to use Pond Arbor.";

export type BirthDateParts = {
  month: string;
  day: string;
  year: string;
};

export function parseIsoBirthDate(iso: string | null | undefined): BirthDateParts {
  const trimmed = (iso ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return { month: "", day: "", year: "" };
  }
  return {
    year: match[1],
    month: String(Number(match[2])),
    day: String(Number(match[3])),
  };
}

export function maxDaysInBirthMonth(month: string, year: string): number {
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12) return 31;
  if (!Number.isInteger(y) || y < 1) return 31;
  return new Date(y, m, 0).getDate();
}

export function composeIsoBirthDate(parts: BirthDateParts): string | null {
  const month = parts.month.trim();
  const day = parts.day.trim();
  const year = parts.year.trim();
  if (!month || !day || !year) return null;

  const m = Number(month);
  const d = Number(day);
  const y = Number(year);
  if (!Number.isInteger(m) || !Number.isInteger(d) || !Number.isInteger(y)) {
    return null;
  }

  const currentYear = new Date().getFullYear();
  if (y < 1900 || y > currentYear) return null;
  if (m < 1 || m > 12) return null;

  const maxDay = maxDaysInBirthMonth(month, year);
  if (d < 1 || d > maxDay) return null;

  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** True when the birth date is on or before the calendar day `minAge` years ago. */
export function birthDateMeetsMinAge(
  iso: string | null | undefined,
  minAge: number = POND_ARBOR_MIN_AGE,
  today: Date = new Date(),
): boolean {
  const trimmed = (iso ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return false;

  const birth = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  const cutoff = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  cutoff.setFullYear(cutoff.getFullYear() - minAge);
  return birth <= cutoff;
}
