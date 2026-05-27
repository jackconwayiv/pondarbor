import { Box, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useMemo } from "react";
import { Link as RouterLink } from "react-router";

import { APP_TEXT_SIZES } from "../theme/typography";
import { buildZodiacOverviewTiles } from "../zodiac/ZodiacOverviewCardsStrip";
import { signCardAccent } from "../zodiac/signCardAccent";
import ZodiacSignCard from "../zodiac/ZodiacSignCard";
import { formatBirthMonthDay } from "../zodiac/birthDateFormat";

export type FriendProfileBirthdayInlineProps = {
  birthDate?: string | null;
};

/** Right-aligned birthday label for the profile identity row. */
export function FriendProfileBirthdayInline({ birthDate }: FriendProfileBirthdayInlineProps) {
  const label = formatBirthMonthDay(birthDate);
  if (!label) return null;

  return (
    <Stack gap="0.5" align="flex-end" flexShrink={0} textAlign="right" ml="auto">
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" fontWeight="medium">
        Birthday
      </Text>
      <Text fontSize={APP_TEXT_SIZES.title} fontWeight="semibold" color="fg">
        {label}
      </Text>
    </Stack>
  );
}

export type FriendProfileBigThreeRowProps = {
  userId: number;
  sunSign?: string | null;
  moonSign?: string | null;
  risingSign?: string | null;
};

function zodiacFriendsTabUrl(userId: number): string {
  return `/zodiac?tab=friends&user=${userId}`;
}

/** Big-three placement cards on their own row; each links to Zodiac Friends tab. */
export function FriendProfileBigThreeRow({
  userId,
  sunSign,
  moonSign,
  risingSign,
}: FriendProfileBigThreeRowProps) {
  const tiles = useMemo(() => {
    if (!sunSign?.trim() && !moonSign?.trim() && !risingSign?.trim()) {
      return [];
    }
    return buildZodiacOverviewTiles({
      sunSign: sunSign?.trim() || "—",
      moonSign: moonSign?.trim() || "—",
      risingSign: risingSign?.trim() || undefined,
    }).filter((t) => {
      if (t.id === "sun") return Boolean(sunSign?.trim());
      if (t.id === "moon") return Boolean(moonSign?.trim());
      if (t.id === "rising") return Boolean(risingSign?.trim());
      return false;
    });
  }, [sunSign, moonSign, risingSign]);

  if (tiles.length === 0) return null;

  const zodiacUrl = zodiacFriendsTabUrl(userId);
  const colCount = Math.min(tiles.length, 3);

  return (
    <SimpleGrid columns={{ base: colCount }} gap="3" w="100%">
      {tiles.map((tile) => (
        <RouterLink
          key={tile.id}
          to={zodiacUrl}
          style={{ display: "block", textDecoration: "none", color: "inherit" }}
        >
          <Box
            cursor="pointer"
            transition="box-shadow 0.15s ease"
            _hover={{ "& > *": { boxShadow: "md" } }}
          >
            <ZodiacSignCard
              tile={tile}
              accent={signCardAccent(tile.sign)}
              interactive={false}
            />
          </Box>
        </RouterLink>
      ))}
    </SimpleGrid>
  );
}
