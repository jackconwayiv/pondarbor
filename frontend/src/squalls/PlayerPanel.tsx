import { Badge, HStack, chakra } from "@chakra-ui/react";

import { clampHp } from "./combatRules";
import type { PlayerPanelProps } from "./shantiesTypes";
import { SQUALLS_HUD_COLORS } from "./squallsTheme";

const IdentityButton = chakra("button");

export default function PlayerPanel({
  hero,
  gameState,
  armor,
  weakened = false,
  onOpenCharacterSheet,
}: PlayerPanelProps) {
  const inCombat = gameState === "battle";
  const showGoldInStripe =
    gameState === "shop" || gameState === "rest" || gameState === "tavern";

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
          _focusVisible={{
            outline: `2px solid ${SQUALLS_HUD_COLORS.focusRing}`,
            outlineOffset: "2px",
            borderRadius: "sm",
          }}
        >
          {hero.name}
        </IdentityButton>
        <IdentityButton
          type="button"
          onClick={onOpenCharacterSheet}
          fontSize="xs"
          color={SQUALLS_HUD_COLORS.panelMuted}
          bg="transparent"
          border="none"
          p={0}
          cursor="pointer"
          textDecoration="underline"
          textDecorationColor="transparent"
          _hover={{ textDecorationColor: "currentColor" }}
          _focusVisible={{
            outline: `2px solid ${SQUALLS_HUD_COLORS.focusRing}`,
            outlineOffset: "2px",
            borderRadius: "sm",
          }}
        >
          {hero.class}
        </IdentityButton>
      </HStack>
      <HStack gap={2} flexShrink={0} flexWrap="wrap" justify="flex-end">
        {inCombat ? (
          <Badge size="sm" bg="rgba(90, 63, 38, 0.85)" color="gray.50" variant="solid">
            🔫 {hero.ammo}/{hero.max_ammo}
          </Badge>
        ) : null}
        {inCombat && armor > 0 ? (
          <Badge size="sm" bg="rgba(56, 98, 122, 0.9)" color="gray.50" variant="solid">
            🛡 {armor}
          </Badge>
        ) : null}
        {inCombat && weakened ? (
          <Badge size="sm" bg="rgba(163, 93, 37, 0.92)" color="gray.50" variant="solid">
            Weakened
          </Badge>
        ) : null}
        {showGoldInStripe ? (
          <Badge size="sm" bg="#FACC15" color="#1A1208" variant="solid">
            {hero.gold} gold
          </Badge>
        ) : null}
        <Badge size="sm" bg="rgba(134, 44, 36, 0.9)" color="gray.50">
          HP {clampHp(hero.current_hp)}/{clampHp(hero.max_hp)}
        </Badge>
      </HStack>
    </HStack>
  );
}
