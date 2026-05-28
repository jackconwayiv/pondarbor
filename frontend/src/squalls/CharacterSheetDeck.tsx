import { Box, SimpleGrid, Text, VStack } from "@chakra-ui/react";

import CombatHandCard from "./CombatHandCard";
import { getCardEnergyCost } from "./combatRules";
import type { CombatCard } from "./shantiesTypes";

type Props = {
  deck: CombatCard[];
};

export default function CharacterSheetDeck({ deck }: Props) {
  return (
    <VStack align="stretch" gap={3}>
      <Text fontSize="sm" color="fg.muted">
        {deck.length} cards · deck editing coming soon
      </Text>
      {deck.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">
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
