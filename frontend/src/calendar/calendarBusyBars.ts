import type { CalendarEvent } from "./types";

export type BusyBar = { key: string; ownerId: number; label: string };

export type DayBusySection = {
  key: string;
  ownerId: number;
  label: string;
  events: CalendarEvent[];
};

export function busyLabelForEvent(ev: CalendarEvent): string {
  const ownerName = ev.owner.display_name || "Busy";
  if (ev.owner.calendar_display_source_names) {
    return ev.source_display_name || ownerName;
  }
  return ownerName;
}

export function busyGroupKeyForEvent(ev: CalendarEvent): string {
  if (ev.owner.calendar_display_source_names) {
    return `source:${ev.source_id}`;
  }
  return `owner:${ev.owner.id}`;
}

function compareBusyBars(
  a: { ownerId: number; label: string },
  b: { ownerId: number; label: string },
  orderedCheckedUserIds: number[],
): number {
  const orderIndex = new Map(orderedCheckedUserIds.map((id, index) => [id, index]));
  const ai = orderIndex.get(a.ownerId) ?? Number.MAX_SAFE_INTEGER;
  const bi = orderIndex.get(b.ownerId) ?? Number.MAX_SAFE_INTEGER;
  if (ai !== bi) return ai - bi;
  return a.label.localeCompare(b.label);
}

export function buildBusyBarsForDay(
  events: CalendarEvent[],
  checkedOwnerIds: Set<number>,
  orderedCheckedUserIds: number[],
): BusyBar[] {
  const byKey = new Map<string, BusyBar>();
  for (const ev of events) {
    if (!checkedOwnerIds.has(ev.owner.id)) continue;
    const key = busyGroupKeyForEvent(ev);
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        ownerId: ev.owner.id,
        label: busyLabelForEvent(ev),
      });
    }
  }
  return Array.from(byKey.values()).sort((a, b) =>
    compareBusyBars(a, b, orderedCheckedUserIds),
  );
}

export function buildDayBusySections(
  eventsForDay: CalendarEvent[],
  orderedCheckedUserIds: number[],
): DayBusySection[] {
  const checkedSet = new Set(orderedCheckedUserIds);
  const sectionsByKey = new Map<string, DayBusySection>();
  for (const ev of eventsForDay) {
    if (!checkedSet.has(ev.owner.id)) continue;
    const key = busyGroupKeyForEvent(ev);
    let section = sectionsByKey.get(key);
    if (!section) {
      section = {
        key,
        ownerId: ev.owner.id,
        label: busyLabelForEvent(ev),
        events: [],
      };
      sectionsByKey.set(key, section);
    }
    section.events.push(ev);
  }
  return Array.from(sectionsByKey.values()).sort((a, b) =>
    compareBusyBars(a, b, orderedCheckedUserIds),
  );
}

export function uniqueBusyOwnerIds(
  events: CalendarEvent[],
  orderedCheckedUserIds: number[],
  isDefaultAll: boolean,
): number[] {
  const busySet = new Set(events.map((ev) => ev.owner.id));
  if (isDefaultAll && orderedCheckedUserIds.length === 0 && events.length > 0) {
    const ids = Array.from(busySet);
    ids.sort((a, b) => a - b);
    return ids;
  }
  return orderedCheckedUserIds.filter((id) => busySet.has(id));
}
