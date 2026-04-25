import { Box, SimpleGrid, Text } from "@chakra-ui/react";
import { useMemo } from "react";

import { APP_TEXT_SIZES } from "../theme/typography";
import DayCell from "./DayCell";
import {
  SHORT_WEEKDAY_LABELS,
  eventCoversDay,
  isoDateForLocalDay,
  monthGridDays,
  type MonthAnchor,
} from "./monthMath";
import type { CalendarEvent, CalendarOwnerRow } from "./types";

type Props = {
  anchor: MonthAnchor;
  events: CalendarEvent[];
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

  /**
   * For each day cell ISO, the *unique* set of owner ids who are busy that
   * day, restricted to currently-checked users. Multiple events for the same
   * user on the same day collapse into one bar.
   */
  const busyOwnersByDay = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const cell of days) {
      map.set(isoDateForLocalDay(cell.date), new Set<number>());
    }
    for (const ev of events) {
      if (!checkedSet.has(ev.owner.id)) continue;
      for (const cell of days) {
        const iso = isoDateForLocalDay(cell.date);
        if (eventCoversDay(ev.start_date, ev.end_date, iso)) {
          map.get(iso)?.add(ev.owner.id);
        }
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
