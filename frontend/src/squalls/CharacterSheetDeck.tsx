import { Box, SimpleGrid, Tabs, Text, VStack } from "@chakra-ui/react";
import { useMemo, useState } from "react";

import CharacterSheetCardDetail from "./CharacterSheetCardDetail";
import CardCopyPips from "./CardCopyPips";
import { minDeckSize } from "./combatDeck";
import CombatHandCard from "./CombatHandCard";
import { getCardEnergyCost } from "./combatRules";
import {
  CARD_CATALOG,
  CARD_CLASS_LABELS,
  CARD_CLASS_TAB_ORDER,
  cardsOwnedInClass,
  countCardCopies,
  countDeckCopies,
  createCombatCard,
  getAllowedCardClasses,
  isCardClassAllowed,
  RARITY_COPY_LIMITS,
  spareCollectionCopies,
  type CardClass,
  type CardId,
} from "./squallsCardCatalog";
import { isDeckValid, validateDeck } from "./deckValidation";
import type { EquippedGear, HeroType } from "./shantiesTypes";

type Props = {
  hero: HeroType;
  equipped: EquippedGear;
  deckEditRequired?: boolean;
  onDeckChange: (deck: CardId[]) => void;
  onClearDeckEditRequired: () => void;
};

export default function CharacterSheetDeck({
  hero,
  equipped,
  deckEditRequired = false,
  onDeckChange,
  onClearDeckEditRequired,
}: Props) {
  const [binderTab, setBinderTab] = useState<CardClass>("neutral");
  const [detailCardId, setDetailCardId] = useState<CardId | null>(null);
  const minimum = minDeckSize(hero.level);
  const validation = validateDeck(hero);
  const allowedClasses = getAllowedCardClasses(equipped);

  const visibleTabs = useMemo(
    () =>
      CARD_CLASS_TAB_ORDER.filter(
        (cardClass) => cardsOwnedInClass(hero.cardCollection, cardClass).length > 0,
      ),
    [hero.cardCollection],
  );

  const binderCards = useMemo(
    () => cardsOwnedInClass(hero.cardCollection, binderTab),
    [hero.cardCollection, binderTab],
  );

  /** One stack per unique card in deck (preserves first-seen order). */
  const deckStacks = useMemo(() => {
    const order: CardId[] = [];
    const counts = new Map<CardId, number>();
    for (const cardId of hero.deck) {
      if (!counts.has(cardId)) order.push(cardId);
      counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
    }
    return order.map((cardId) => ({
      cardId,
      count: counts.get(cardId)!,
    }));
  }, [hero.deck]);

  const removeFromDeck = (index: number) => {
    if (hero.deck.length <= minimum) return;
    const next = hero.deck.filter((_, i) => i !== index);
    onDeckChange(next);
    if (isDeckValid({ ...hero, deck: next })) {
      onClearDeckEditRequired();
    }
  };

  const removeOneCopyFromDeck = (cardId: CardId) => {
    if (hero.deck.length <= minimum) return;
    const index = hero.deck.indexOf(cardId);
    if (index === -1) return;
    removeFromDeck(index);
  };

  const addToDeck = (cardId: CardId) => {
    if (countCardCopies(hero.cardCollection, cardId) === 0) return;
    if (!isCardClassAllowed(CARD_CATALOG[cardId].cardClass, equipped)) return;
    const inDeck = countDeckCopies(hero.deck, cardId);
    const cap = RARITY_COPY_LIMITS[CARD_CATALOG[cardId].rarity];
    if (inDeck >= cap) return;
    if (spareCollectionCopies(hero.cardCollection, hero.deck, cardId) <= 0) return;
    const next = [...hero.deck, cardId];
    onDeckChange(next);
    if (isDeckValid({ ...hero, deck: next })) {
      onClearDeckEditRequired();
    }
  };

  const isDeckCardIllegal = (cardId: CardId): boolean => {
    const def = CARD_CATALOG[cardId];
    if (!allowedClasses.has(def.cardClass)) return true;
    if (countDeckCopies(hero.deck, cardId) > RARITY_COPY_LIMITS[def.rarity]) {
      return true;
    }
    return false;
  };

  const detailCopies = detailCardId ? countDeckCopies(hero.deck, detailCardId) : 0;
  const detailOwned = detailCardId
    ? countCardCopies(hero.cardCollection, detailCardId)
    : 0;
  const detailCap = detailCardId
    ? RARITY_COPY_LIMITS[CARD_CATALOG[detailCardId].rarity]
    : 0;
  const detailClassOk = detailCardId
    ? isCardClassAllowed(CARD_CATALOG[detailCardId].cardClass, equipped)
    : false;
  const detailCanAdd = detailCardId
    ? detailClassOk &&
      detailCopies < detailCap &&
      spareCollectionCopies(hero.cardCollection, hero.deck, detailCardId) > 0
    : false;
  const detailCanRemove =
    detailCardId !== null && hero.deck.length > minimum && detailCopies > 0;
  const detailIllegal = detailCardId ? isDeckCardIllegal(detailCardId) : false;

  return (
    <VStack align="stretch" gap={3}>
      {deckEditRequired ? (
        <Box
          px={2}
          py={1.5}
          borderRadius="md"
          bg="orange.50"
          borderWidth="1px"
          borderColor="orange.200"
        >
          <Text fontSize="sm" color="gray.900">
            Yer loadout changed — fix illegal cards before exploring.
          </Text>
        </Box>
      ) : null}

      <Text fontSize="sm" color="gray.900">
        {hero.deck.length} cards (min {minimum}) ·{" "}
        {validation.valid ? "Ready to sail" : "Fix deck to explore"}
      </Text>

      {!validation.valid ? (
        <VStack align="stretch" gap={0.5}>
          {validation.errors.map((error) => (
            <Text key={error} fontSize="xs" color="red.700">
              {error}
            </Text>
          ))}
        </VStack>
      ) : null}

      <Text fontSize="sm" fontWeight="bold">
        Active deck
      </Text>
      {hero.deck.length === 0 ? (
        <Text fontSize="sm" color="gray.900">
          Yer deck is empty.
        </Text>
      ) : (
        <SimpleGrid columns={3} gap={1.5} w="100%">
          {deckStacks.map(({ cardId, count: inDeck }) => {
            const card = createCombatCard(cardId);
            const illegal = isDeckCardIllegal(cardId);
            const owned = countCardCopies(hero.cardCollection, cardId);
            return (
              <Box
                key={cardId}
                position="relative"
                w="100%"
                aspectRatio="2.5/3.5"
                opacity={illegal ? 0.55 : 1}
                outline={illegal ? "2px solid" : undefined}
                outlineColor={illegal ? "red.400" : undefined}
                borderRadius="md"
              >
                <CombatHandCard
                  card={card}
                  cost={getCardEnergyCost(card)}
                  equipped={equipped}
                  viewOnly
                  fillSlot
                  onClick={() => setDetailCardId(cardId)}
                />
                <Box
                  position="absolute"
                  top={1}
                  left="50%"
                  transform="translateX(-50%)"
                  zIndex={2}
                >
                  <CardCopyPips mode="deck" inDeck={inDeck} owned={owned} />
                </Box>
              </Box>
            );
          })}
        </SimpleGrid>
      )}

      <Text fontSize="sm" fontWeight="bold" pt={1}>
        Binder
      </Text>
      <Tabs.Root
        value={binderTab}
        onValueChange={(details) => setBinderTab(details.value as CardClass)}
      >
        <Tabs.List flexWrap="wrap">
          {visibleTabs.map((cardClass) => (
            <Tabs.Trigger key={cardClass} value={cardClass} fontSize="xs">
              {CARD_CLASS_LABELS[cardClass]}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value={binderTab} pt={2}>
          {binderCards.length === 0 ? (
            <Text fontSize="sm" color="gray.900">
              No cards unlocked in this class yet.
            </Text>
          ) : (
            <SimpleGrid columns={3} gap={1.5} w="100%">
              {binderCards.map((cardId) => {
                const card = createCombatCard(cardId);
                const inDeck = countDeckCopies(hero.deck, cardId);
                const owned = countCardCopies(hero.cardCollection, cardId);
                const classOk = isCardClassAllowed(
                  CARD_CATALOG[cardId].cardClass,
                  equipped,
                );
                const canAdd =
                  classOk &&
                  spareCollectionCopies(hero.cardCollection, hero.deck, cardId) > 0 &&
                  inDeck < RARITY_COPY_LIMITS[CARD_CATALOG[cardId].rarity];
                return (
                  <Box
                    key={cardId}
                    position="relative"
                    w="100%"
                    aspectRatio="2.5/3.5"
                    opacity={canAdd ? 1 : 0.45}
                    borderRadius="md"
                  >
                    <CombatHandCard
                      card={card}
                      cost={getCardEnergyCost(card)}
                      equipped={equipped}
                      viewOnly
                      fillSlot
                      onClick={() => setDetailCardId(cardId)}
                    />
                    <Box
                      position="absolute"
                      top={1}
                      left="50%"
                      transform="translateX(-50%)"
                      zIndex={2}
                    >
                      <CardCopyPips mode="binder" inDeck={inDeck} owned={owned} />
                    </Box>
                  </Box>
                );
              })}
            </SimpleGrid>
          )}
        </Tabs.Content>
      </Tabs.Root>

      <CharacterSheetCardDetail
        cardId={detailCardId}
        equipped={equipped}
        copies={detailCopies}
        owned={detailOwned}
        cap={detailCap}
        canAdd={detailCanAdd}
        canRemove={detailCanRemove}
        illegal={detailIllegal}
        onClose={() => setDetailCardId(null)}
        onAdd={() => {
          if (detailCardId) addToDeck(detailCardId);
        }}
        onRemove={() => {
          if (detailCardId) removeOneCopyFromDeck(detailCardId);
        }}
      />
    </VStack>
  );
}
