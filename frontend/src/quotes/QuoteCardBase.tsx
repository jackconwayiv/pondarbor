import { Box, HStack, Spacer, Stack, Tag, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { APP_TEXT_SIZES } from "../theme/typography";
import type { Quote } from "./types";

type QuoteCardBaseProps = {
  quote: Quote;
  ownerText: string;
  isClickable?: boolean;
  onClick?: () => void;
  rightMetaSlot?: ReactNode;
  footerSlot?: ReactNode;
};

function formatDateForCard(value: string | null): string | null {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year.slice(-2)}`;
}

export default function QuoteCardBase({
  quote,
  ownerText,
  isClickable = false,
  onClick,
  rightMetaSlot,
  footerSlot,
}: QuoteCardBaseProps) {
  const attributionLabels = quote.labels.filter((label) => label.kind === "attribution");
  const tagLabels = quote.labels.filter((label) => label.kind === "tag");

  const displayDate = formatDateForCard(quote.date_of_quote);

  return (
    <Box
      borderWidth="1px"
      borderColor="border"
      p="3"
      borderRadius="md"
      cursor={isClickable ? "pointer" : "default"}
      onClick={onClick}
    >
      <Stack gap="1.5">
        <HStack align="center" gap="2">
          {displayDate ? (
            <Text fontSize={APP_TEXT_SIZES.meta}>{displayDate}</Text>
          ) : (
            <Box />
          )}
          <Spacer />
          {rightMetaSlot ?? <Text fontSize={APP_TEXT_SIZES.meta}>{ownerText}</Text>}
        </HStack>

        <HStack align="flex-start" justify="space-between" gap="1.5">
          <Text whiteSpace="pre-wrap" flex="1">
            {quote.body}
          </Text>
        </HStack>

        {attributionLabels.length > 0 || tagLabels.length > 0 ? (
          <HStack align="start" gap="2">
            <HStack flexWrap="wrap" gap="1">
              {attributionLabels.map((label) => (
                <Tag.Root
                  key={`base-attribution-${quote.id}-${label.id}`}
                  size="sm"
                  colorPalette="lilypad"
                  variant="subtle"
                >
                  <Tag.Label>{label.name}</Tag.Label>
                </Tag.Root>
              ))}
            </HStack>
            <Spacer />
            <HStack justify="flex-end" flexWrap="wrap" gap="1">
              {tagLabels.map((label) => (
                <Tag.Root
                  key={`base-tag-${quote.id}-${label.id}`}
                  size="sm"
                  colorPalette="sky"
                  variant="subtle"
                >
                  <Tag.Label>{label.name}</Tag.Label>
                </Tag.Root>
              ))}
            </HStack>
          </HStack>
        ) : null}

        {footerSlot}
      </Stack>
    </Box>
  );
}
