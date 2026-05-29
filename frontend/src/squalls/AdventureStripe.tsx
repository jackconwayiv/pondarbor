import { Badge, HStack, Text } from "@chakra-ui/react";

import { getDungeonCombatPlaceLabel } from "./dungeonExplore";
import type { AdventureStripeProps } from "./shantiesTypes";

function formatStripePlaceLabel(props: AdventureStripeProps): string {
  const { gameState, location, currentDungeon, renderDungeonName } = props;
  if (gameState === "battle") {
    if (location === "dungeon" && currentDungeon) {
      return getDungeonCombatPlaceLabel(currentDungeon.kind);
    }
    if (location === "ship") return "Ship Combat";
    if (location === "island") return "Island Combat";
    return "Combat";
  }
  if (location === "island") return "Island";
  if (location === "dungeon" && currentDungeon) {
    return renderDungeonName(currentDungeon);
  }
  if (location === "dungeon") return "Dungeon";
  return "Ship";
}

function stripePlacePrefix(
  gameState: AdventureStripeProps["gameState"],
  location: AdventureStripeProps["location"],
  currentDungeon: AdventureStripeProps["currentDungeon"],
): string {
  if (gameState === "battle") return "⚔️ ";
  if (location === "dungeon") {
    if (currentDungeon?.kind === "wreck") return "🚢 ";
    return "🕳️ ";
  }
  if (location === "ship") return "⛵ ";
  return "🏝️ ";
}

export default function AdventureStripe(props: AdventureStripeProps) {
  const { day, gameState, location, currentDungeon } = props;
  const placeLabel = formatStripePlaceLabel(props);
  const placePrefix = stripePlacePrefix(gameState, location, currentDungeon);

  return (
    <HStack w="100%" gap={2} align="center" flexWrap="wrap" minW={0}>
      <Badge size="sm" colorPalette="blue" variant="solid" flexShrink={0}>
        Day {day}
      </Badge>
      <Text fontSize="sm" fontWeight="semibold" lineClamp={2} minW={0}>
        {placePrefix}
        {placeLabel}
      </Text>
    </HStack>
  );
}
