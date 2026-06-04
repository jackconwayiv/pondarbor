import { describe, expect, it } from "vitest";

import {
  formatEntryDayLabel,
  formatMonthTabLabel,
  formatPlaylistBrowseLabel,
  formatPlaylistUserLabel,
  monthKey,
  monthPlayerTitle,
  parseMonthKey,
  possessiveDisplayName,
} from "./playlistBrowseLabel";

describe("formatPlaylistBrowseLabel", () => {
  it("formats month year name and count", () => {
    const label = formatPlaylistBrowseLabel(2025, 10, "Jane Doe", 31);
    expect(label).toContain("Jane Doe");
    expect(label).toContain("(31)");
    expect(label).toMatch(/'25/);
  });
});

describe("monthKey", () => {
  it("pads month", () => {
    expect(monthKey(2026, 3)).toBe("2026-03");
    expect(parseMonthKey("2026-03")).toEqual({ year: 2026, month: 3 });
  });
});

describe("formatMonthTabLabel", () => {
  it("formats short month and year", () => {
    expect(formatMonthTabLabel(2025, 10)).toMatch(/'25/);
  });
});

describe("formatPlaylistUserLabel", () => {
  it("formats name and count", () => {
    expect(formatPlaylistUserLabel("Jane", 5)).toBe("Jane (5)");
  });
});

describe("monthPlayerTitle", () => {
  it("formats possessive name month year playlist", () => {
    expect(monthPlayerTitle(2026, 4, "Jane Doe")).toMatch(/Jane Doe's/);
    expect(monthPlayerTitle(2026, 4, "Jane Doe")).toMatch(/2026/);
    expect(monthPlayerTitle(2026, 4, "Jane Doe")).toMatch(/Playlist$/);
  });
});

describe("possessiveDisplayName", () => {
  it("uses apostrophe only for names ending in s", () => {
    expect(possessiveDisplayName("James")).toBe("James'");
    expect(possessiveDisplayName("Jane")).toBe("Jane's");
  });
});

describe("formatEntryDayLabel", () => {
  it("formats iso date as m/d", () => {
    expect(formatEntryDayLabel("2026-04-12")).toBe("4/12");
  });
});
