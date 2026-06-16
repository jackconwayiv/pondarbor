import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { Link as RouterLink, useLocation, useSearchParams } from "react-router";
import StarRatingDisplay, { ReviewerAvatarRow } from "./StarRatingDisplay";
import { entryHref } from "./entryModalNav";
import { formatEntrySecondaryLine } from "./utils";
import type { RecommendationEntry } from "./types";

type EntryListCardProps = {
  entry: RecommendationEntry;
  /** @deprecated use entry.category.slug */
  categorySlug?: string;
};

export default function EntryListCard({ entry }: EntryListCardProps) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const detailTo = entryHref(location.pathname, searchParams, entry.id);
  const latestReview = entry.reviews?.[0];
  const secondaryLine = formatEntrySecondaryLine(entry);
  return (
    <RouterLink
      to={detailTo}
      aria-label={`Open recommendation: ${entry.title}`}
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
        {entry.image_url ? (
          <Box h="40" overflow="hidden" bg="bg.muted">
            <img
              src={entry.image_url}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Box>
        ) : null}
        <Stack gap={2} p={4}>
          <HStack justify="space-between" align="start" gap={3}>
            <Stack gap={1} flex="1" minW={0}>
              <Text fontWeight="semibold" fontSize="lg" lineClamp={2}>
                {entry.title}
              </Text>
              {secondaryLine ? (
                <Text fontSize="sm" color="fg.muted" lineClamp={2}>
                  {secondaryLine}
                </Text>
              ) : null}
            </Stack>
            <Text fontSize="sm" aria-hidden>
              {entry.category.emoji}
            </Text>
          </HStack>
          <StarRatingDisplay
            rating={entry.average_rating}
            count={entry.review_count}
            size="sm"
          />
          <ReviewerAvatarRow reviewers={entry.reviewer_avatars} />
          {latestReview?.body ? (
            <Text fontSize="sm" color="fg.muted" lineClamp={2}>
              “{latestReview.body}”
            </Text>
          ) : null}
        </Stack>
      </Box>
    </RouterLink>
  );
}
