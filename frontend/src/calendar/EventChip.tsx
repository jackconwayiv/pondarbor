import type React from "react";

import { Box, Text } from "@chakra-ui/react";

import { APP_TEXT_SIZES } from "../theme/typography";
import { chipStyles, paletteForOwner } from "./ownerPalette";
import type { CalendarEvent } from "./types";

export type EventChipProps = {
  event: CalendarEvent;
  onClick?: () => void;
};

export default function EventChip({ event, onClick }: EventChipProps) {
  const palette = event.color || paletteForOwner(event.owner.id);
  const styles = chipStyles(palette);
  const ownerLabel = event.owner.display_name || event.owner.email;
  const titlePrefix = event.all_day ? "" : formatTime(event.start_at);
  const label = titlePrefix
    ? `${titlePrefix} ${event.title}`
    : event.title;
  const handleClick = onClick
    ? (e: React.MouseEvent<HTMLButtonElement>) => {
        // Prevent the click from bubbling to the day cell, which would
        // otherwise open the "Add event" dialog.
        e.stopPropagation();
        onClick();
      }
    : undefined;
  return (
    <Box
      as={onClick ? "button" : "div"}
      onClick={handleClick}
      type={onClick ? "button" : undefined}
      textAlign="left"
      display="block"
      w="100%"
      px="1.5"
      py="0.5"
      borderRadius="md"
      borderWidth="1px"
      overflow="hidden"
      cursor={onClick ? "pointer" : "default"}
      {...styles}
      title={`${ownerLabel}: ${event.title}`}
      _hover={
        onClick
          ? {
              borderColor: `${palette}.fg`,
            }
          : undefined
      }
    >
      <Text
        fontSize={APP_TEXT_SIZES.helper}
        fontWeight="medium"
        lineHeight="1.15"
        whiteSpace="nowrap"
        textOverflow="ellipsis"
        overflow="hidden"
      >
        {label}
      </Text>
      <Text
        fontSize={APP_TEXT_SIZES.meta}
        color="fg.muted"
        lineHeight="1.1"
        whiteSpace="nowrap"
        textOverflow="ellipsis"
        overflow="hidden"
      >
        {ownerLabel}
      </Text>
    </Box>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
