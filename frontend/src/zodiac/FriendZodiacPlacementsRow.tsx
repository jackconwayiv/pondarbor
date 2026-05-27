import { Avatar, Box, Grid, SimpleGrid, Stack, Text } from "@chakra-ui/react";

import { resolveAvatarUrlForUser, useAppSession } from "../auth/AppSessionContext";
import FriendProfileLink from "../friend/FriendProfileLink";
import { APP_TEXT_SIZES } from "../theme/typography";
import type { FriendWithZodiac } from "./api";
import { buildZodiacOverviewTiles } from "./ZodiacOverviewCardsStrip";
import { signCardAccent } from "./signCardAccent";
import ZodiacSignCard from "./ZodiacSignCard";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";

const BIG_THREE_IDS = ["sun", "moon", "rising"] as const;

export type FriendZodiacPlacementsRowProps = {
  friend: FriendWithZodiac;
  onPlacementOpen: (tile: ZodiacSignCardTile) => void;
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
}: FriendZodiacPlacementsRowProps) {
  const tiles = buildZodiacOverviewTiles({
    sunSign: friend.sun_sign,
    moonSign: friend.moon_sign,
    risingSign: friend.rising_sign ?? undefined,
    natalChart: friend.natal_chart,
  }).filter((t) => BIG_THREE_IDS.includes(t.id as (typeof BIG_THREE_IDS)[number]));

  const n = Math.max(tiles.length, 1);

  const placementCards = tiles.map((tile) => (
    <ZodiacSignCard
      key={tile.id}
      tile={tile}
      accent={signCardAccent(tile.sign)}
      onOpen={onPlacementOpen}
    />
  ));

  return (
    <Box
      w="100%"
      borderWidth="1px"
      borderColor="border"
      borderRadius="xl"
      bg="bg.panel"
      p={{ base: "3", md: "4" }}
      boxShadow="sm"
    >
      <Box display={{ base: "none", md: "block" }}>
        <Grid
          templateColumns={`minmax(120px, 0.85fr) repeat(${n}, minmax(0, 1fr))`}
          gap="4"
          w="100%"
          alignItems="stretch"
        >
          <FriendIdentity friend={friend} />
          {placementCards}
        </Grid>
      </Box>
      <Stack gap="4" display={{ base: "flex", md: "none" }} w="100%">
        <FriendIdentity friend={friend} />
        <SimpleGrid columns={{ base: n, md: n }} gap="3" w="100%" maxW="100%">
          {placementCards}
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
