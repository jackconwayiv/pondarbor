import { describe, expect, it } from "vitest";

import {
  buildBusyBarsForDay,
  buildDayBusySections,
  busyLabelForEvent,
} from "./calendarBusyBars";
import type { CalendarEvent } from "./types";

function event(
  overrides: Partial<CalendarEvent> & Pick<CalendarEvent, "owner" | "source_id">,
): CalendarEvent {
  return {
    id: overrides.id ?? 1,
    source_display_name: overrides.source_display_name ?? "Travel",
    source_type: overrides.source_type ?? "ical",
    is_manual: overrides.is_manual ?? false,
    title: overrides.title ?? null,
    start_date: overrides.start_date ?? "2026-05-10",
    end_date: overrides.end_date ?? "2026-05-10",
    ...overrides,
  };
}

describe("busyLabelForEvent", () => {
  it("uses owner display name when preference is off", () => {
    const ev = event({
      owner: {
        id: 1,
        display_name: "Alice",
        avatar_url: "",
      },
      source_id: 10,
      source_display_name: "Travel",
    });
    expect(busyLabelForEvent(ev)).toBe("Alice");
  });

  it("prefixes source name when preference is on", () => {
    const ev = event({
      owner: {
        id: 1,
        display_name: "Alice",
        avatar_url: "",
        calendar_display_source_names: true,
      },
      source_id: 10,
      source_display_name: "Travel",
    });
    expect(busyLabelForEvent(ev)).toBe("Alice: Travel");
  });
});

describe("buildBusyBarsForDay", () => {
  it("collapses multiple events per owner when preference is off", () => {
    const owner = {
      id: 1,
      display_name: "Alice",
      avatar_url: "",
    };
    const bars = buildBusyBarsForDay(
      [
        event({ id: 1, owner, source_id: 10, source_display_name: "Travel" }),
        event({ id: 2, owner, source_id: 11, source_display_name: "Work" }),
      ],
      new Set([1]),
      [1],
    );
    expect(bars).toHaveLength(1);
    expect(bars[0]?.label).toBe("Alice");
  });

  it("emits one bar per source when preference is on", () => {
    const owner = {
      id: 1,
      display_name: "Alice",
      avatar_url: "",
      calendar_display_source_names: true,
    };
    const bars = buildBusyBarsForDay(
      [
        event({ id: 1, owner, source_id: 10, source_display_name: "Travel" }),
        event({ id: 2, owner, source_id: 11, source_display_name: "Work" }),
      ],
      new Set([1]),
      [1],
    );
    expect(bars.map((bar) => bar.label)).toEqual(["Alice: Travel", "Alice: Work"]);
  });

  it("orders owners by checked list and sources alphabetically", () => {
    const alice = {
      id: 1,
      display_name: "Alice",
      avatar_url: "",
      calendar_display_source_names: true,
    };
    const bob = {
      id: 2,
      display_name: "Bob",
      avatar_url: "",
    };
    const bars = buildBusyBarsForDay(
      [
        event({ id: 1, owner: alice, source_id: 10, source_display_name: "Work" }),
        event({ id: 2, owner: alice, source_id: 11, source_display_name: "Travel" }),
        event({ id: 3, owner: bob, source_id: 20, source_display_name: "Family" }),
      ],
      new Set([1, 2]),
      [2, 1],
    );
    expect(bars.map((bar) => bar.label)).toEqual([
      "Bob",
      "Alice: Travel",
      "Alice: Work",
    ]);
  });
});

describe("buildDayBusySections", () => {
  it("groups day events by source when preference is on", () => {
    const owner = {
      id: 1,
      display_name: "Alice",
      avatar_url: "",
      calendar_display_source_names: true,
    };
    const sections = buildDayBusySections(
      [
        event({ id: 1, owner, source_id: 10, source_display_name: "Travel" }),
        event({ id: 2, owner, source_id: 11, source_display_name: "Work" }),
      ],
      [1],
    );
    expect(sections).toHaveLength(2);
    expect(sections[0]?.events).toHaveLength(1);
    expect(sections[0]?.label).toBe("Alice: Travel");
  });
});
