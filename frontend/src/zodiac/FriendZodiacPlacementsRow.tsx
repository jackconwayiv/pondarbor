import { Avatar, Box, Flex, Stack, Text } from "@chakra-ui/react";
import { useMemo } from "react";

import { resolveAvatarUrlForUser, useAppSession } from "../auth/AppSessionContext";
import FriendProfileLink from "../friend/FriendProfileLink";
import { APP_TEXT_SIZES } from "../theme/typography";
import type { FriendWithZodiac } from "./api";
import FriendZodiacPlacementsBlock from "./FriendZodiacPlacementsBlock";
import { buildZodiacOverviewTiles } from "./ZodiacOverviewCardsStrip";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";

export type FriendZodiacPlacementsRowProps = {
  friend: FriendWithZodiac;
  onPlacementOpen: (tile: ZodiacSignCardTile) => void;
  highlight?: boolean;
};

function FriendIdentity({ friend }: { friend: FriendWithZodiac }) {
  const { sessionUser, auth0User } = useAppSession();
  const avatarSrc =
    resolveAvatarUrlForUser(friend.avatar_url, friend.id, sessionUser, auth0User) ||
    friend.avatar_url ||
    undefined;

  return (
    <FriendProfileLink userId={friend.id}>
      <Flex
        align="center"
        gap="2"
        minW="0"
        transition="opacity 0.15s ease"
        _hover={{ opacity: 0.9 }}
      >
        <Avatar.Root size={{ base: "sm", md: "md" }} flexShrink={0}>
          <Avatar.Fallback name={friend.nickname} />
          {avatarSrc ? <Avatar.Image src={avatarSrc} /> : null}
        </Avatar.Root>
        <Text
          fontWeight="semibold"
          fontSize={APP_TEXT_SIZES.body}
          lineClamp={2}
          minW="0"
        >
          {friend.nickname}
        </Text>
      </Flex>
    </FriendProfileLink>
  );
}

export default function FriendZodiacPlacementsRow({
  friend,
  onPlacementOpen,
  highlight = false,
}: FriendZodiacPlacementsRowProps) {
  const chart = friend.natal_chart;
  const tiles = useMemo(
    () =>
      buildZodiacOverviewTiles({
        sunSign: friend.sun_sign,
        moonSign: friend.moon_sign,
        risingSign: friend.rising_sign ?? undefined,
        mercurySign: chart?.points?.mercury?.sign,
        venusSign: chart?.points?.venus?.sign,
        marsSign: chart?.points?.mars?.sign,
        natalChart: chart,
      }),
    [friend, chart],
  );

  return (
    <Box
      id={`friend-zodiac-${friend.id}`}
      w="100%"
      borderWidth="1px"
      borderColor={highlight ? "fg" : "border"}
      borderRadius="xl"
      bg="bg.panel"
      p={{ base: "2", md: "3" }}
      boxShadow={highlight ? "md" : "sm"}
      scrollMarginTop="6rem"
    >
      <Stack gap="2" w="100%">
        <FriendIdentity friend={friend} />
        <FriendZodiacPlacementsBlock tiles={tiles} onSelect={onPlacementOpen} />
      </Stack>
    </Box>
  );
}
