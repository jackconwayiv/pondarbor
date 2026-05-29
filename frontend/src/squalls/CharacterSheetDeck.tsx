import { Box, SimpleGrid, Text, VStack } from "@chakra-ui/react";

import CombatHandCard from "./CombatHandCard";
import { getCardEnergyCost } from "./combatRules";
import type { CombatCard, EquippedGear } from "./shantiesTypes";

type Props = {
  deck: CombatCard[];
  equipped: EquippedGear;
};

export default function CharacterSheetDeck({ deck, equipped }: Props) {
  return (
    <VStack align="stretch" gap={3}>
      <Text fontSize="sm" color="gray.900">
        {deck.length} cards · deck editing coming soon
      </Text>
      {deck.length === 0 ? (
        <Text fontSize="sm" color="gray.900">
          Yer deck is empty.
        </Text>
      ) : (
        <SimpleGrid columns={3} gap={1.5} w="100%">
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
      )}
    </VStack>
  );
}
