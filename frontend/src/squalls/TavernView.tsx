import { Box, HStack, SimpleGrid, Tabs, Text, VStack } from "@chakra-ui/react";

import { SquallsHeading } from "./SquallsHeading";
import { useState } from "react";

import CombatHandCard from "./CombatHandCard";
import { minDeckSize } from "./combatDeck";
import SquallsActionCard from "./SquallsActionCard";
import { getCardEnergyCost } from "./combatRules";
import { SquallsPanelBackButton, SquallsTextZone } from "./SquallsActionSheet";
import {
  checkBuyTavernCard,
  checkRefineTavernCard,
  getTavernBuyPrice,
  getTavernCardOffers,
  TAVERN_REFINE_COST,
} from "./tavernCards";
import { createCombatCard } from "./squallsCardCatalog";
import type { HeroType } from "./shantiesTypes";
import { SQUALLS_TEXT_ZONE, SQUALLS_WORLD_PANEL } from "./squallsTheme";

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
  const offers = getTavernCardOffers(hero);
  const minimumDeck = minDeckSize(hero.level);

  return (
    <VStack align="stretch" gap={4} w="100%" {...SQUALLS_WORLD_PANEL} p={{ base: 3, md: 4 }}>
      <HStack w="100%" justify="space-between" align="flex-start" gap={3}>
        <VStack align="start" flex={1} minW={0} gap={1}>
          <SquallsHeading w="100%">Port Tavern</SquallsHeading>
          <Text fontSize="sm" color={SQUALLS_TEXT_ZONE.muted}>
            Buy new cards or pay to thin yer deck.
          </Text>
        </VStack>
        <SquallsPanelBackButton label="Return to port" onClick={onBack} />
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
          {offers.length === 0 ? (
            <Text fontSize="sm" color={SQUALLS_TEXT_ZONE.muted}>
              No cards available for yer current loadout.
            </Text>
          ) : (
            <SimpleGrid columns={{ base: 2, md: 3 }} gap={2} w="100%" maxW="32rem">
              {offers.map((offer) => {
                const price = getTavernBuyPrice(hero, offer.id);
                const canBuy = checkBuyTavernCard(hero, offer.id).ok;
                const preview = createCombatCard(offer.id);
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
                      label={`Acquire (${price}g)`}
                      accent="yellow"
                      compact={false}
                      disabled={!canBuy}
                      onClick={() => onBuyCard(offer.id)}
                    />
                  </Box>
                );
              })}
            </SimpleGrid>
          )}
        </Tabs.Content>

        <Tabs.Content value="refine" pt={3}>
          <Text fontSize="sm" color={SQUALLS_TEXT_ZONE.muted} mb={2}>
            Remove a card for {TAVERN_REFINE_COST}g ({hero.deck.length} cards in
            deck)
          </Text>
          <Text fontSize="sm" color={SQUALLS_TEXT_ZONE.muted} mb={2}>
            Minimum deck at level {hero.level}: {minimumDeck} cards
          </Text>
          {hero.deck.length === 0 ? (
            <Text fontSize="sm" color={SQUALLS_TEXT_ZONE.muted}>
              Yer deck is empty.
            </Text>
          ) : (
            <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} gap={1.5}>
              {hero.deck.map((cardId, index) => {
                const card = createCombatCard(cardId);
                const canRefine = checkRefineTavernCard(hero, index).ok;
                return (
                  <Box key={`${cardId}-${index}`}>
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
        <SquallsTextZone>
          <Text fontSize="sm" color="#5A4732">
            {tavernMessage}
          </Text>
        </SquallsTextZone>
      ) : null}
    </VStack>
  );
}
