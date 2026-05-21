import { describe, expect, it } from "vitest";

import {
  encodePartialDate,
  formatPartialDateDisplay,
  parsePartialDate,
} from "./partialDate";

describe("partialDate", () => {
  it("round-trips full date", () => {
    expect(encodePartialDate({ month: "5", day: "15", year: "2000" })).toBe("2000-05-15");
    expect(parsePartialDate("2000-05-15")).toEqual({ year: "2000", month: "5", day: "15" });
  });

  it("encodes month-day without year", () => {
    expect(encodePartialDate({ month: "12", day: "3", year: "" })).toBe("12-03");
    expect(formatPartialDateDisplay("12-03")).toBe("December 3");
  });

  it("formats full date for display", () => {
    expect(formatPartialDateDisplay("2000-05-15")).toBe("May 15, 2000");
  });
});
