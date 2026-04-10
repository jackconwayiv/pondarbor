import { Avatar, Box, HStack, Stack, Text } from "@chakra-ui/react";
import { Link } from "react-router";

import { APP_TEXT_SIZES } from "../theme/typography";
import type { FriendUser } from "./api";

export const APPROVED_FRIENDS_ENTRY_CARD_PROPS = {
  bg: "white",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "xl",
  p: { base: "2", md: "2" },
} as const;

type ApprovedFriendsListBlockProps = {
  friends: FriendUser[];
  /** When true, heading is "Friends (N)"; when false, "Friends" only. */
  showCountInTitle?: boolean;
  /** When true (default), wrap in the same card shell as Friends page. Set false when already inside a card (e.g. friend profile tabs). */
  withCardShell?: boolean;
};

export function ApprovedFriendsListBlock({
  friends,
  showCountInTitle = false,
  withCardShell = true,
}: ApprovedFriendsListBlockProps) {
  const title = showCountInTitle
    ? `Friends (${friends.length})`
    : "Friends";

  const inner = (
    <Stack gap="3">
      <Text fontWeight="bold">{title}</Text>
      {friends.length === 0 ? (
        <Text>No approved friends yet.</Text>
      ) : null}
      {friends.map((row) => (
        <Link
          key={`friend-${row.id}`}
          to={`/friend/${row.id}`}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <HStack>
            <Avatar.Root size="sm">
              <Avatar.Fallback name={row.nickname} />
              <Avatar.Image src={row.avatar_url || undefined} />
            </Avatar.Root>
            <Stack gap="0">
              <Text>{row.nickname}</Text>
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                {row.email}
              </Text>
            </Stack>
          </HStack>
        </Link>
      ))}
    </Stack>
  );

  if (!withCardShell) {
    return inner;
  }

  return <Box {...APPROVED_FRIENDS_ENTRY_CARD_PROPS}>{inner}</Box>;
}
