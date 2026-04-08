import { Box, Checkbox, HStack, Stack, Text } from "@chakra-ui/react";
import { useIsMobile } from "../responsive";
import { APP_TEXT_SIZES, MAPPED_LIST_CARD_OUTER_PROPS } from "../theme/typography";
import { emojiForAchievementSlug } from "./achievementIcon";
import type { AchievementSummary } from "./types";

const BASE_CARD_PROPS = {
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

export type AchievementVisibilityToggle = {
  checked: boolean;
  onCheckedChange: (visibleToFriends: boolean) => void;
};

/** Bordered card with gold coin + slug-driven emoji, bold title, description. */
export function AchievementSummaryCard({
  achievement: a,
  visibilityToggle,
}: {
  achievement: AchievementSummary;
  visibilityToggle?: AchievementVisibilityToggle;
}) {
  const isMobile = useIsMobile();
  const emoji = emojiForAchievementSlug(a.slug);
  const earnedOn = formatUnlockedDate(a.unlocked_at);
  const earnedLine = (
    <Text
      fontSize={APP_TEXT_SIZES.meta}
      color="gray.600"
      fontStyle="italic"
      lineHeight="short"
      flexShrink={0}
      pt={isMobile ? undefined : "0.5"}
    >
      Earned {earnedOn}
    </Text>
  );
  const shownToFriends = visibilityToggle
    ? a.visible_to_friends !== false
    : true;
  const bg = shownToFriends ? "white" : "gray.200";

  return (
    <Box {...BASE_CARD_PROPS} bg={bg}>
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
          boxShadow="inset 0 2px 4px rgba(255,255,255,0.45), 0 2px 6px rgba(0,0,0,0.14), 0 0 0 1px #8a6818"
          style={{ background: MEDAL_GRADIENT }}
        >
          <Text fontSize="2.375rem" lineHeight="1" aria-hidden userSelect="none">
            {emoji}
          </Text>
        </Box>
        <Stack gap="1" flex="1" minW={0}>
          {isMobile ? (
            <>
              <Text
                fontSize={APP_TEXT_SIZES.body}
                fontWeight="bold"
                whiteSpace="pre-wrap"
                w="100%"
                minW={0}
              >
                {a.title}
              </Text>
              {earnedLine}
            </>
          ) : (
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
              {earnedLine}
            </HStack>
          )}
          {a.description ? (
            <Text fontSize={APP_TEXT_SIZES.helper} color="black" whiteSpace="pre-wrap">
              {a.description}
            </Text>
          ) : null}
          {visibilityToggle ? (
            <Box w="100%" display="flex" justifyContent="flex-end" mt="1">
              <Checkbox.Root
                checked={visibilityToggle.checked}
                colorPalette="lilypad"
                size="sm"
                display="flex"
                flexDirection="row-reverse"
                alignItems="center"
                gap="2"
                onCheckedChange={(d) => {
                  visibilityToggle.onCheckedChange(d.checked === true);
                }}
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control flexShrink={0}>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Label
                  fontSize={{ base: "2xs", md: "xs" }}
                  fontWeight="medium"
                  lineHeight="short"
                >
                  Show to friends
                </Checkbox.Label>
              </Checkbox.Root>
            </Box>
          ) : null}
        </Stack>
      </HStack>
    </Box>
  );
}
