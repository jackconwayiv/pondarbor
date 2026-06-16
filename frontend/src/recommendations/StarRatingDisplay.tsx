import { Box, HStack, Text } from "@chakra-ui/react";
import { useAuth0 } from "@auth0/auth0-react";
import { resolveAvatarUrlForUser, useAppSession } from "../auth/AppSessionContext";
import { formatRatingSigFigs, starFillPercent } from "./utils";
import type { RecommendationUser } from "./types";

type StarRatingDisplayProps = {
  rating: number | string | null | undefined;
  count?: number;
  size?: "sm" | "md";
};

export default function StarRatingDisplay({
  rating,
  count,
  size = "md",
}: StarRatingDisplayProps) {
  const n =
    rating == null || rating === ""
      ? null
      : typeof rating === "string"
        ? Number.parseFloat(rating)
        : rating;
  const fontSize = size === "sm" ? "sm" : "md";
  if (n == null || !Number.isFinite(n)) {
    return (
      <Text fontSize={fontSize} color="fg.muted">
        No ratings yet
      </Text>
    );
  }
  return (
    <HStack gap={1} align="center">
      <Box position="relative" display="inline-block" fontSize={fontSize} lineHeight="1">
        <Text color="fg.muted" aria-hidden>
          ★★★★★
        </Text>
        <Box
          position="absolute"
          top={0}
          left={0}
          overflow="hidden"
          whiteSpace="nowrap"
          color="orange.400"
          style={{ width: `${starFillPercent(n)}%` }}
          aria-hidden
        >
          ★★★★★
        </Box>
      </Box>
      <Text fontSize={fontSize} fontWeight="semibold">
        {formatRatingSigFigs(n)}
      </Text>
      {count != null ? (
        <Text fontSize={fontSize} color="fg.muted">
          · {count} {count === 1 ? "review" : "reviews"}
        </Text>
      ) : null}
    </HStack>
  );
}

type ReviewerAvatarRowProps = {
  reviewers: RecommendationUser[];
  max?: number;
};

export function ReviewerAvatarRow({ reviewers, max = 8 }: ReviewerAvatarRowProps) {
  const { sessionUser } = useAppSession();
  const { user: auth0User } = useAuth0();

  if (!reviewers.length) return null;
  const shown = reviewers.slice(0, max);
  const overflow = reviewers.length - shown.length;
  return (
    <HStack gap={0}>
      {shown.map((u, i) => {
        const url = resolveAvatarUrlForUser(u.avatar_url, u.id, sessionUser, auth0User);
        return (
          <Box
            key={u.id}
            as="span"
            ml={i === 0 ? 0 : -2}
            w="7"
            h="7"
            borderRadius="full"
            borderWidth="2px"
            borderColor="bg.panel"
            overflow="hidden"
            bg="bg.muted"
            flexShrink={0}
            title={u.nickname}
          >
            {url ? (
              <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <Text fontSize="xs" textAlign="center" lineHeight="1.75rem">
                {(u.nickname || "?").charAt(0).toUpperCase()}
              </Text>
            )}
          </Box>
        );
      })}
      {overflow > 0 ? (
        <Text fontSize="xs" color="fg.muted" ml={1}>
          +{overflow}
        </Text>
      ) : null}
    </HStack>
  );
}
