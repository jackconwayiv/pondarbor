import type React from "react";

import { Box, HStack, Stack, Text } from "@chakra-ui/react";

import { APP_TEXT_SIZES } from "../theme/typography";
import EventChip from "./EventChip";
import { sameLocalDay } from "./monthMath";
import type { CalendarEvent } from "./types";

type Props = {
  date: Date;
  inMonth: boolean;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onCellClick?: (date: Date) => void;
};

const MAX_CHIPS_VISIBLE = 3;

export default function DayCell({
  date,
  inMonth,
  events,
  onEventClick,
  onCellClick,
}: Props) {
  const today = new Date();
  const isToday = sameLocalDay(today, date);
  const overflow = Math.max(0, events.length - MAX_CHIPS_VISIBLE);
  const visible = events.slice(0, MAX_CHIPS_VISIBLE);

  const handleCellClick = onCellClick
    ? () => onCellClick(date)
    : undefined;
  const handleCellKeyDown = onCellClick
    ? (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCellClick(date);
        }
      }
    : undefined;
  return (
    <Box
      role={onCellClick ? "button" : undefined}
      tabIndex={onCellClick ? 0 : undefined}
      aria-label={onCellClick ? `Add event on ${date.toDateString()}` : undefined}
      onClick={handleCellClick}
      onKeyDown={handleCellKeyDown}
      textAlign="left"
      bg={inMonth ? "white" : "gray.50"}
      opacity={inMonth ? 1 : 0.7}
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      p="1"
      minH={{ base: "80px", md: "110px" }}
      display="flex"
      flexDirection="column"
      gap="1"
      cursor={onCellClick ? "pointer" : "default"}
      _hover={
        onCellClick && inMonth
          ? { borderColor: "lilypad.solid" }
          : undefined
      }
    >
      <HStack justify="space-between" align="center" gap="1">
        <Text
          fontSize={APP_TEXT_SIZES.helper}
          fontWeight={isToday ? "bold" : "medium"}
          color={isToday ? "lilypad.fg" : inMonth ? "fg" : "fg.muted"}
        >
          {date.getDate()}
        </Text>
        {isToday ? (
          <Box
            w="1.5"
            h="1.5"
            borderRadius="full"
            bg="lilypad.solid"
            aria-hidden
          />
        ) : null}
      </HStack>
      <Stack gap="0.5" align="stretch">
        {visible.map((ev) => (
          <EventChip
            key={ev.id}
            event={ev}
            onClick={onEventClick ? () => onEventClick(ev) : undefined}
          />
        ))}
        {overflow > 0 ? (
          <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
            +{overflow} more
          </Text>
        ) : null}
      </Stack>
    </Box>
  );
}
