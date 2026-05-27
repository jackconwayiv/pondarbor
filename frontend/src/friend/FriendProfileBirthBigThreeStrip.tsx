import { Stack, Text } from "@chakra-ui/react";
import { useMemo } from "react";
import { Link as RouterLink } from "react-router";

import { APP_TEXT_SIZES } from "../theme/typography";
import { buildZodiacOverviewTiles } from "../zodiac/ZodiacOverviewCardsStrip";
import ZodiacPlacementsMiniGrid from "../zodiac/ZodiacPlacementsMiniGrid";
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
  mercurySign?: string | null;
  venusSign?: string | null;
  marsSign?: string | null;
};

function zodiacFriendsTabUrl(userId: number): string {
  return `/zodiac?tab=friends&user=${userId}`;
}

/** Placement mini tiles (3×2); each links to Zodiac Friends tab for that friend. */
export function FriendProfileBigThreeRow({
  userId,
  sunSign,
  moonSign,
  risingSign,
  mercurySign,
  venusSign,
  marsSign,
}: FriendProfileBigThreeRowProps) {
  const tiles = useMemo(() => {
    if (!sunSign?.trim() && !moonSign?.trim() && !risingSign?.trim()) {
      return [];
    }
    return buildZodiacOverviewTiles({
      sunSign: sunSign?.trim() || "—",
      moonSign: moonSign?.trim() || "—",
      risingSign: risingSign?.trim() || undefined,
      mercurySign: mercurySign?.trim() || undefined,
      venusSign: venusSign?.trim() || undefined,
      marsSign: marsSign?.trim() || undefined,
    }).filter((t) => {
      if (t.id === "sun") return Boolean(sunSign?.trim());
      if (t.id === "moon") return Boolean(moonSign?.trim());
      if (t.id === "rising") return Boolean(risingSign?.trim());
      if (t.id === "mercury") return Boolean(mercurySign?.trim());
      if (t.id === "venus") return Boolean(venusSign?.trim());
      if (t.id === "mars") return Boolean(marsSign?.trim());
      return false;
    });
  }, [sunSign, moonSign, risingSign, mercurySign, venusSign, marsSign]);

  if (tiles.length === 0) return null;

  const zodiacUrl = zodiacFriendsTabUrl(userId);

  return (
    <ZodiacPlacementsMiniGrid
      tiles={tiles}
      tileWrapper={(_tile, node) => (
        <RouterLink
          to={zodiacUrl}
          style={{ display: "block", textDecoration: "none", color: "inherit" }}
        >
          {node}
        </RouterLink>
      )}
    />
  );
}
