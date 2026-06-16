import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { useAuth0 } from "@auth0/auth0-react";
import { resolveAvatarUrlForUser, useAppSession } from "../auth/AppSessionContext";
import StarRatingDisplay from "./StarRatingDisplay";
import { formatEditedAt, formatRecommendationDate } from "./utils";
import type { RecommendationReview } from "./types";

type EntryReviewListProps = {
  reviews: RecommendationReview[];
};

export default function EntryReviewList({ reviews }: EntryReviewListProps) {
  const { sessionUser } = useAppSession();
  const { user: auth0User } = useAuth0();

  if (!reviews.length) {
    return (
      <Text color="fg.muted" fontSize="sm">
        No reviews yet.
      </Text>
    );
  }

  return (
    <Stack gap={2}>
      {reviews.map((review) => {
        const avatar = resolveAvatarUrlForUser(
          review.reviewer.avatar_url,
          review.reviewer.id,
          sessionUser,
          auth0User,
        );
        const edited = formatEditedAt(review.edited_at);
        return (
          <Box key={review.id}>
            <HStack gap={2} align="start">
              <Box
                w="10"
                h="10"
                borderRadius="full"
                overflow="hidden"
                bg="bg.muted"
                flexShrink={0}
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Text textAlign="center" lineHeight="2.5rem" fontSize="sm">
                    {(review.reviewer.nickname || "?").charAt(0).toUpperCase()}
                  </Text>
                )}
              </Box>
              <Stack gap={0.5} flex="1" minW={0}>
                <HStack justify="space-between" flexWrap="wrap" gap={2}>
                  <Text fontWeight="semibold">{review.reviewer.nickname}</Text>
                  <Text fontSize="sm" color="fg.muted">
                    {formatRecommendationDate(review.date_recommended) ?? review.date_recommended}
                  </Text>
                </HStack>
                <StarRatingDisplay rating={review.rating} size="sm" />
                <Text whiteSpace="pre-wrap">{review.body}</Text>
                {edited ? (
                  <Text fontSize="xs" color="fg.muted">
                    {edited}
                  </Text>
                ) : null}
              </Stack>
            </HStack>
          </Box>
        );
      })}
    </Stack>
  );
}
