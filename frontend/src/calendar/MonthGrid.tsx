import { Box, SimpleGrid, Text } from "@chakra-ui/react";

import { APP_TEXT_SIZES } from "../theme/typography";
import DayCell from "./DayCell";
import {
  SHORT_WEEKDAY_LABELS,
  eventOverlapsDay,
  monthGridDays,
  type MonthAnchor,
} from "./monthMath";
import type { CalendarEvent } from "./types";

type Props = {
  anchor: MonthAnchor;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDayClick?: (date: Date) => void;
};

export default function MonthGrid({
  anchor,
  events,
  onEventClick,
  onDayClick,
}: Props) {
  const days = monthGridDays(anchor);

  // Parse events once; map them to the days they cover.
  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const start = new Date(ev.start_at);
    const end = new Date(ev.end_at);
    for (const cell of days) {
      if (eventOverlapsDay(start, end, cell.date)) {
        const key = cellKey(cell.date);
        const bucket = eventsByDay.get(key) ?? [];
        bucket.push(ev);
        eventsByDay.set(key, bucket);
      }
    }
  }

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
        {days.map((cell) => (
          <DayCell
            key={cellKey(cell.date)}
            date={cell.date}
            inMonth={cell.inMonth}
            events={eventsByDay.get(cellKey(cell.date)) ?? []}
            onEventClick={onEventClick}
            onCellClick={onDayClick}
          />
        ))}
      </SimpleGrid>
    </Box>
  );
}

function cellKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
