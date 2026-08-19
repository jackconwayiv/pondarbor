import { Box, SimpleGrid, Text } from "@chakra-ui/react";
import { useMemo } from "react";

import { APP_TEXT_SIZES } from "../theme/typography";
import { buildBusyBarsForDay } from "./calendarBusyBars";
import DayCell from "./DayCell";
import {
  SHORT_WEEKDAY_LABELS,
  isoDateForLocalDay,
  monthGridDays,
  parseIsoDate,
  type MonthAnchor,
} from "./monthMath";
import type { CalendarBirthdayRow, CalendarEvent } from "./types";

type Props = {
  anchor: MonthAnchor;
  events: CalendarEvent[];
  birthdays: CalendarBirthdayRow[];
  /** Currently checked user ids. */
  orderedCheckedUserIds: number[];
  /** People-list order used to assign stable colors. */
  colorUserIds?: number[];
  /** True when URL implies "all" (missing/users=all). */
  isDefaultAll?: boolean;
  onDayClick?: (date: Date) => void;
};

export default function MonthGrid({
  anchor,
  events,
  birthdays,
  orderedCheckedUserIds,
  colorUserIds = [],
  isDefaultAll,
  onDayClick,
}: Props) {
  const days = useMemo(() => monthGridDays(anchor), [anchor]);
  const effectiveOrderedCheckedUserIds = useMemo(() => {
    // On first visit, approvedUsers may still be loading, so orderedCheckedUserIds can be []
    // even though the URL implies "all". In that case, treat all event owners as checked.
    if (isDefaultAll && orderedCheckedUserIds.length === 0 && events.length > 0) {
      const ids = Array.from(new Set(events.map((e) => e.owner.id)));
      ids.sort((a, b) => a - b);
      return ids;
    }
    return orderedCheckedUserIds;
  }, [events, isDefaultAll, orderedCheckedUserIds]);
  const effectiveColorUserIds =
    colorUserIds.length > 0 ? colorUserIds : effectiveOrderedCheckedUserIds;

  const checkedSet = useMemo(
    () => new Set(effectiveOrderedCheckedUserIds),
    [effectiveOrderedCheckedUserIds],
  );
  const birthdayLabelsByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of birthdays) {
      const d = new Date(anchor.year, row.birth_month - 1, row.birth_day);
      if (
        d.getFullYear() !== anchor.year ||
        d.getMonth() !== row.birth_month - 1 ||
        d.getDate() !== row.birth_day
      ) {
        continue;
      }
      const iso = isoDateForLocalDay(d);
      const existing = map.get(iso) ?? [];
      existing.push(`🎂 ${row.display_name}`);
      map.set(iso, existing);
    }
    return map;
  }, [anchor.year, birthdays]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const dayIsos = days.map((cell) => isoDateForLocalDay(cell.date));
    const firstIso = dayIsos[0];
    const lastIso = dayIsos[dayIsos.length - 1];
    if (!firstIso || !lastIso) return map;
    for (const iso of dayIsos) map.set(iso, []);

    const rangeStart = parseIsoDate(firstIso);
    const rangeEnd = parseIsoDate(lastIso);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(0, 0, 0, 0);

    for (const ev of events) {
      if (!checkedSet.has(ev.owner.id)) continue;
      const eventStart = parseIsoDate(ev.start_date);
      const eventEnd = parseIsoDate(ev.end_date);
      eventStart.setHours(0, 0, 0, 0);
      eventEnd.setHours(0, 0, 0, 0);

      const spanStart = eventStart > rangeStart ? eventStart : rangeStart;
      const spanEnd = eventEnd < rangeEnd ? eventEnd : rangeEnd;
      if (spanEnd < spanStart) continue;

      const cursor = new Date(spanStart);
      while (cursor <= spanEnd) {
        const iso = isoDateForLocalDay(cursor);
        map.get(iso)?.push(ev);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return map;
  }, [days, events, checkedSet]);

  const busyBarsByDay = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildBusyBarsForDay>>();
    for (const [iso, dayEvents] of eventsByDay) {
      map.set(
        iso,
        buildBusyBarsForDay(
          dayEvents,
          checkedSet,
          effectiveOrderedCheckedUserIds,
        ),
      );
    }
    return map;
  }, [checkedSet, effectiveOrderedCheckedUserIds, eventsByDay]);

  return (
    <Box>
      <SimpleGrid columns={7} gap="1" mb="1">
        {SHORT_WEEKDAY_LABELS.map((label) => (
          <Text
            key={label}
            fontSize={APP_TEXT_SIZES.helper}
            fontWeight="semibold"
            textAlign="center"
            color="fg.muted"
          >
            {label}
          </Text>
        ))}
      </SimpleGrid>
      <SimpleGrid columns={7} gap="1">
        {days.map((cell) => {
          const iso = isoDateForLocalDay(cell.date);
          const busyBars = busyBarsByDay.get(iso) ?? [];
          return (
            <DayCell
              key={iso}
              date={cell.date}
              inMonth={cell.inMonth}
              birthdayLabels={birthdayLabelsByDay.get(iso) ?? []}
              busyBars={busyBars}
              orderedCheckedUserIds={effectiveOrderedCheckedUserIds}
              colorUserIds={effectiveColorUserIds}
              onCellClick={onDayClick}
            />
          );
        })}
      </SimpleGrid>
    </Box>
  );
}
