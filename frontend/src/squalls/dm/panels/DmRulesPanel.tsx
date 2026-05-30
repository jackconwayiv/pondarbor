import { Box, SimpleGrid, Text, VStack } from "@chakra-ui/react";

import { EVASIVE_MISS_CHANCE, SHOCKING_RETALIATION_DAMAGE } from "../../combatEquipment";
import {
  AMMO_POUCH_DROP_CHANCE,
  HERO_STARTING_AMMO,
  TREASURE_LOCKPICK_DROP_CHANCE,
} from "../../combatLoot";
import { BUFF_ON_TOP_START_CHANCE } from "../../enemyActions";
import {
  CARDS_DRAWN_PER_TURN,
  MAX_ENERGY_PER_TURN,
} from "../../combatRules";
import {
  ISLAND_TREASURE_LOCKED_CHANCE,
  SEA_TREASURE_LOCKED_CHANCE,
} from "../../dungeonTreasure";
import { shopBuyPrice, sellPriceFromBasePrice } from "../../shantiesShop";
import { SQUALLS_HUD_COLORS } from "../../squallsTheme";
import { ENEMY_ACTION_DESCRIPTIONS } from "../squallsDmCatalog";
import { xpRequiredForLevel } from "../../squallsXpProgression";
import { minDeckSize } from "../../combatDeck";
import {
  DM_PANEL_CARD_PROPS,
  DmPanelIntro,
  DmSectionHeading,
  DmStatRow,
} from "./DmStatRow";

