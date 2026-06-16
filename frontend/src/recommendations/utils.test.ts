import { describe, expect, it } from "vitest";
import { formatEditedAt, formatRecommendationDate } from "./utils";

describe("formatRecommendationDate", () => {
  it("formats YYYY-MM-DD as MM/DD/YY", () => {
    expect(formatRecommendationDate("2026-03-15")).toBe("03/15/26");
    expect(formatRecommendationDate("2026-04-06")).toBe("04/06/26");
  });

  it("formats ISO datetimes as MM/DD/YY in local time", () => {
    const formatted = formatRecommendationDate("2026-03-15T18:30:00.000Z");
    expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{2}$/);
  });
});

describe("formatEditedAt", () => {
  it("prefixes formatted date with Edited", () => {
    expect(formatEditedAt("2026-03-15")).toBe("Edited 03/15/26");
  });
});
