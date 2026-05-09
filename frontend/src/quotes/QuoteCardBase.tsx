import { Avatar, Box, HStack, Spacer, Stack, Tag, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import FriendProfileLink from "../friend/FriendProfileLink";
import { APP_TEXT_SIZES } from "../theme/typography";
import type { Quote } from "./types";

type QuoteCardBaseProps = {
  quote: Quote;
  ownerText: string;
  /** When set, the owner line links to `/friend/:id` (use `quote.owner.id`). */
  ownerProfileUserId?: number;
  ownerAvatarUrl?: string;
  /** When true, hide read-only body and label chips (e.g. while inline editor is open). */
  suppressReadOnlyQuote?: boolean;
  isClickable?: boolean;
  onClick?: () => void;
  rightMetaSlot?: ReactNode;
  footerSlot?: ReactNode;
  showOwnerAvatar?: boolean;
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
  ownerAvatarUrl,
  suppressReadOnlyQuote = false,
  isClickable = false,
  onClick,
  rightMetaSlot,
  footerSlot,
  showOwnerAvatar = true,
}: QuoteCardBaseProps) {
  const tagLabels = quote.labels.filter((label) => label.kind === "tag");

  const displayDate = formatDateForCard(quote.date_of_quote);

  const ownerAvatar =
    showOwnerAvatar && ownerProfileUserId != null ? (
      <FriendProfileLink userId={ownerProfileUserId}>
        <Avatar.Root size="sm">
          <Avatar.Fallback name={ownerText} />
          <Avatar.Image src={ownerAvatarUrl || quote.owner.avatar_url || undefined} />
        </Avatar.Root>
      </FriendProfileLink>
    ) : null;

  return (
    <Box
      cursor={isClickable ? "pointer" : "default"}
      onClick={onClick}
      bg="transparent"
      borderWidth="0"
      p="0"
    >
      <HStack align="center" gap="3">
        {ownerAvatar}
        <Stack gap="1" flex="1" minW="0">
          {displayDate ? <Text fontSize={APP_TEXT_SIZES.meta}>{displayDate}</Text> : null}

          {!suppressReadOnlyQuote ? (
            <HStack align="flex-start" justify="space-between" gap="1">
              <Text whiteSpace="pre-wrap" flex="1">
                {quote.body}
              </Text>
            </HStack>
          ) : null}

          {!suppressReadOnlyQuote && tagLabels.length > 0 ? (
            <HStack align="start" gap="2">
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
              <Spacer />
            </HStack>
          ) : null}

          {footerSlot}
        </Stack>
        {rightMetaSlot}
      </HStack>
    </Box>
  );
}
