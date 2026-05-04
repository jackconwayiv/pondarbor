import { Box, SimpleGrid, Text } from "@chakra-ui/react";
import { useMemo } from "react";

import { APP_TEXT_SIZES } from "../theme/typography";
import DayCell from "./DayCell";
import {
  SHORT_WEEKDAY_LABELS,
  isoDateForLocalDay,
  monthGridDays,
  parseIsoDate,
  type MonthAnchor,
} from "./monthMath";
import type { CalendarBirthdayRow, CalendarEvent, CalendarOwnerRow } from "./types";

type Props = {
  anchor: MonthAnchor;
  events: CalendarEvent[];
  birthdays: CalendarBirthdayRow[];
  /** Currently checked user ids, in the order they were checked. */
  orderedCheckedUserIds: number[];
  /** True when URL implies "all" (missing/users=all). */
  isDefaultAll?: boolean;
  /** Lookup table for displaying owner names on the day bars. */
  ownersById: Map<number, CalendarOwnerRow>;
  onDayClick?: (date: Date) => void;
};

export default function MonthGrid({
  anchor,
  events,
  birthdays,
  orderedCheckedUserIds,
  isDefaultAll,
  ownersById,
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

  /**
   * For each day cell ISO, the *unique* set of owner ids who are busy that
   * day, restricted to currently-checked users. Multiple events for the same
   * user on the same day collapse into one bar.
   */
  const busyOwnersByDay = useMemo(() => {
    const map = new Map<string, Set<number>>();
    const dayIsos = days.map((cell) => isoDateForLocalDay(cell.date));
    const firstIso = dayIsos[0];
    const lastIso = dayIsos[dayIsos.length - 1];
    if (!firstIso || !lastIso) return map;
    for (const iso of dayIsos) map.set(iso, new Set<number>());

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
        map.get(iso)?.add(ev.owner.id);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return map;
  }, [days, events, checkedSet]);

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
          const busyOwnerIds = busyOwnersByDay.get(iso) ?? new Set<number>();
          // Render bars in the same order as the checked-user list so a
          // person occupies the same row across days when they're busy.
          const orderedBusy = effectiveOrderedCheckedUserIds.filter((id) =>
            busyOwnerIds.has(id),
          );
          return (
            <DayCell
              key={iso}
              date={cell.date}
              inMonth={cell.inMonth}
              birthdayLabels={birthdayLabelsByDay.get(iso) ?? []}
              busyOwnerIds={orderedBusy}
              orderedCheckedUserIds={effectiveOrderedCheckedUserIds}
              ownersById={ownersById}
              onCellClick={onDayClick}
            />
          );
        })}
      </SimpleGrid>
    </Box>
  );
}
