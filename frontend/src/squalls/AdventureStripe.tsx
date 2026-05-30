import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { getDungeonCombatPlaceLabel } from "./dungeonExplore";
import type { AdventureStripeProps } from "./shantiesTypes";
import { SQUALLS_HUD_COLORS } from "./squallsTheme";

function formatStripePlaceLabel(props: AdventureStripeProps): string {
  const { gameState, location, currentDungeon, renderDungeonName } = props;
  if (gameState === "battle") {
    if (location === "dungeon" && currentDungeon) {
      return getDungeonCombatPlaceLabel(currentDungeon.kind);
    }
    if (location === "ship") return "Ship Combat";
    if (location === "island") return "Island Combat";
    if (location === "port") return "Port Combat";
    return "Combat";
  }
  if (location === "port") return "Port Town";
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
  if (location === "port") return "⚓ ";
  return "🏝️ ";
}

export default function AdventureStripe(props: AdventureStripeProps) {
  const {
    gameState,
    location,
    currentDungeon,
    onOpenCharacterSheet,
  } = props;
  const placeLabel = formatStripePlaceLabel(props);
  const placePrefix = stripePlacePrefix(gameState, location, currentDungeon);

  return (
    <HStack w="100%" gap={2} align="center" minW={0}>
      <Box
        flex={1}
        minW={0}
        px={2}
        py={1}
        borderRadius="md"
        bg="rgba(0, 0, 0, 0.16)"
        borderWidth="1px"
        borderColor={SQUALLS_HUD_COLORS.panelBorder}
      >
        <Text
          fontSize="sm"
          fontWeight="semibold"
          lineClamp={2}
          minW={0}
          color={SQUALLS_HUD_COLORS.panelText}
        >
          {placePrefix}
          {placeLabel}
        </Text>
      </Box>
      <Button
        type="button"
        size="xs"
        minW="2rem"
        h="2rem"
        px={0}
        flexShrink={0}
        variant="ghost"
        color={SQUALLS_HUD_COLORS.panelText}
        borderWidth="1px"
        borderColor={SQUALLS_HUD_COLORS.panelBorder}
        bg="rgba(0,0,0,0.2)"
        aria-label="Open character details"
        onClick={onOpenCharacterSheet}
      >
        📜
      </Button>
    </HStack>
  );
}
