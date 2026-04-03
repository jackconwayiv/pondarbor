import { Box, HStack, Spacer, Stack, Tag, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import FriendProfileLink from "../friend/FriendProfileLink";
import { APP_TEXT_SIZES } from "../theme/typography";
import type { Quote } from "./types";

type QuoteCardBaseProps = {
  quote: Quote;
  ownerText: string;
  /** When set, the owner line links to `/friend/:id` (use `quote.owner.id`). */
  ownerProfileUserId?: number;
  /** When true, omit the top-right owner line (e.g. “My quotes” where every card is yours). */
  hideOwnerMeta?: boolean;
  /** When true, hide read-only body and label chips (e.g. while inline editor is open). */
  suppressReadOnlyQuote?: boolean;
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
  ownerProfileUserId,
  hideOwnerMeta = false,
  suppressReadOnlyQuote = false,
  isClickable = false,
  onClick,
  rightMetaSlot,
  footerSlot,
}: QuoteCardBaseProps) {
  const attributionLabels = quote.labels.filter((label) => label.kind === "attribution");
  const tagLabels = quote.labels.filter((label) => label.kind === "tag");

  const displayDate = formatDateForCard(quote.date_of_quote);

  const ownerMeta =
    ownerProfileUserId != null ? (
      <FriendProfileLink userId={ownerProfileUserId}>
        <Text
          as="span"
          fontSize={APP_TEXT_SIZES.meta}
          fontWeight="bold"
          color="lilypad.solid"
          textDecoration="none"
        >
          {ownerText}
        </Text>
      </FriendProfileLink>
    ) : (
      <Text fontSize={APP_TEXT_SIZES.meta}>{ownerText}</Text>
    );

  return (
    <Box
      cursor={isClickable ? "pointer" : "default"}
      onClick={onClick}
      bg="bg"
      borderWidth="1px"
      borderColor="border"
      borderRadius="xl"
      px={{ base: "4", md: "4" }}
      py={{ base: "3", md: "3" }}
    >
      <Stack gap="1">
        <HStack align="center" gap="2">
          {displayDate ? (
            <Text fontSize={APP_TEXT_SIZES.meta}>{displayDate}</Text>
          ) : (
            <Box />
          )}
          <Spacer />
          {rightMetaSlot ?? (!hideOwnerMeta ? ownerMeta : null)}
        </HStack>

        {!suppressReadOnlyQuote ? (
          <HStack align="flex-start" justify="space-between" gap="1">
            <Text whiteSpace="pre-wrap" flex="1">
              {quote.body}
            </Text>
          </HStack>
        ) : null}

        {!suppressReadOnlyQuote &&
        (attributionLabels.length > 0 || tagLabels.length > 0) ? (
          <HStack align="start" gap="2">
            <HStack flexWrap="wrap" gap="1" alignItems="center">
              {attributionLabels.map((label) =>
                label.linked_user_id != null ? (
                  <FriendProfileLink key={`base-attribution-${quote.id}-${label.id}`} userId={label.linked_user_id}>
                    <Tag.Root size="sm" bg="gray.100" color="gray.600" borderWidth="0">
                      <Tag.Label>{label.name}</Tag.Label>
                    </Tag.Root>
                  </FriendProfileLink>
                ) : (
                  <Tag.Root
                    key={`base-attribution-${quote.id}-${label.id}`}
                    size="sm"
                    bg="gray.100"
                    color="gray.600"
                    borderWidth="0"
                  >
                    <Tag.Label>{label.name}</Tag.Label>
                  </Tag.Root>
                ),
              )}
            </HStack>
            <Spacer />
            <HStack justify="flex-end" flexWrap="wrap" gap="1" alignItems="center">
              {tagLabels.map((label) => (
                <Tag.Root
                  key={`base-tag-${quote.id}-${label.id}`}
                  size="sm"
                  bg="gray.100"
                  color="gray.600"
                  borderWidth="0"
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
