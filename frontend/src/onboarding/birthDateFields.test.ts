import { describe, expect, it } from "vitest";

import {
  birthDateMeetsMinAge,
  composeIsoBirthDate,
  maxDaysInBirthMonth,
  parseIsoBirthDate,
} from "./birthDateFields";

describe("birthDateFields", () => {
  it("parses and composes ISO birth dates", () => {
    expect(parseIsoBirthDate("1990-05-17")).toEqual({
      year: "1990",
      month: "5",
      day: "17",
    });
    expect(
      composeIsoBirthDate({ year: "1990", month: "5", day: "17" }),
    ).toBe("1990-05-17");
  });

  it("limits days by month and year", () => {
    expect(maxDaysInBirthMonth("2", "2024")).toBe(29);
    expect(maxDaysInBirthMonth("2", "2023")).toBe(28);
    expect(composeIsoBirthDate({ year: "2023", month: "2", day: "29" })).toBeNull();
  });

  it("requires users to be at least 18", () => {
    const today = new Date(2026, 5, 11);
    expect(birthDateMeetsMinAge("2008-06-11", 18, today)).toBe(true);
    expect(birthDateMeetsMinAge("2008-06-12", 18, today)).toBe(false);
    expect(birthDateMeetsMinAge("2010-01-01", 18, today)).toBe(false);
  });
});
