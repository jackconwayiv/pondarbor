import { Box, HStack, Text } from "@chakra-ui/react";

import {
  enemyBroadcastColor,
  formatEnemyBroadcastLine,
} from "./enemyActions";
import { formatEnemyHp, getEnemyDisplayTraits } from "./combatRules";
import type { EnemyType } from "./shantiesTypes";

const CARD_OUTER_BORDER = "#000000";
const CARD_INNER_BG = "#FFFFFF";
const CARD_TITLE_COLOR = "#1A1A1A";
const CARD_BODY_COLOR = "#4A4A4A";
const MONSTER_STRIP_COLOR = "#D7874C";
const BOSS_STRIP_COLOR = "#C44A2A";
const SLAIN_STRIP_COLOR = "#6B7280";
const SLAIN_INNER_BG = "#E8E8E8";
/** Reserved line height for optional trait/armor rows so cards stay uniform. */
const SECONDARY_ROW_MIN_H = "0.875rem";

type Props = {
  enemy: EnemyType;
  heroLevel: number;
  slain: boolean;
};

export default function CombatEnemyCard({ enemy, heroLevel, slain }: Props) {
  const traits = getEnemyDisplayTraits(enemy);
  const stripColor = slain
    ? SLAIN_STRIP_COLOR
    : enemy.isBoss
      ? BOSS_STRIP_COLOR
      : MONSTER_STRIP_COLOR;

  return (
    <Box
      w="100%"
      borderRadius="md"
      borderWidth="2px"
      borderColor={slain ? "gray.500" : CARD_OUTER_BORDER}
      bg={stripColor}
      p="2px"
      boxShadow="md"
      opacity={slain ? 0.75 : 1}
      filter={slain ? "grayscale(0.65)" : undefined}
      pointerEvents={slain ? "none" : undefined}
    >
      <Box
        display="flex"
        flexDirection="column"
        gap={0.5}
        bg={slain ? SLAIN_INNER_BG : CARD_INNER_BG}
        borderRadius="sm"
        p={1}
        color={CARD_TITLE_COLOR}
      >
        <HStack w="100%" justify="space-between" align="center" gap={1} minW={0}>
          <Text
            fontWeight="bold"
            fontSize="xs"
            lineClamp={1}
            flex={1}
            color={CARD_TITLE_COLOR}
          >
            {enemy.isBoss ? `Boss: ${enemy.name}` : enemy.name}
          </Text>
          <Text
            fontSize="xs"
            fontWeight="semibold"
            flexShrink={0}
            color={CARD_BODY_COLOR}
          >
            {formatEnemyHp(enemy)}
          </Text>
        </HStack>
        <Text
          fontSize="xs"
          fontWeight="semibold"
          textAlign="center"
          minH="1rem"
          lineHeight="1rem"
          color={
            slain ? CARD_BODY_COLOR : enemyBroadcastColor(enemy.broadcast)
          }
        >
          {formatEnemyBroadcastLine(enemy, heroLevel, slain)}
        </Text>
        <Text
          fontSize="2xs"
          fontWeight="semibold"
          textAlign="center"
          minH={SECONDARY_ROW_MIN_H}
          lineHeight={SECONDARY_ROW_MIN_H}
          color={!slain && traits.length > 0 ? "purple.700" : "transparent"}
          aria-hidden={slain || traits.length === 0}
        >
          {!slain && traits.length > 0 ? traits.join(", ") : "\u00a0"}
        </Text>
        <Text
          fontSize="2xs"
          textAlign="center"
          minH={SECONDARY_ROW_MIN_H}
          lineHeight={SECONDARY_ROW_MIN_H}
          color={!slain && enemy.armor > 0 ? CARD_BODY_COLOR : "transparent"}
          aria-hidden={slain || enemy.armor <= 0}
        >
          {!slain && enemy.armor > 0 ? `Armor ${enemy.armor}` : "\u00a0"}
        </Text>
      </Box>
    </Box>
  );
}
