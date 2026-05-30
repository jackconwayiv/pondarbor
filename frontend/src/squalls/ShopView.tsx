import { Box, Heading, HStack, SimpleGrid, Text, VStack } from "@chakra-ui/react";

import EquipmentSellCard from "./EquipmentSellCard";
import ItemInventoryCard from "./ItemInventoryCard";
import SquallsActionCard from "./SquallsActionCard";
import { getEquipmentSellPrice } from "./shantiesEquipment";
import {
  checkBuyItem,
  checkSellItem,
  getItemBuyPrice,
  getItemCount,
  getItemSellPrice,
  getShopCatalogItemIds,
  ITEM_IDS,
} from "./shantiesItems";
import { shopAllowsSelling } from "./shantiesShop";
import type { HeroType, ItemId, ShopVariant } from "./shantiesTypes";

type Props = {
  hero: HeroType;
  shopVariant: ShopVariant | null;
  shopMessage: string | null;
  onBuyItem: (itemId: ItemId) => void;
  onSellItem: (itemId: ItemId) => void;
  onSellEquipment: (bagIndex: number) => void;
  onBack: () => void;
};

export default function ShopView({
  hero,
  shopVariant,
  shopMessage,
  onBuyItem,
  onSellItem,
  onSellEquipment,
  onBack,
}: Props) {
  const isMerchant = shopVariant === "merchant";
  const isIslandTrader = shopVariant === "island_trader";
  const isPort = shopVariant === "port";
  const isShip = shopVariant === "ship";
  const catalogItemIds = getShopCatalogItemIds(shopVariant);
  const ownedConsumables = ITEM_IDS.filter(
    (itemId) =>
      getItemCount(hero.inventory, itemId) > 0 &&
      getItemSellPrice(itemId) !== null,
  );
  const hasSellables =
    shopAllowsSelling(shopVariant) &&
    (ownedConsumables.length > 0 || hero.equipmentInventory.length > 0);

  return (
    <VStack align="stretch" gap={4} w="100%">
      <HStack w="100%" justify="space-between" align="flex-start" gap={2}>
        <VStack align="start" flex={1} minW={0} gap={1}>
          <Heading w="100%">
            {isMerchant
              ? "🛶 Merchant Ship"
              : isIslandTrader
                ? "🏝️ Island Trader"
                : isPort
                  ? "💰 Marketplace"
                  : isShip
                    ? "💰 Provisions"
                    : "💰 Ye Be Shopping"}
          </Heading>
          <Text fontSize="sm" color="gray.900">
            {isMerchant
              ? "Have a browse of our fine wares."
              : isIslandTrader
                ? "A local offers goods from the island."
                : isPort
                  ? "Stock up before ye sail on."
                  : isShip
                    ? "Stock up for the voyage."
                    : "What'll ye have today?"}
          </Text>
        </VStack>
        <Box flexShrink={0} w="7rem">
          <SquallsActionCard
            emoji="⛵"
            label={
              isMerchant
                ? "Back to open sea"
                : isIslandTrader
                  ? "Back to Island"
                  : isPort
                    ? "Back to Port"
                    : "Back to Ship"
            }
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
        {catalogItemIds.map((itemId) => {
          const owned = getItemCount(hero.inventory, itemId);
          const buyPrice = getItemBuyPrice(hero, itemId, shopVariant)!;
          const canBuy = checkBuyItem(hero, itemId, shopVariant).ok;
          return (
            <ItemInventoryCard
              key={itemId}
              itemId={itemId}
              count={owned}
              countFormat="owned"
              showUse
              useLabel={`Buy (${buyPrice}g)`}
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
        <Text fontSize="sm" color="gray.900">
          {shopMessage}
        </Text>
      ) : null}
    </VStack>
  );
}
