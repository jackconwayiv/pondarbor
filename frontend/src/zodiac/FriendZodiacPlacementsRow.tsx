import { Avatar, Box, Grid, Stack, Text } from "@chakra-ui/react";
import { useMemo } from "react";

import { resolveAvatarUrlForUser, useAppSession } from "../auth/AppSessionContext";
import FriendProfileLink from "../friend/FriendProfileLink";
import { APP_TEXT_SIZES } from "../theme/typography";
import type { FriendWithZodiac } from "./api";
import { buildZodiacOverviewTiles } from "./ZodiacOverviewCardsStrip";
import ZodiacPlacementsMiniGrid from "./ZodiacPlacementsMiniGrid";
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
      <Stack
        align="center"
        justify="center"
        gap="2"
        h="100%"
        py={{ base: "1", md: "0" }}
        transition="opacity 0.15s ease"
        _hover={{ opacity: 0.9 }}
      >
        <Avatar.Root size="lg">
          <Avatar.Fallback name={friend.nickname} />
          {avatarSrc ? <Avatar.Image src={avatarSrc} /> : null}
        </Avatar.Root>
        <Text
          fontWeight="semibold"
          fontSize={APP_TEXT_SIZES.body}
          textAlign="center"
          lineClamp={2}
          w="100%"
        >
          {friend.nickname}
        </Text>
      </Stack>
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
      p={{ base: "3", md: "4" }}
      boxShadow={highlight ? "md" : "sm"}
      scrollMarginTop="6rem"
    >
      <Box display={{ base: "none", md: "block" }}>
        <Grid templateColumns="minmax(120px, 0.85fr) minmax(0, 1fr)" gap="4" w="100%" alignItems="stretch">
          <FriendIdentity friend={friend} />
          <ZodiacPlacementsMiniGrid tiles={tiles} onSelect={onPlacementOpen} />
        </Grid>
      </Box>
      <Stack gap="4" display={{ base: "flex", md: "none" }} w="100%">
        <FriendIdentity friend={friend} />
        <ZodiacPlacementsMiniGrid tiles={tiles} onSelect={onPlacementOpen} />
      </Stack>
    </Box>
  );
}
