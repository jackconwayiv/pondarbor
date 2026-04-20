import { describe, expect, it } from "vitest";

import {
  addMonths,
  eventOverlapsDay,
  formatMonthLabel,
  monthGridDays,
  monthGridRangeIso,
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

describe("monthGridRangeIso", () => {
  it("spans from the first grid cell through the day after the last", () => {
    const { start, end } = monthGridRangeIso({ year: 2026, month: 3 });
    expect(new Date(end).getTime() - new Date(start).getTime()).toBe(
      42 * 24 * 60 * 60 * 1000,
    );
  });
});

describe("eventOverlapsDay", () => {
  it("returns true for events fully within the day", () => {
    const day = new Date(2026, 3, 10);
    const start = new Date(2026, 3, 10, 9, 0);
    const end = new Date(2026, 3, 10, 10, 0);
    expect(eventOverlapsDay(start, end, day)).toBe(true);
  });

  it("returns false for events that end before the day", () => {
    const day = new Date(2026, 3, 10);
    const start = new Date(2026, 3, 9, 9, 0);
    const end = new Date(2026, 3, 9, 10, 0);
    expect(eventOverlapsDay(start, end, day)).toBe(false);
  });

  it("returns true for multi-day events that cross this day", () => {
    const day = new Date(2026, 3, 10);
    const start = new Date(2026, 3, 8, 9, 0);
    const end = new Date(2026, 3, 12, 10, 0);
    expect(eventOverlapsDay(start, end, day)).toBe(true);
  });
});

describe("formatMonthLabel", () => {
  it("prints month name and year", () => {
    expect(formatMonthLabel({ year: 2026, month: 3 })).toBe("April 2026");
  });
});
