import { HStack, SimpleGrid, Text, VStack } from "@chakra-ui/react";

import { SquallsHeading } from "./SquallsHeading";

import EquipmentSellCard from "./EquipmentSellCard";
import ItemInventoryCard from "./ItemInventoryCard";
import { SquallsPanelBackButton, SquallsTextZone } from "./SquallsActionSheet";
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
import { SQUALLS_TEXT_ZONE, SQUALLS_WORLD_PANEL } from "./squallsTheme";

function shopBackLabel(shopVariant: ShopVariant | null): string {
  if (shopVariant === "merchant") return "Return to open sea";
  if (shopVariant === "island_trader") return "Return to island";
  if (shopVariant === "port") return "Return to port";
  return "Return to ship";
}

function shopHeading(shopVariant: ShopVariant | null): string {
  if (shopVariant === "merchant") return "Merchant Ship";
  if (shopVariant === "island_trader") return "Island Trader";
  if (shopVariant === "port") return "Marketplace";
  if (shopVariant === "ship") return "Provisions";
  return "Ye Be Shopping";
}

function shopSubtitle(shopVariant: ShopVariant | null): string {
  if (shopVariant === "merchant") return "Have a browse of our fine wares.";
  if (shopVariant === "island_trader") return "A local offers goods from the island.";
  if (shopVariant === "port") return "Stock up before ye sail on.";
  if (shopVariant === "ship") return "Stock up for the voyage.";
  return "What'll ye have today?";
}

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
    <VStack align="stretch" gap={4} w="100%" {...SQUALLS_WORLD_PANEL} p={{ base: 3, md: 4 }}>
      <HStack w="100%" justify="space-between" align="flex-start" gap={3}>
        <VStack align="start" flex={1} minW={0} gap={1}>
          <SquallsHeading w="100%">{shopHeading(shopVariant)}</SquallsHeading>
          <Text fontSize="sm" color={SQUALLS_TEXT_ZONE.muted}>
            {shopSubtitle(shopVariant)}
          </Text>
        </VStack>
        <SquallsPanelBackButton label={shopBackLabel(shopVariant)} onClick={onBack} />
      </HStack>

      <Text fontSize="sm" fontWeight="bold">
        Buy
      </Text>
      <SimpleGrid columns={{ base: 3, md: 3 }} gap={1.5} w="100%" maxW="28rem">
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
          <SimpleGrid columns={{ base: 3, md: 3 }} gap={1.5} w="100%" maxW="28rem">
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
        <SquallsTextZone>
          <Text fontSize="sm" color="#5A4732">
            {shopMessage}
          </Text>
        </SquallsTextZone>
      ) : null}
    </VStack>
  );
}
