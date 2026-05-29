import { Box, SimpleGrid, Text, VStack } from "@chakra-ui/react";

import CombatHandCard from "../../CombatHandCard";
import { createStarterDeck } from "../../combatDeck";
import { getCardEnergyCost } from "../../combatRules";
import { createStarterEquipped } from "../../shantiesEquipment";
import { STARTER_DECK_COMPOSITION } from "../squallsDmCatalog";
import { DmPanelIntro, DmSectionHeading } from "./DmStatRow";

export default function DmCardsPanel() {
  const deck = createStarterDeck();
  const equipped = createStarterEquipped();

  return (
    <VStack align="stretch" gap={4}>
      <DmPanelIntro>
        {`Starter deck (${deck.length} cards). Damage and armor ranges reflect starter equipped gear (Rusty Cutlass, Sooty Pistol, Sailor's Garb).`}
      </DmPanelIntro>

      <Box>
        <DmSectionHeading>Composition</DmSectionHeading>
        <Text fontSize="sm" color="gray.900" mt={1}>
          {STARTER_DECK_COMPOSITION.map((row) => `${row.count}× ${row.label}`).join(" · ")}
        </Text>
      </Box>

      <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} gap={1.5}>
        {deck.map((card, index) => (
          <Box
            key={`${card.name}-${index}`}
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
        ))}
      </SimpleGrid>
    </VStack>
  );
}
