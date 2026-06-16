import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router";
import StarRatingDisplay from "./StarRatingDisplay";
import { formatEntrySecondaryLine } from "./utils";
import type { FriendRecommendationRow } from "./types";

type FriendRecommendationListCardProps = {
  row: FriendRecommendationRow;
  recommendationsReturnTo: string;
};

function friendRecommendationDetailTo(row: FriendRecommendationRow): string {
  const params = new URLSearchParams();
  if (row.entry.category.group !== "places") {
    params.set("group", row.entry.category.group);
  }
  params.set("entry", String(row.entry.id));
  return `/recommendations?${params.toString()}`;
}

export default function FriendRecommendationListCard({
  row,
  recommendationsReturnTo,
}: FriendRecommendationListCardProps) {
  const secondaryLine = formatEntrySecondaryLine(row.entry);
  const detailTo = friendRecommendationDetailTo(row);

  return (
    <RouterLink
      to={detailTo}
      state={{ recommendationsReturnTo }}
      aria-label={`Open recommendation: ${row.entry.title}`}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
        height: "100%",
        minHeight: 0,
      }}
    >
      <Box
        as="article"
        borderWidth="1px"
        borderColor="border.muted"
        borderRadius="lg"
        overflow="hidden"
        bg="bg.panel"
        h="100%"
        transition="border-color 0.15s ease, box-shadow 0.15s ease"
        _hover={{ borderColor: "sky.border", boxShadow: "sm" }}
      >
        {row.entry.image_url ? (
          <Box h="40" overflow="hidden" bg="bg.muted">
            <img
              src={row.entry.image_url}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Box>
        ) : null}
        <Stack gap={2} p={4}>
          <HStack justify="space-between" align="start" gap={3}>
            <Stack gap={1} flex="1" minW={0}>
              <Text fontWeight="semibold" fontSize="lg" lineClamp={2}>
                {row.entry.title}
              </Text>
              {secondaryLine ? (
                <Text fontSize="sm" color="fg.muted" lineClamp={2}>
                  {secondaryLine}
                </Text>
              ) : null}
            </Stack>
            <Text fontSize="sm" aria-hidden>
              {row.entry.category.emoji}
            </Text>
          </HStack>
          <StarRatingDisplay rating={row.rating} size="sm" />
          {row.body ? (
            <Text fontSize="sm" color="fg.muted" lineClamp={2}>
              “{row.body}”
            </Text>
          ) : null}
        </Stack>
      </Box>
    </RouterLink>
  );
}
