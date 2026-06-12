import { Avatar, Box, HStack, Stack, Text } from "@chakra-ui/react";
import { useCallback, type KeyboardEvent } from "react";
import { Link as RouterLink, useNavigate } from "react-router";
import { achievementCategoryAppPath, achievementCategoryMeta } from "./achievementCategoryLabels";
import {
  resolveAvatarUrlForUser,
  useAppSession,
} from "../auth/AppSessionContext";
import { friendProfilePath } from "../friend/profilePaths";
import { APP_TEXT_SIZES, MAPPED_LIST_CARD_OUTER_PROPS } from "../theme/typography";
import { emojiForAchievementSlug } from "./achievementIcon";
import { hallOfFameCountLabel } from "./sortTrophyCase";
import type { HallOfFameRow as HallOfFameRowType } from "./types";

const COIN_SIZE = "3.5rem";
const MEDAL_GRADIENT =
  "linear-gradient(145deg, #f4e4a6 0%, #e8c547 28%, #d4af37 55%, #9a7209 100%)";
const LOCKED_COIN_GRADIENT =
  "linear-gradient(145deg, #e8e8e8 0%, #c8c8c8 45%, #9a9a9a 100%)";

function earnerProfilePath(earnerId: number, viewerId: number | null): string {
  if (viewerId != null && earnerId === viewerId) {
    return "/profile";
  }
  return friendProfilePath(earnerId);
}

export function HallOfFameRow({
  row,
  viewerId,
  highlighted = false,
}: {
  row: HallOfFameRowType;
  viewerId: number | null;
  highlighted?: boolean;
}) {
  const navigate = useNavigate();
  const { sessionUser, auth0User } = useAppSession();
  const isEarned = row.is_earned;
  const emoji = emojiForAchievementSlug(row.slug);
  const countLabel = isEarned ? hallOfFameCountLabel(row, viewerId ?? -1) : null;
  const overflow = Math.max(0, row.earner_count - row.earners.length);
  const appPath = achievementCategoryAppPath(row.category);
  const appLabel = achievementCategoryMeta(row.category).label;

  const openApp = useCallback(() => {
    navigate(appPath);
  }, [appPath, navigate]);

  const onCardKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openApp();
    },
    [openApp],
  );

  return (
    <Box
      id={`hall-of-fame-${row.slug}`}
      {...MAPPED_LIST_CARD_OUTER_PROPS}
      h="100%"
      bg={isEarned ? "white" : "gray.100"}
      borderWidth="1px"
      borderColor={highlighted ? "teal.solid" : "border"}
      borderRadius="xl"
      boxShadow={highlighted ? "md" : undefined}
      scrollMarginTop="5rem"
      opacity={isEarned ? 1 : 0.92}
      cursor="pointer"
      role="button"
      tabIndex={0}
      aria-label={`Open ${appLabel}`}
      onClick={openApp}
      onKeyDown={onCardKeyDown}
      _hover={{ borderColor: "teal.solid" }}
    >
      <HStack align="flex-start" gap="3" w="100%" minW={0}>
        <Box
          w={COIN_SIZE}
          h={COIN_SIZE}
          minW={COIN_SIZE}
          borderRadius="full"
          flexShrink={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          boxShadow={
            isEarned
              ? "inset 0 2px 4px rgba(255,255,255,0.45), 0 2px 6px rgba(0,0,0,0.14), 0 0 0 1px #8a6818"
              : "inset 0 1px 3px rgba(255,255,255,0.35), 0 1px 4px rgba(0,0,0,0.1), 0 0 0 1px #9a9a9a"
          }
          style={{ background: isEarned ? MEDAL_GRADIENT : LOCKED_COIN_GRADIENT }}
        >
          <Text
            fontSize="2.375rem"
            lineHeight="1"
            aria-hidden
            userSelect="none"
            style={isEarned ? undefined : { filter: "brightness(0)" }}
          >
            {emoji}
          </Text>
        </Box>
        <Stack gap="1" flex="1" minW={0}>
          <HStack justify="space-between" align="start" gap="2" w="100%" minW={0}>
            <Text
              fontSize={APP_TEXT_SIZES.body}
              fontWeight="bold"
              whiteSpace="pre-wrap"
              flex="1"
              minW={0}
              color={isEarned ? "fg" : "fg.muted"}
            >
              {row.title}
            </Text>
            {countLabel ? (
              <Text
                fontSize={APP_TEXT_SIZES.meta}
                color="gray.600"
                fontStyle="italic"
                flexShrink={0}
              >
                {countLabel}
              </Text>
            ) : null}
          </HStack>
          <Text
            fontSize={APP_TEXT_SIZES.helper}
            color={isEarned ? "black" : "fg.muted"}
            whiteSpace="pre-wrap"
            fontStyle={isEarned ? undefined : "italic"}
          >
            {isEarned ? row.description : "???"}
          </Text>
          {isEarned && row.earners.length > 0 ? (
            <HStack
              gap="1"
              flexWrap="wrap"
              pt="1"
              minW={0}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {row.earners.map((earner) => {
                const src = resolveAvatarUrlForUser(
                  earner.avatar_url,
                  earner.id,
                  sessionUser,
                  auth0User,
                );
                return (
                  <RouterLink
                    key={earner.id}
                    to={earnerProfilePath(earner.id, viewerId)}
                    aria-label={`${earner.nickname}'s profile`}
                    title={earner.nickname}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <Avatar.Root size="sm" flexShrink={0}>
                      <Avatar.Fallback name={earner.nickname} />
                      <Avatar.Image src={src || undefined} alt="" />
                    </Avatar.Root>
                  </RouterLink>
                );
              })}
              {overflow > 0 ? (
                <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" pl="1">
                  +{overflow} more
                </Text>
              ) : null}
            </HStack>
          ) : null}
        </Stack>
      </HStack>
    </Box>
  );
}
