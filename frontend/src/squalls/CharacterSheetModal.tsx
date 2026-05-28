import { Box, SimpleGrid, Tabs, Text, VStack } from "@chakra-ui/react";
import { useState } from "react";

import { AppModal } from "../components/AppModal";
import {
  APP_SHELL_TAB_LIST_INSET_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import { clampHp } from "./combatRules";
import CharacterSheetEquipment from "./CharacterSheetEquipment";
import ItemInventoryCard from "./ItemInventoryCard";
import {
  checkUseItem,
  getItemCount,
  getItemEnergyCost,
  isItemUsableInCombat,
  ITEM_IDS,
} from "./shantiesItems";
import type {
  CombatPhase,
  GameStateTypes,
  HeroType,
  IndoorAreaId,
  ItemId,
} from "./shantiesTypes";

type CharacterSheetTab = "stats" | "inventory";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hero: HeroType;
  gameState: GameStateTypes;
  combatPhase: CombatPhase;
  energy: number;
  victoryPending: boolean;
  combatVictory: boolean;
  armor: number;
  currentIndoorArea: IndoorAreaId | null;
  illuminatedAreas: IndoorAreaId[];
  itemMessage: string | null;
  onUseItem: (itemId: ItemId) => void;
  onClearItemMessage: () => void;
  onEquipmentChange: (hero: HeroType) => void;
};

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="semibold">
        {value}
      </Text>
    </Box>
  );
}

export default function CharacterSheetModal({
  open,
  onOpenChange,
  hero,
  gameState,
  combatPhase,
  energy,
  victoryPending,
  combatVictory,
  armor,
  currentIndoorArea,
  illuminatedAreas,
  itemMessage,
  onUseItem,
  onClearItemMessage,
  onEquipmentChange,
}: Props) {
  const [tab, setTab] = useState<CharacterSheetTab>("stats");
  const inCombat = gameState === "battle";
  const ownedItems = ITEM_IDS.filter(
    (itemId) => getItemCount(hero.inventory, itemId) > 0,
  );
  const showItemUse =
    gameState !== "lobby" &&
    (gameState !== "battle" ||
      (combatPhase === "player" && !victoryPending && !combatVictory));

  const useItemContext = {
    gameState,
    hero,
    currentIndoorArea,
    illuminatedAreas,
    combatPhase,
    energy,
    victoryPending,
    combatVictory,
  };

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={`${hero.name} · ${hero.class}`}
      size="lg"
    >
      <Tabs.Root
        value={tab}
        variant="plain"
        w="100%"
        onValueChange={(details) => setTab(details.value as CharacterSheetTab)}
      >
        <Tabs.List {...APP_SHELL_TAB_LIST_INSET_PROPS}>
          <Tabs.Trigger value="stats" {...APP_SHELL_TAB_TRIGGER_PROPS}>
            Stats
          </Tabs.Trigger>
          <Tabs.Trigger value="inventory" {...APP_SHELL_TAB_TRIGGER_PROPS}>
            Inventory
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="stats" pt={3}>
          <SimpleGrid columns={2} gap={3}>
            <StatRow label="Captain" value={hero.name} />
            <StatRow label="Class" value={hero.class} />
            <StatRow
              label="HP"
              value={`${clampHp(hero.current_hp)} / ${clampHp(hero.max_hp)}`}
            />
            <StatRow label="Gold" value={String(hero.gold)} />
            <StatRow label="Level" value={String(hero.level)} />
            <StatRow label="XP" value={String(hero.xp)} />
            <StatRow label="Deck" value={`${hero.deck.length} cards`} />
            {inCombat && armor > 0 ? (
              <StatRow label="Armor" value={String(armor)} />
            ) : null}
            {inCombat ? (
              <StatRow label="Energy" value={String(energy)} />
            ) : null}
          </SimpleGrid>
        </Tabs.Content>

        <Tabs.Content value="inventory" pt={3}>
          <VStack align="stretch" gap={4}>
            <CharacterSheetEquipment
              hero={hero}
              onEquipmentChange={onEquipmentChange}
            />

            <Box>
              <Text fontSize="sm" fontWeight="bold" mb={2}>
                Consumables
              </Text>
              {ownedItems.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">
                  Yer pack is empty.
                </Text>
              ) : (
                <SimpleGrid columns={3} gap={1.5}>
                  {ownedItems.map((itemId) => {
                    const energyCost =
                      inCombat && isItemUsableInCombat(itemId)
                        ? getItemEnergyCost(itemId)
                        : null;
                    return (
                      <ItemInventoryCard
                        key={itemId}
                        itemId={itemId}
                        count={getItemCount(hero.inventory, itemId)}
                        showUse={showItemUse}
                        useEnergyCost={energyCost}
                        useDisabled={!checkUseItem(itemId, useItemContext).ok}
                        onUse={() => {
                          onClearItemMessage();
                          onUseItem(itemId);
                        }}
                      />
                    );
                  })}
                </SimpleGrid>
              )}
              {itemMessage ? (
                <Text fontSize="xs" color="fg.muted" mt={2}>
                  {itemMessage}
                </Text>
              ) : null}
            </Box>
          </VStack>
        </Tabs.Content>
      </Tabs.Root>
    </AppModal>
  );
}
