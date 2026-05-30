import { Box, SimpleGrid, Text, VStack } from "@chakra-ui/react";

import CombatHandCard from "./CombatHandCard";
import { getCardEnergyCost } from "./combatRules";
import type { CombatCard, EquippedGear } from "./shantiesTypes";
import { SquallsHeading } from "./SquallsHeading";
import { SQUALLS_WORLD_PANEL, SQUALLS_TEXT_ZONE } from "./squallsTheme";

type Props = {
  choices: CombatCard[];
  equipped: EquippedGear;
  onChoose: (choiceIndex: number) => void;
};

export default function LevelUpPickerView({ choices, equipped, onChoose }: Props) {
  return (
    <VStack align="stretch" gap={4} w="100%" {...SQUALLS_WORLD_PANEL} p={{ base: 3, md: 4 }}>
      <SquallsHeading>Level Up! Choose A Card</SquallsHeading>
      <Text fontSize="sm" color={SQUALLS_TEXT_ZONE.muted}>
        Pick one card to add to yer deck.
      </Text>
      <SimpleGrid columns={3} gap={1.5} w="100%">
        {choices.map((card, index) => (
          <Box key={`${card.id}-${index}`} position="relative" w="100%" aspectRatio="2.5/3.5">
            <CombatHandCard
              card={card}
              cost={getCardEnergyCost(card)}
              equipped={equipped}
              fillSlot
              onClick={() => onChoose(index)}
            />
          </Box>
        ))}
      </SimpleGrid>
    </VStack>
  );
}
