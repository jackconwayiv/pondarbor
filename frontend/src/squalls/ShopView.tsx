import { Box, Heading, HStack, SimpleGrid, Text, VStack } from "@chakra-ui/react";

import EquipmentSellCard from "./EquipmentSellCard";
import ItemInventoryCard from "./ItemInventoryCard";
import SquallsActionCard from "./SquallsActionCard";
import { getEquipmentSellPrice } from "./shantiesEquipment";
import {
  checkBuyItem,
  checkSellItem,
  getItemCount,
  getItemSellPrice,
  ITEM_DEFINITIONS,
  ITEM_IDS,
  SHOP_ITEM_IDS,
} from "./shantiesItems";
import type { HeroType, ItemId } from "./shantiesTypes";

type Props = {
  hero: HeroType;
  shopMessage: string | null;
  onBuyItem: (itemId: ItemId) => void;
  onSellItem: (itemId: ItemId) => void;
  onSellEquipment: (bagIndex: number) => void;
  onBack: () => void;
};

export default function ShopView({
  hero,
  shopMessage,
  onBuyItem,
  onSellItem,
  onSellEquipment,
  onBack,
}: Props) {
  const ownedConsumables = ITEM_IDS.filter(
    (itemId) => getItemCount(hero.inventory, itemId) > 0 && getItemSellPrice(itemId) !== null,
  );
  const hasSellables =
    ownedConsumables.length > 0 || hero.equipmentInventory.length > 0;

  return (
    <VStack align="stretch" gap={4} w="100%">
      <HStack w="100%" justify="space-between" align="flex-start" gap={2}>
        <Heading flex={1} minW={0}>
          💰 Ye Be Shopping
        </Heading>
        <Box flexShrink={0} w="7rem">
          <SquallsActionCard
            emoji="⛵"
            label="Back to Ship"
            accent="blue"
            compact
            onClick={onBack}
          />
        </Box>
      </HStack>

      <Text fontSize="sm" fontWeight="bold">
        Buy
      </Text>
      <SimpleGrid columns={3} gap={1.5} w="100%" maxW="28rem">
        {SHOP_ITEM_IDS.map((itemId) => {
          const def = ITEM_DEFINITIONS[itemId];
          const owned = getItemCount(hero.inventory, itemId);
          const canBuy = checkBuyItem(hero, itemId).ok;
          return (
            <ItemInventoryCard
              key={itemId}
              itemId={itemId}
              count={owned}
              countFormat="owned"
              showUse
              useLabel={`Buy (${def.shopPrice}g)`}
              useDisabled={!canBuy}
              onUse={() => onBuyItem(itemId)}
            />
          );
        })}
      </SimpleGrid>

      {hasSellables ? (
        <>
          <Text fontSize="sm" fontWeight="bold">
            Sell
          </Text>
          <SimpleGrid columns={3} gap={1.5} w="100%" maxW="28rem">
            {ownedConsumables.map((itemId) => {
              const sellPrice = getItemSellPrice(itemId)!;
              return (
                <ItemInventoryCard
                  key={`sell-${itemId}`}
                  itemId={itemId}
                  count={getItemCount(hero.inventory, itemId)}
                  countFormat="owned"
                  showUse
                  useLabel={`Sell (${sellPrice}g)`}
                  useDisabled={!checkSellItem(hero, itemId).ok}
                  onUse={() => onSellItem(itemId)}
                />
              );
            })}
            {hero.equipmentInventory.map((equipmentId, index) => {
              const sellPrice = getEquipmentSellPrice(equipmentId);
              if (sellPrice === null) return null;
              return (
                <EquipmentSellCard
                  key={`sell-equip-${equipmentId}-${index}`}
                  equipmentId={equipmentId}
                  sellLabel={`Sell (${sellPrice}g)`}
                  onSell={() => onSellEquipment(index)}
                />
              );
            })}
          </SimpleGrid>
        </>
      ) : null}

      {shopMessage ? (
        <Text fontSize="sm" color="fg.muted">
          {shopMessage}
        </Text>
      ) : null}
    </VStack>
  );
}
