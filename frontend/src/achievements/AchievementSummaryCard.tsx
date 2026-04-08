import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { APP_TEXT_SIZES, MAPPED_LIST_CARD_OUTER_PROPS } from "../theme/typography";
import { emojiForAchievementSlug } from "./achievementIcon";
import type { AchievementSummary } from "./types";

const CARD_PROPS = {
  bg: "white",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "xl",
  ...MAPPED_LIST_CARD_OUTER_PROPS,
} as const;

const COIN_SIZE = "3.5rem";

const MEDAL_GRADIENT =
  "linear-gradient(145deg, #f4e4a6 0%, #e8c547 28%, #d4af37 55%, #9a7209 100%)";

function formatUnlockedDate(unlockedAt: string): string {
  const parsed = new Date(unlockedAt);
  if (Number.isNaN(parsed.getTime())) return "--/--/--";
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const yy = String(parsed.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

/** Bordered card with gold coin + slug-driven emoji, bold title, description. */
export function AchievementSummaryCard({ achievement: a }: { achievement: AchievementSummary }) {
  const emoji = emojiForAchievementSlug(a.slug);
  const earnedOn = formatUnlockedDate(a.unlocked_at);

  return (
    <Box {...CARD_PROPS}>
      <HStack align="center" gap="3" w="100%">
        <Box
          w={COIN_SIZE}
          h={COIN_SIZE}
          minW={COIN_SIZE}
          borderRadius="full"
          flexShrink={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          boxShadow="inset 0 2px 4px rgba(255,255,255,0.45), 0 2px 6px rgba(0,0,0,0.14), 0 0 0 1px #8a6818"
          style={{ background: MEDAL_GRADIENT }}
        >
          <Text fontSize="2.375rem" lineHeight="1" aria-hidden userSelect="none">
            {emoji}
          </Text>
        </Box>
        <Stack gap="1" flex="1" minW={0}>
          <HStack align="flex-start" gap="2" w="100%" minW={0}>
            <Text
              fontSize={APP_TEXT_SIZES.body}
              fontWeight="bold"
              whiteSpace="pre-wrap"
              flex="1"
              minW={0}
            >
              {a.title}
            </Text>
            <Text
              fontSize={APP_TEXT_SIZES.meta}
              color="gray.600"
              fontStyle="italic"
              flexShrink={0}
              lineHeight="short"
              pt="0.5"
            >
              Earned {earnedOn}
            </Text>
          </HStack>
          {a.description ? (
            <Text fontSize={APP_TEXT_SIZES.helper} color="black" whiteSpace="pre-wrap">
              {a.description}
            </Text>
          ) : null}
        </Stack>
      </HStack>
    </Box>
  );
}
