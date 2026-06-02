import { Box, HStack, Stack, Text } from "@chakra-ui/react";

import { APP_TEXT_SIZES } from "../theme/typography";
import { sameLocalDay } from "./monthMath";
import type { CalendarOwnerRow } from "./types";
import {
  USER_COLOR_HEX,
  USER_COLOR_TEXT_ON,
  colorForCheckedUser,
} from "./userColors";

type Props = {
  date: Date;
  inMonth: boolean;
  birthdayLabels: string[];
  /** Owner ids busy on this day, in display order (matches checked order). */
  busyOwnerIds: number[];
  orderedCheckedUserIds: number[];
  ownersById: Map<number, CalendarOwnerRow>;
  onCellClick?: (date: Date) => void;
};

/** Approximate height of one busy-bar row inside a day cell. */
const BAR_HEIGHT_PX = 12;

export default function DayCell({
  date,
  inMonth,
  birthdayLabels,
  busyOwnerIds,
  orderedCheckedUserIds,
  ownersById,
  onCellClick,
}: Props) {
  const today = new Date();
  const isToday = sameLocalDay(today, date);

  return (
    <Box
      role={onCellClick ? "button" : undefined}
      tabIndex={onCellClick ? 0 : undefined}
      aria-label={
        onCellClick ? `Open ${date.toDateString()} day view` : undefined
      }
      onClick={onCellClick ? () => onCellClick(date) : undefined}
      onKeyDown={
        onCellClick
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onCellClick(date);
              }
            }
          : undefined
      }
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
          ? { borderColor: "teal.solid" }
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
            bg="teal.solid"
            aria-hidden
          />
        ) : null}
      </HStack>
      <Stack gap="0.5" align="stretch">
        {birthdayLabels.map((label) => (
          <Text
            key={label}
            fontSize="10px"
            lineHeight="1.2"
            fontWeight="medium"
            color="fg"
            whiteSpace="nowrap"
            textOverflow="ellipsis"
            overflow="hidden"
            title={label}
          >
            {label}
          </Text>
        ))}
        {busyOwnerIds.map((ownerId) => {
          const color = colorForCheckedUser(ownerId, orderedCheckedUserIds);
          if (color === null) return null;
          const owner = ownersById.get(ownerId);
          const label = owner?.display_name || "Busy";
          return (
            <Box
              key={ownerId}
              h={`${BAR_HEIGHT_PX}px`}
              borderRadius="sm"
              px="1"
              display="flex"
              alignItems="center"
              overflow="hidden"
              style={{
                background: USER_COLOR_HEX[color],
                color: USER_COLOR_TEXT_ON[color],
              }}
              title={label}
            >
              <Text
                as="span"
                fontSize="9px"
                lineHeight="1"
                fontWeight="semibold"
                whiteSpace="nowrap"
                textOverflow="ellipsis"
                overflow="hidden"
              >
                {label}
              </Text>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
