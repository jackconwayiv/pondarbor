import { Badge, HStack, chakra } from "@chakra-ui/react";

import { clampHp } from "./combatRules";
import type { PlayerPanelProps } from "./shantiesTypes";

const IdentityButton = chakra("button");

export default function PlayerPanel({
  hero,
  gameState,
  armor,
  onOpenCharacterSheet,
}: PlayerPanelProps) {
  const inCombat = gameState === "battle";
  const showGoldInStripe = gameState === "shop" || gameState === "rest";

  return (
    <HStack
      w="100%"
      gap={2}
      align="center"
      flexWrap="wrap"
      justify="space-between"
    >
      <HStack gap={2} minW={0} flexWrap="wrap">
        <IdentityButton
          type="button"
          onClick={onOpenCharacterSheet}
          fontWeight="bold"
          fontSize="sm"
          lineClamp={1}
          textAlign="left"
          color="inherit"
          bg="transparent"
          border="none"
          p={0}
          cursor="pointer"
          textDecoration="underline"
          textDecorationColor="transparent"
          _hover={{ textDecorationColor: "currentColor" }}
        >
          {hero.name}
        </IdentityButton>
        <IdentityButton
          type="button"
          onClick={onOpenCharacterSheet}
          fontSize="xs"
          color="fg.muted"
          bg="transparent"
          border="none"
          p={0}
          cursor="pointer"
          textDecoration="underline"
          textDecorationColor="transparent"
          _hover={{ textDecorationColor: "currentColor" }}
        >
          {hero.class}
        </IdentityButton>
      </HStack>
      <HStack gap={2} flexShrink={0} flexWrap="wrap" justify="flex-end">
        {inCombat && armor > 0 ? (
          <Badge size="sm" colorPalette="cyan" variant="solid">
            🛡 {armor}
          </Badge>
        ) : null}
        {showGoldInStripe ? (
          <Badge size="sm" colorPalette="yellow" variant="solid">
            {hero.gold} gold
          </Badge>
        ) : null}
        <Badge size="sm" colorPalette="red">
          HP {clampHp(hero.current_hp)}/{clampHp(hero.max_hp)}
        </Badge>
      </HStack>
    </HStack>
  );
}
