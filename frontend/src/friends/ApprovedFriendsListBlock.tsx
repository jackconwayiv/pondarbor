import { Avatar, Box, HStack, Stack, Text } from "@chakra-ui/react";
import { Link } from "react-router";

import PondButton from "../PondButton";
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
  /** Show per-row Request Friend when the viewer is not already friends with that user. */
  showRequestFriendActions?: boolean;
  viewerId?: number;
  viewerApprovedFriendIds?: Set<number>;
  onRequestFriend?: (userId: number) => Promise<void>;
};

export function ApprovedFriendsListBlock({
  friends,
  showCountInTitle = false,
  withCardShell = true,
  showRequestFriendActions = false,
  viewerId,
  viewerApprovedFriendIds,
  onRequestFriend,
}: ApprovedFriendsListBlockProps) {
  const title = showCountInTitle ? `Friends (${friends.length})` : "Friends";

  const inner = (
    <Stack gap="3">
      <Text fontWeight="bold">{title}</Text>
      {friends.length === 0 ? (
        <Text>No approved friends yet.</Text>
      ) : null}
      {friends.map((row) => {
        const already =
          viewerApprovedFriendIds != null &&
          (viewerApprovedFriendIds.has(row.id) || row.id === viewerId);
        const showRequest =
          showRequestFriendActions &&
          viewerId != null &&
          row.id !== viewerId &&
          !already &&
          onRequestFriend != null;
        return (
          <HStack key={`friend-${row.id}`} align="center" gap="2" w="full">
            <Link
              to={`/friend/${row.id}`}
              style={{ textDecoration: "none", color: "inherit", flex: 1, minWidth: 0 }}
            >
              <HStack align="center" gap="2" w="full">
                <Avatar.Root size="sm">
                  <Avatar.Fallback name={row.nickname} />
                  <Avatar.Image src={row.avatar_url || undefined} />
                </Avatar.Root>
                <Stack gap="0" flex="1" minW={0}>
                  <Text>{row.nickname}</Text>
                  <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                    {row.email}
                  </Text>
                </Stack>
              </HStack>
            </Link>
            {showRequest ? (
              <PondButton
                type="button"
                size="sm"
                variant="outline"
                colorPalette="lilypad"
                flexShrink={0}
                onClick={() => void onRequestFriend(row.id)}
              >
                Request Friend
              </PondButton>
            ) : null}
          </HStack>
        );
      })}
    </Stack>
  );

  if (!withCardShell) {
    return inner;
  }

  return <Box {...APPROVED_FRIENDS_ENTRY_CARD_PROPS}>{inner}</Box>;
}