export default function DmRulesPanel() {
  return (
    <VStack align="stretch" gap={5}>
      <DmPanelIntro>Combat constants, status effects, treasure odds, and shop pricing.</DmPanelIntro>

      <Box>
        <DmSectionHeading>Player combat</DmSectionHeading>
        <SimpleGrid columns={{ base: 2, md: 4 }} gap={3} mt={2}>
          <DmStatRow label="Energy per turn" value={String(MAX_ENERGY_PER_TURN)} />
          <DmStatRow label="Cards drawn" value={String(CARDS_DRAWN_PER_TURN)} />
          <DmStatRow label="Strong attack cost" value="2 energy" />
          <DmStatRow label="Normal card cost" value="1 energy" />
          <DmStatRow
            label="Starting ammo"
            value={`${HERO_STARTING_AMMO} / ${HERO_STARTING_AMMO}`}
          />
          <DmStatRow label="Ranged attack cost" value="1 ammo" />
        </SimpleGrid>
        <Text fontSize="sm" color={SQUALLS_HUD_COLORS.panelMuted} mt={2}>
          After a victorious fight where the hero spent at least 1 ammo, there is
          a {Math.round(AMMO_POUCH_DROP_CHANCE * 100)}% chance an ammo pouch
          appears in combat loot (monster item drops still stack normally). After a
          victorious fight, current ammo refills to max ({HERO_STARTING_AMMO} by default).
        </Text>
      </Box>

      <Box>
        <DmSectionHeading>Status effects</DmSectionHeading>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={2} mt={2}>
          <Box {...DM_PANEL_CARD_PROPS} p={2}>
            <Text fontSize="sm" fontWeight="semibold" color={SQUALLS_HUD_COLORS.panelText}>
              Weakened
            </Text>
            <Text fontSize="xs" color={SQUALLS_HUD_COLORS.panelMuted}>
              −1 damage on hero attacks (minimum 1). Lasts until combat ends. Applied by
              enemy Weaken action.
            </Text>
          </Box>
          <Box {...DM_PANEL_CARD_PROPS} p={2}>
            <Text fontSize="sm" fontWeight="semibold" color={SQUALLS_HUD_COLORS.panelText}>
              Evasive
            </Text>
            <Text fontSize="xs" color={SQUALLS_HUD_COLORS.panelMuted}>
              {Math.round(EVASIVE_MISS_CHANCE * 100)}% melee miss chance per stack (×2 ={" "}
              {Math.round(EVASIVE_MISS_CHANCE * 2 * 100)}%). Ranged always hits. Granted
              at spawn (Bat, Harpy, Siren) or by enemy Evade action.
            </Text>
          </Box>
          <Box {...DM_PANEL_CARD_PROPS} p={2}>
            <Text fontSize="sm" fontWeight="semibold" color={SQUALLS_HUD_COLORS.panelText}>
              Shocking
            </Text>
            <Text fontSize="xs" color={SQUALLS_HUD_COLORS.panelMuted}>
              Each Shocking enemy reflects {SHOCKING_RETALIATION_DAMAGE} damage to the hero
              on a successful melee hit (can be lethal). Ranged attacks do not trigger it.
              Granted by Electric Eel Electrify action.
            </Text>
          </Box>
        </SimpleGrid>
      </Box>

      <Box>
        <DmSectionHeading>Enemy actions</DmSectionHeading>
        <Text fontSize="sm" color={SQUALLS_HUD_COLORS.panelMuted} mt={1}>
          Enemies with a buff card (Evade or Electrify) have a{" "}
          {Math.round(BUFF_ON_TOP_START_CHANCE * 100)}% chance to start combat with that
          buff on top of their deck.
        </Text>
        <VStack align="stretch" gap={1} mt={2}>
          {ENEMY_ACTION_DESCRIPTIONS.map((row) => (
            <Text key={row.action} fontSize="sm" color={SQUALLS_HUD_COLORS.panelMuted}>
              <Text as="span" fontWeight="semibold">
                {row.action}
              </Text>{" "}
              ({row.broadcast}): {row.effect}
            </Text>
          ))}
        </VStack>
      </Box>

      <Box>
        <DmSectionHeading>Treasure</DmSectionHeading>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={2} mt={2}>
          <DmStatRow
            label="Sea locked chest"
            value={`${Math.round(SEA_TREASURE_LOCKED_CHANCE * 100)}%`}
          />
          <DmStatRow
            label="Island locked chest"
            value={`${Math.round(ISLAND_TREASURE_LOCKED_CHANCE * 100)}%`}
          />
          <DmStatRow label="Dungeon chests" value="Always locked" />
          <DmStatRow
            label="Bonus lockpick drop"
            value={`${Math.round(TREASURE_LOCKPICK_DROP_CHANCE * 100)}%`}
          />
        </SimpleGrid>
      </Box>

      <Box>
        <DmSectionHeading>Level progression</DmSectionHeading>
        <SimpleGrid columns={{ base: 2, md: 4 }} gap={2} mt={2}>
          <DmStatRow label="L1+" value={`${xpRequiredForLevel(1)} XP`} />
          <DmStatRow label="L2+" value={`${xpRequiredForLevel(2)} XP`} />
          <DmStatRow label="L3+" value={`${xpRequiredForLevel(3)} XP`} />
          <DmStatRow label="L4+" value={`${xpRequiredForLevel(4)} XP`} />
          <DmStatRow label="L5+" value={`${xpRequiredForLevel(5)} XP`} />
          <DmStatRow label="L6+" value={`${xpRequiredForLevel(6)} XP`} />
          <DmStatRow label="L7+" value={`${xpRequiredForLevel(7)} XP`} />
          <DmStatRow label="Boss XP" value="3 × level" />
        </SimpleGrid>
        <Text fontSize="sm" color={SQUALLS_HUD_COLORS.panelMuted} mt={2}>
          Encounter levels roll 75% on-level, 15% one lower, 10% one higher.
        </Text>
        <Text fontSize="sm" color={SQUALLS_HUD_COLORS.panelMuted} mt={1}>
          Minimum deck size is 19 + level (L1 minimum: {minDeckSize(1)}). Each level
          gained forces a 1-of-3 card pick to add to the deck.
        </Text>
      </Box>

      <Box>
        <DmSectionHeading>Shop pricing</DmSectionHeading>
        <Text fontSize="sm" color={SQUALLS_HUD_COLORS.panelMuted} mt={1}>
          Buy: base + 5×hero level + 5×copies owned (example level 1, 0 owned: base{" "}
          {shopBuyPrice(15, 1, 0)}g for a 15g item)
        </Text>
        <Text fontSize="sm" color={SQUALLS_HUD_COLORS.panelMuted} mt={1}>
          Sell: floor(base × 0.5) (example 15g base → {sellPriceFromBasePrice(15)}g)
        </Text>
      </Box>
    </VStack>
  );
}
