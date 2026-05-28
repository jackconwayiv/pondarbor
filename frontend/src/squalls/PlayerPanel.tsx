import { Badge, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import type { PlayerPanelProps } from "./shantiesTypes";

export default function PlayerPanel({
  hero,
  gameState,
  location,
}: PlayerPanelProps) {
  return (
    <VStack align="start">
      <Heading size="md">
        {hero.name} — {hero.class}
      </Heading>

      <HStack>
        <Badge>
          HP {hero.current_hp}/{hero.max_hp}
        </Badge>
        <Badge>Gold {hero.gold}</Badge>
        <Badge>{location}</Badge>
        <Badge>{gameState}</Badge>
      </HStack>

      <Text fontSize="sm">Deck size: {hero.deck.length}</Text>
    </VStack>
  );
}
