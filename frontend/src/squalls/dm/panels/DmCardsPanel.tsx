import { Box, SimpleGrid, Text, VStack } from "@chakra-ui/react";

import CombatHandCard from "../../CombatHandCard";
import { createStarterDeck, minDeckSize } from "../../combatDeck";
import { getCardEnergyCost } from "../../combatRules";
import { createCombatCard } from "../../squallsCardCatalog";
import { createStarterEquipped } from "../../shantiesEquipment";
import { STARTER_DECK_COMPOSITION } from "../squallsDmCatalog";
import { SQUALLS_HUD_COLORS } from "../../squallsTheme";
import { DmPanelIntro, DmSectionHeading } from "./DmStatRow";

export default function DmCardsPanel() {
  const deck = createStarterDeck();
  const equipped = createStarterEquipped();

  return (
    <VStack align="stretch" gap={4}>
      <DmPanelIntro>
        {`Starter deck (${deck.length} cards). Damage and armor ranges reflect starter equipped gear (Rusty Cutlass, Sooty Pistol, Sailor's Garb). Level 1 minimum deck size is ${minDeckSize(1)}.`}
      </DmPanelIntro>

      <Box>
        <DmSectionHeading>Composition</DmSectionHeading>
        <Text fontSize="sm" color={SQUALLS_HUD_COLORS.panelMuted} mt={1}>
          {STARTER_DECK_COMPOSITION.map((row) => `${row.count}× ${row.label}`).join(" · ")}
        </Text>
        <Text fontSize="sm" color={SQUALLS_HUD_COLORS.panelMuted} mt={1}>
          Level-up rewards: roll 3 cards from pools allowed by equipped gear
          (all 6 slots), choose 1 to unlock and add to deck.
        </Text>
      </Box>

      <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} gap={1.5}>
        {deck.map((cardId, index) => {
          const card = createCombatCard(cardId);
          return (
          <Box
            key={`${cardId}-${index}`}
            position="relative"
            w="100%"
            aspectRatio="2.5/3.5"
          >
            <CombatHandCard
              card={card}
              cost={getCardEnergyCost(card)}
              equipped={equipped}
              viewOnly
              fillSlot
              onClick={() => {}}
            />
          </Box>
          );
        })}
      </SimpleGrid>
    </VStack>
  );
}
