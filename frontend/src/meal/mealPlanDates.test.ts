import { describe, expect, it } from "vitest";

import {
  dayIndexInInstance,
  formatWeekStartShort,
  instanceCoveringDate,
  localDateIso,
  parseLocalDate,
  startOfLocalDay,
} from "./mealPlanDates";
import type { MealPlanInstance } from "./types";

function instance(weekStart: string, id = 1): MealPlanInstance {
  return {
    id,
    owner_user: 1,
    source_template: null,
    week_start: weekStart,
    slots: [],
    created_at: "",
    updated_at: "",
  };
}

describe("parseLocalDate", () => {
  it("parses YYYY-MM-DD as local midnight", () => {
    const d = parseLocalDate("2026-04-09");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(9);
  });
});

describe("startOfLocalDay", () => {
  it("strips time components", () => {
    const d = new Date(2026, 3, 9, 15, 30, 45);
    const s = startOfLocalDay(d);
    expect(s.getHours()).toBe(0);
    expect(s.getMinutes()).toBe(0);
    expect(s.getSeconds()).toBe(0);
    expect(s.getDate()).toBe(9);
  });
});

describe("localDateIso", () => {
  it("formats a known local calendar date", () => {
    const d = new Date(2026, 3, 9);
    expect(localDateIso(d)).toBe("2026-04-09");
  });
});

describe("formatWeekStartShort", () => {
  it("formats valid ISO to MM/DD/YY", () => {
    expect(formatWeekStartShort("2026-04-06")).toBe("04/06/26");
  });

  it("returns original string when parts are not numeric", () => {
    expect(formatWeekStartShort("not-a-date")).toBe("not-a-date");
  });
});

describe("instanceCoveringDate", () => {
  it("returns the instance whose week range contains the day", () => {
    const inst = instance("2026-04-06");
    const day = new Date(2026, 3, 9);
    expect(instanceCoveringDate([inst], day)).toBe(inst);
  });

  it("returns null when no instance covers the day", () => {
    const inst = instance("2026-04-06");
    const before = new Date(2026, 3, 4);
    const after = new Date(2026, 3, 14);
    expect(instanceCoveringDate([inst], before)).toBeNull();
    expect(instanceCoveringDate([inst], after)).toBeNull();
  });

  it("includes week start and end days (7-day window)", () => {
    const inst = instance("2026-04-06");
    expect(instanceCoveringDate([inst], new Date(2026, 3, 6))).toBe(inst);
    expect(instanceCoveringDate([inst], new Date(2026, 3, 12))).toBe(inst);
  });
});

describe("dayIndexInInstance", () => {
  it("returns 0 on week start and 6 on last day", () => {
    const inst = instance("2026-04-06");
    expect(dayIndexInInstance(inst, new Date(2026, 3, 6))).toBe(0);
    expect(dayIndexInInstance(inst, new Date(2026, 3, 12))).toBe(6);
  });

  it("returns null outside the week", () => {
    const inst = instance("2026-04-06");
    expect(dayIndexInInstance(inst, new Date(2026, 3, 5))).toBeNull();
    expect(dayIndexInInstance(inst, new Date(2026, 3, 13))).toBeNull();
  });
});
