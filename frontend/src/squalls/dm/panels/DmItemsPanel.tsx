import { Badge, Box, HStack, SimpleGrid, Text, VStack } from "@chakra-ui/react";

import ItemInventoryCard from "../../ItemInventoryCard";
import {
  ISLAND_TRADER_SHOP_ITEM_IDS,
  ITEM_DEFINITIONS,
  MERCHANT_SHOP_ITEM_IDS,
  PORT_SHOP_ITEM_IDS,
  SHOP_ITEM_IDS,
} from "../../shantiesItems";
import type { ItemId, ShopVariant } from "../../shantiesTypes";
import { SQUALLS_HUD_COLORS } from "../../squallsTheme";
import { SHOP_CATALOG_LABELS } from "../squallsDmCatalog";
import { DM_PANEL_CARD_PROPS, DmPanelIntro, DmSectionHeading } from "./DmStatRow";

const ITEM_KIND_ORDER = [
  "food",
  "ship",
  "ammo",
  "munitions",
  "dive",
  "candle",
  "key",
] as const;

function shopCatalogsForItem(itemId: ItemId): ShopVariant[] {
  const catalogs: ShopVariant[] = [];
  if ((SHOP_ITEM_IDS as readonly ItemId[]).includes(itemId)) catalogs.push("ship");
  if ((MERCHANT_SHOP_ITEM_IDS as readonly ItemId[]).includes(itemId)) {
    catalogs.push("merchant");
  }
  if ((ISLAND_TRADER_SHOP_ITEM_IDS as readonly ItemId[]).includes(itemId)) {
    catalogs.push("island_trader");
  }
  if ((PORT_SHOP_ITEM_IDS as readonly ItemId[]).includes(itemId)) {
    catalogs.push("port");
  }
  return catalogs;
}

function formatItemMeta(itemId: ItemId): string {
  const def = ITEM_DEFINITIONS[itemId];
  const parts: string[] = [def.kind];
  if (def.healMin !== undefined && def.healMax !== undefined) {
    parts.push(`${def.healMin}–${def.healMax} HP`);
  } else if (def.healAmount !== undefined) {
    parts.push(`${def.healAmount} HP`);
  }
  if (def.energyCost !== undefined) parts.push(`${def.energyCost} energy in combat`);
  if (def.shopPrice !== undefined) parts.push(`shop ${def.shopPrice}g`);
  if (def.basePrice !== undefined) parts.push(`base ${def.basePrice}g`);
  return parts.join(" · ");
}

export default function DmItemsPanel() {
  const itemsByKind = ITEM_KIND_ORDER.map((kind) => ({
    kind,
    items: (Object.keys(ITEM_DEFINITIONS) as ItemId[]).filter(
      (id) => ITEM_DEFINITIONS[id].kind === kind,
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <VStack align="stretch" gap={5}>
      <DmPanelIntro>
        Consumables and loot items from ITEM_DEFINITIONS. Badges show which shop catalogs
        stock each item.
      </DmPanelIntro>

      {itemsByKind.map(({ kind, items }) => (
        <Box key={kind}>
          <DmSectionHeading>{kind}</DmSectionHeading>
          <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} gap={2} mt={2}>
            {items.map((itemId) => {
              const catalogs = shopCatalogsForItem(itemId);
              return (
                <Box key={itemId} {...DM_PANEL_CARD_PROPS} p={2}>
                  <ItemInventoryCard itemId={itemId} count={1} countFormat="owned" />
                  <Text fontSize="2xs" color={SQUALLS_HUD_COLORS.panelMuted} mt={1} px={1}>
                    {formatItemMeta(itemId)}
                  </Text>
                  {catalogs.length > 0 ? (
                    <HStack gap={1} flexWrap="wrap" mt={1} px={1}>
                      {catalogs.map((catalog) => (
                        <Badge
                          key={catalog}
                          size="sm"
                          variant="solid"
                          bg="rgba(46, 141, 118, 0.84)"
                          color="gray.50"
                          fontSize="2xs"
                        >
                          {SHOP_CATALOG_LABELS[catalog]}
                        </Badge>
                      ))}
                    </HStack>
                  ) : null}
                </Box>
              );
            })}
          </SimpleGrid>
        </Box>
      ))}
    </VStack>
  );
}
