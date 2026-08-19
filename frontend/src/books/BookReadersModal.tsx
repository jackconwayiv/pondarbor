import { Avatar, Box, HStack, Stack, Text } from "@chakra-ui/react";

import { AppModal } from "../components/AppModal";
import FriendProfileLink from "../friend/FriendProfileLink";
import { APP_TEXT_SIZES } from "../theme/typography";
import {
  COMMUNITY_SHELF_SLUGS,
  formatReadLabel,
  shelfOptionLabel,
  type CommunityWorkRow,
  type WorkPlacement,
} from "./communityView";

export function starsLabel(rating: number): string {
  if (!rating || rating < 1) return "";
  const n = Math.min(5, Math.max(0, Math.round(rating)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

const AVATAR_GROUP_MAX = 4;

export function BookAvatarGroup({
  readers,
  onOpen,
}: {
  readers: CommunityWorkRow["groupReaders"];
  onOpen: () => void;
}) {
  const shown = readers.slice(0, AVATAR_GROUP_MAX);
  const extra = readers.length - shown.length;
  const label = readers.map((r) => r.display_name).join(", ");
  return (
    <Box
      as="button"
      display="flex"
      alignItems="center"
      gap="0"
      flexShrink={0}
      bg="transparent"
      borderWidth="0"
      p="0"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen();
      }}
      aria-label={`Who has this book: ${label}`}
      title={label}
      cursor="pointer"
    >
      {shown.map((reader, index) => (
        <Box
          key={reader.id}
          ml={index === 0 ? "0" : "-2"}
          zIndex={shown.length - index}
          borderWidth="1px"
          borderColor="bg.panel"
          borderRadius="full"
        >
          <Avatar.Root size="xs">
            {reader.avatar_url ? <Avatar.Image src={reader.avatar_url} alt="" /> : null}
            <Avatar.Fallback name={reader.display_name} />
          </Avatar.Root>
        </Box>
      ))}
      {extra > 0 ? (
        <Text
          fontSize="2xs"
          color="fg.muted"
          pl="1"
          fontWeight="medium"
        >{`+${extra}`}</Text>
      ) : null}
    </Box>
  );
}

function PlacementRow({ row }: { row: WorkPlacement }) {
  const rating = starsLabel(row.book.user_rating);
  const readLabel = formatReadLabel(row.book);
  return (
    <HStack align="start" gap="2" w="100%">
      <FriendProfileLink userId={row.reader.id}>
        <Avatar.Root size="xs" flexShrink={0}>
          {row.reader.avatar_url ? <Avatar.Image src={row.reader.avatar_url} alt="" /> : null}
          <Avatar.Fallback name={row.reader.display_name} />
        </Avatar.Root>
      </FriendProfileLink>
      <Stack gap="0" minW={0} flex="1">
        <FriendProfileLink userId={row.reader.id}>
          <Text as="span" fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" lineClamp={1}>
            {row.reader.display_name}
          </Text>
        </FriendProfileLink>
        {rating || readLabel ? (
          <Text fontSize="2xs" color="fg.muted" lineClamp={2}>
            {[rating, readLabel].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </Stack>
    </HStack>
  );
}

export default function BookReadersModal({
  open,
  onOpenChange,
  row,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: CommunityWorkRow | null;
}) {
  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={row?.book.title ?? "Readers"}
      size="sm"
    >
      {row ? (
        <Stack gap="3">
          {COMMUNITY_SHELF_SLUGS.map((slug) => {
            const people = row.byShelf[slug];
            if (!people.length) return null;
            return (
              <Stack key={slug} gap="1">
                <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="semibold" color="fg.muted">
                  {shelfOptionLabel(slug)}
                </Text>
                <Stack gap="2">
                  {people.map((placement) => (
                    <PlacementRow
                      key={`${slug}-${placement.reader.id}-${placement.book.link}`}
                      row={placement}
                    />
                  ))}
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      ) : null}
    </AppModal>
  );
}
