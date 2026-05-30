import { Box, Heading, HStack, SimpleGrid, Tabs, Text, VStack } from "@chakra-ui/react";
import { useState } from "react";

import CombatHandCard from "./CombatHandCard";
import SquallsActionCard from "./SquallsActionCard";
import { getCardEnergyCost } from "./combatRules";
import {
  checkBuyTavernCard,
  checkRefineTavernCard,
  getTavernBuyPrice,
  getTavernCardOffers,
  TAVERN_REFINE_COST,
} from "./tavernCards";
import type { HeroType } from "./shantiesTypes";

type Props = {
  hero: HeroType;
  tavernMessage: string | null;
  onBuyCard: (offerId: string) => void;
  onRefineCard: (deckIndex: number) => void;
  onBack: () => void;
};

export default function TavernView({
  hero,
  tavernMessage,
  onBuyCard,
  onRefineCard,
  onBack,
}: Props) {
  const [tab, setTab] = useState<"buy" | "refine">("buy");
  const offers = getTavernCardOffers();

  return (
    <VStack align="stretch" gap={4} w="100%">
      <HStack w="100%" justify="space-between" align="flex-start" gap={2}>
        <VStack align="start" flex={1} minW={0} gap={1}>
          <Heading w="100%">🃏 Port Tavern</Heading>
          <Text fontSize="sm" color="gray.900">
            Buy new cards or pay to thin yer deck.
          </Text>
        </VStack>
        <Box flexShrink={0} w="7rem">
          <SquallsActionCard
            emoji="⚓"
            label="Back to Port"
            accent="blue"
            compact
            onClick={onBack}
          />
        </Box>
      </HStack>

      <Tabs.Root
        value={tab}
        onValueChange={(details) => setTab(details.value as "buy" | "refine")}
      >
        <Tabs.List>
          <Tabs.Trigger value="buy">Buy cards</Tabs.Trigger>
          <Tabs.Trigger value="refine">Refine deck</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="buy" pt={3}>
          <SimpleGrid columns={{ base: 2, md: 3 }} gap={2} w="100%" maxW="32rem">
            {offers.map((offer) => {
              const price = getTavernBuyPrice(hero, offer);
              const canBuy = checkBuyTavernCard(hero, offer.id).ok;
              const preview = offer.createCard();
              return (
                <Box key={offer.id}>
                  <Box
                    position="relative"
                    w="100%"
                    aspectRatio="2.5/3.5"
                    mb={1}
                  >
                    <CombatHandCard
                      card={preview}
                      cost={getCardEnergyCost(preview)}
                      equipped={hero.equipped}
                      viewOnly
                      fillSlot
                      onClick={() => {}}
                    />
                  </Box>
                  <SquallsActionCard
                    emoji="🃏"
                    label={`Buy (${price}g)`}
                    accent="teal"
                    compact
                    disabled={!canBuy}
                    onClick={() => onBuyCard(offer.id)}
                  />
                </Box>
              );
            })}
          </SimpleGrid>
        </Tabs.Content>

        <Tabs.Content value="refine" pt={3}>
          <Text fontSize="sm" color="gray.900" mb={2}>
            Remove a card for {TAVERN_REFINE_COST}g ({hero.deck.length} cards in
            deck)
          </Text>
          {hero.deck.length === 0 ? (
            <Text fontSize="sm" color="gray.900">
              Yer deck is empty.
            </Text>
          ) : (
            <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} gap={1.5}>
              {hero.deck.map((card, index) => {
                const canRefine = checkRefineTavernCard(hero, index).ok;
                return (
                  <Box key={`${card.name}-${index}`}>
                    <Box
                      position="relative"
                      w="100%"
                      aspectRatio="2.5/3.5"
                      mb={1}
                      opacity={canRefine ? 1 : 0.5}
                      cursor={canRefine ? "pointer" : "not-allowed"}
                      onClick={() => {
                        if (canRefine) onRefineCard(index);
                      }}
                    >
                      <CombatHandCard
                        card={card}
                        cost={getCardEnergyCost(card)}
                        equipped={hero.equipped}
                        viewOnly
                        fillSlot
                        onClick={() => {
                          if (canRefine) onRefineCard(index);
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </SimpleGrid>
          )}
        </Tabs.Content>
      </Tabs.Root>

      {tavernMessage ? (
        <Text fontSize="sm" color="gray.900">
          {tavernMessage}
        </Text>
      ) : null}
    </VStack>
  );
}
