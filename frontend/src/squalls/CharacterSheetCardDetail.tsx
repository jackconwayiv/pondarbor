import { Box, Button, HStack, Text, VStack } from "@chakra-ui/react";

import { AppModal } from "../components/AppModal";
import CombatHandCard from "./CombatHandCard";
import { EquipmentCardFace } from "./EquipmentCard";
import { getCardRarityLabel, getCardTags } from "./combatCardStyle";
import { getCardEffectDetail } from "./combatEquipment";
import { getCombatTagLegend } from "./combatTagEmojis";
import { getCardEffectText, getCardEnergyCost, AMMO_COST_TEXT } from "./combatRules";
import {
  CARD_CATALOG,
  CARD_CLASS_LABELS,
  createCombatCard,
  type CardId,
} from "./squallsCardCatalog";
import { getCardName, cardRequiresAmmo, type EquippedGear } from "./shantiesTypes";

type Props = {
  cardId: CardId | null;
  equipped: EquippedGear;
  copies: number;
  owned: number;
  cap: number;
  canAdd: boolean;
  canRemove: boolean;
  illegal: boolean;
  onClose: () => void;
  onAdd: () => void;
  onRemove: () => void;
};

export default function CharacterSheetCardDetail({
  cardId,
  equipped,
  copies,
  owned,
  cap,
  canAdd,
  canRemove,
  illegal,
  onClose,
  onAdd,
  onRemove,
}: Props) {
  if (!cardId) return null;

  const def = CARD_CATALOG[cardId];
  const card = createCombatCard(cardId);
  const name = getCardName(card);
  const effectDetail = getCardEffectDetail(card, equipped);
  const rawEffectText = effectDetail?.effectText ?? getCardEffectText(card, equipped);
  const effectText = rawEffectText;
  const costsAmmo = cardRequiresAmmo(card);
  const rarity = getCardRarityLabel(card);
  const tagLegend = getCombatTagLegend(getCardTags(card, equipped));

  return (
    <AppModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={name}
      size="sm"
    >
      <VStack align="stretch" gap={4}>
        <Box mx="auto" w="7.5rem" aspectRatio="2.5/3.5" position="relative" pointerEvents="none">
          <CombatHandCard
            card={card}
            cost={getCardEnergyCost(card)}
            equipped={equipped}
            viewOnly
            fillSlot
            onClick={() => {}}
          />
        </Box>

        <VStack align="stretch" gap={1}>
          {effectText ? (
            <Box>
              <Text fontSize="sm" color="gray.700">
                {effectText}
              </Text>
              {costsAmmo ? (
                <Text fontSize="sm" color="gray.700">
                  {AMMO_COST_TEXT}
                </Text>
              ) : null}
            </Box>
          ) : null}
          <Text fontSize="sm" color="gray.900">
            {CARD_CLASS_LABELS[def.cardClass]} · {rarity}
          </Text>
          <Text fontSize="sm" color="gray.900">
            In deck: {copies}/{owned} owned · max {cap} in deck
          </Text>
          {tagLegend.length > 0 ? (
            <Box pt={1}>
              <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={1}>
                Tags
              </Text>
              <HStack flexWrap="wrap" gap={2}>
                {tagLegend.map(({ tag, emoji, label }) => (
                  <HStack key={tag} gap={1} align="center">
                    <Text fontSize="sm" lineHeight="1" aria-hidden>
                      {emoji}
                    </Text>
                    <Text fontSize="xs" color="gray.700">
                      {label}
                    </Text>
                  </HStack>
                ))}
              </HStack>
            </Box>
          ) : null}
          {effectDetail ? (
            <Box pt={1}>
              <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={1}>
                {effectDetail.basisLabel}
              </Text>
              <Box maxW="5.5rem">
                {effectDetail.equipmentId ? (
                  <EquipmentCardFace equipmentId={effectDetail.equipmentId} />
                ) : (
                  <Text fontSize="sm" color="gray.700">
                    None equipped
                  </Text>
                )}
              </Box>
            </Box>
          ) : null}
          {illegal ? (
            <Text fontSize="xs" color="red.700">
              Not allowed by yer current loadout or over copy limit.
            </Text>
          ) : null}
        </VStack>

        <HStack gap={2} justify="center">
          <Button
            size="sm"
            variant="outline"
            disabled={!canRemove}
            onClick={onRemove}
          >
            Remove from deck
          </Button>
          <Button
            size="sm"
            colorPalette="orange"
            disabled={!canAdd}
            onClick={onAdd}
          >
            Add to deck
          </Button>
        </HStack>
      </VStack>
    </AppModal>
  );
}
