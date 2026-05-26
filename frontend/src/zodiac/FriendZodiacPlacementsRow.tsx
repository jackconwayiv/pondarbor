import { Avatar, Box, Grid, SimpleGrid, Stack, Text } from "@chakra-ui/react";

import { resolveAvatarUrlForUser, useAppSession } from "../auth/AppSessionContext";
import FriendProfileLink from "../friend/FriendProfileLink";
import { APP_TEXT_SIZES } from "../theme/typography";
import type { FriendWithZodiac } from "./api";
import { buildZodiacOverviewTiles } from "./ZodiacOverviewCardsStrip";
import { signCardAccent } from "./signCardAccent";
import ZodiacSignCard from "./ZodiacSignCard";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";

export type FriendZodiacPlacementsRowProps = {
  friend: FriendWithZodiac;
  onPlacementOpen: (tile: ZodiacSignCardTile) => void;
};

function FriendIdentityCard({ friend }: { friend: FriendWithZodiac }) {
  const { sessionUser, auth0User } = useAppSession();
  const avatarSrc =
    resolveAvatarUrlForUser(friend.avatar_url, friend.id, sessionUser, auth0User) ||
    friend.avatar_url ||
    undefined;

  return (
    <FriendProfileLink userId={friend.id}>
      <Box
        as="span"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        gap="2"
        h="100%"
        minH={{ base: "auto", md: "100%" }}
        p={{ base: "2", md: "3" }}
        borderWidth="1px"
        borderColor="border"
        borderRadius="xl"
        bg="bg.panel"
        boxShadow="sm"
        transition="box-shadow 0.15s ease"
        _hover={{ boxShadow: "md" }}
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
      </Box>
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
    risingSign: friend.rising_sign,
    mercurySign: friend.mercury_sign,
    venusSign: friend.venus_sign,
    marsSign: friend.mars_sign,
    natalChart: friend.natal_chart,
  });

  const tileById = (id: string) => tiles.find((t) => t.id === id);

  const row0 = ["sun", "moon", "rising"] as const;
  const row1 = ["mercury", "venus", "mars"] as const;

  const placementCells = (
    <>
      {row0.map((id) => {
        const tile = tileById(id);
        if (!tile) return <Box key={id} display="none" />;
        return (
          <ZodiacSignCard
            key={id}
            tile={tile}
            accent={signCardAccent(tile.sign)}
            onOpen={onPlacementOpen}
          />
        );
      })}
      {row1.map((id) => {
        const tile = tileById(id);
        if (!tile) return <Box key={id} display="none" />;
        return (
          <ZodiacSignCard
            key={id}
            tile={tile}
            accent={signCardAccent(tile.sign)}
            onOpen={onPlacementOpen}
          />
        );
      })}
    </>
  );

  return (
    <Box w="100%">
      <Box display={{ base: "none", md: "block" }}>
        <Grid
          templateColumns="minmax(140px, 1fr) repeat(3, minmax(0, 1fr))"
          templateRows="repeat(2, auto)"
          gap={{ base: "3", md: "4" }}
          w="100%"
          alignItems="stretch"
        >
          <Box gridRow="span 2" minH="0">
            <FriendIdentityCard friend={friend} />
          </Box>
          {row0.map((id) => {
            const tile = tileById(id);
            if (!tile) return null;
            return (
              <ZodiacSignCard
                key={id}
                tile={tile}
                accent={signCardAccent(tile.sign)}
                onOpen={onPlacementOpen}
              />
            );
          })}
          {row1.map((id) => {
            const tile = tileById(id);
            if (!tile) return null;
            return (
              <ZodiacSignCard
                key={id}
                tile={tile}
                accent={signCardAccent(tile.sign)}
                onOpen={onPlacementOpen}
              />
            );
          })}
        </Grid>
      </Box>
      <Stack gap="3" display={{ base: "flex", md: "none" }}>
        <FriendIdentityCard friend={friend} />
        <SimpleGrid columns={2} gap="3" w="100%">
          {placementCells}
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
