import { Badge, HStack, Text } from "@chakra-ui/react";

import { getDungeonCombatPlaceLabel } from "./dungeonExplore";
import { formatPlaceLabel } from "./shantiesSaveSummary";
import type { AdventureStripeProps } from "./shantiesTypes";

function formatStripePlaceLabel(props: AdventureStripeProps): string {
  const { gameState, location, currentIsland, currentDungeon, renderIslandName, renderDungeonName } =
    props;
  if (gameState === "battle") {
    if (location === "dungeon" && currentDungeon) {
      return getDungeonCombatPlaceLabel(currentDungeon.kind);
    }
    if (location === "ship") return "Ship Combat";
    if (location === "island") return "Island Combat";
    return "Combat";
  }
  return formatPlaceLabel(
    location,
    currentIsland,
    renderIslandName,
    currentDungeon,
    renderDungeonName,
  );
}

function stripePlacePrefix(
  gameState: AdventureStripeProps["gameState"],
  location: AdventureStripeProps["location"],
): string {
  if (gameState === "battle") return "⚔️ ";
  if (location === "dungeon") return "🕳️ ";
  if (location === "ship") return "⛵ ";
  return "🏝️ ";
}

export default function AdventureStripe(props: AdventureStripeProps) {
  const { day, gameState, location } = props;
  const placeLabel = formatStripePlaceLabel(props);
  const placePrefix = stripePlacePrefix(gameState, location);

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
