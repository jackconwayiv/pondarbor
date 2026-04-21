import { describe, expect, it } from "vitest";

import {
  addMonths,
  eventCoversDay,
  formatMonthLabel,
  isoDateForLocalDay,
  monthGridDateRange,
  monthGridDays,
} from "./monthMath";

describe("addMonths", () => {
  it("advances across year boundaries", () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({
      year: 2027,
      month: 0,
    });
  });
  it("goes backward across year boundaries", () => {
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({
      year: 2025,
      month: 11,
    });
  });
  it("handles large offsets", () => {
    expect(addMonths({ year: 2020, month: 5 }, 25)).toEqual({
      year: 2022,
      month: 6,
    });
  });
});

describe("monthGridDays", () => {
  it("returns 42 cells starting on a Sunday", () => {
    const days = monthGridDays({ year: 2026, month: 3 }); // April 2026: first day is a Wed
    expect(days).toHaveLength(42);
    expect(days[0].date.getDay()).toBe(0);
    expect(days[days.length - 1].date.getDay()).toBe(6);
  });

  it("flags days outside the target month", () => {
    const days = monthGridDays({ year: 2026, month: 3 });
    const outside = days.filter((d) => !d.inMonth);
    expect(outside.length).toBeGreaterThan(0);
    for (const cell of outside) {
      expect(cell.date.getMonth()).not.toBe(3);
    }
  });
});

describe("monthGridDateRange", () => {
  it("returns ISO dates for the first and last grid cells (inclusive)", () => {
    const { start, end } = monthGridDateRange({ year: 2026, month: 3 });
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // 42 cells = 41 days between first and last.
    const startMs = Date.parse(`${start}T00:00:00Z`);
    const endMs = Date.parse(`${end}T00:00:00Z`);
    expect(endMs - startMs).toBe(41 * 24 * 60 * 60 * 1000);
  });
});

describe("eventCoversDay", () => {
  it("returns true when the day is within an event range (inclusive)", () => {
    expect(eventCoversDay("2026-04-10", "2026-04-12", "2026-04-10")).toBe(true);
    expect(eventCoversDay("2026-04-10", "2026-04-12", "2026-04-11")).toBe(true);
    expect(eventCoversDay("2026-04-10", "2026-04-12", "2026-04-12")).toBe(true);
  });

  it("returns false when the day is outside the range", () => {
    expect(eventCoversDay("2026-04-10", "2026-04-12", "2026-04-09")).toBe(false);
    expect(eventCoversDay("2026-04-10", "2026-04-12", "2026-04-13")).toBe(false);
  });
});

describe("isoDateForLocalDay", () => {
  it("formats local-time dates to YYYY-MM-DD", () => {
    expect(isoDateForLocalDay(new Date(2026, 3, 5))).toBe("2026-04-05");
    expect(isoDateForLocalDay(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("formatMonthLabel", () => {
  it("prints month name and year", () => {
    expect(formatMonthLabel({ year: 2026, month: 3 })).toBe("April 2026");
  });
});
