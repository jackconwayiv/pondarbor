import { useState } from "react";
import {
  Box,
  Button,
  HStack,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";

import {
  CombatBattleDnd,
  CombatDefendDropZone,
  CombatEnemyDropTarget,
  DraggableCombatHandCard,
} from "./CombatBattleDnd";
import CombatEnergyGems from "./CombatEnergyGems";
import { isTreasureEvent } from "./combatLoot";
import { isLockedTreasureChest } from "./dungeonTreasure";
import {
  isFloatingSuppliesEvent,
  isSeaTreasureEvent,
  FLOATING_SUPPLIES_UNLOCKED_INTRO,
  TREASURE_CHEST_EMOJI,
} from "./floatingSuppliesLoot";
import { isIslandTraderEvent, isIslandWeatherEvent } from "./islandEventDeck";
import { SquallsHeading } from "./SquallsHeading";
import {
  isBuriedTreasureEvent,
  isSupplyCacheEvent,
  BURIED_TREASURE_INTRO,
  SUPPLY_CACHE_INTRO,
} from "./islandTreasureLoot";
import { seaWeatherEffectLabel } from "./seaWeather";
import CookstoveView from "./CookstoveView";
import { isCookstoveEvent } from "./cookstove";
import LockedChestPanel from "./LockedChestPanel";
import {
  getDungeonKindEmoji,
  getEnterDungeonLabel,
  isActiveIslandDungeon,
  isDungeonDiscoveryEvent,
} from "./dungeonExplore";
import DungeonView from "./DungeonView";
import CombatEnemyCard from "./CombatEnemyCard";
import CombatHandCard from "./CombatHandCard";
import LootClaimPanel from "./LootClaimPanel";
import { getCardEnergyCost, isEnemyAlive, MAX_BATTLEFIELD_ENEMIES } from "./combatRules";
import { CARD_ASPECT_RATIO, CARD_GRID_3COL_MAX_WIDTH } from "./combatCardStyle";
import AdventureStripe from "./AdventureStripe";
import PlayerPanel from "./PlayerPanel";
import ExploreTestPickerView from "./ExploreTestPickerView";
import LevelUpPickerView from "./LevelUpPickerView";
import PassEnergyConfirmModal from "./PassEnergyConfirmModal";
import PortView from "./PortView";
import ShipwrightView from "./ShipwrightView";
import TavernView from "./TavernView";
import RestView from "./RestView";
import ShipView from "./ShipView";
import ShopView from "./ShopView";
import {
  SquallsActionOption,
  SquallsActionSection,
  SquallsActionSheet,
} from "./SquallsActionSheet";
import { getItemCount } from "./shantiesItems";
import { cardRequiresAmmo, type CombatLogSide, type EventType, type WorldPanelProps } from "./shantiesTypes";
import { SQUALLS_HUD_COLORS, SQUALLS_TEXT_ZONE, SQUALLS_WORLD_PANEL } from "./squallsTheme";

function eventHeadingEmoji(event: EventType | null): string {
  if (!event) return "⛈️";
  if (isDungeonDiscoveryEvent(event) && event.dungeonKind) {
    return getDungeonKindEmoji(event.dungeonKind);
  }
  switch (event.type) {
    case "discovery":
      return "🏝️";
    case "port":
      return "⚓";
    case "merchant":
      return "🛶";
    case "shipwreck":
      return "⛵";
    case "weather":
      return "⛈️";
    default:
      return "⛈️";
  }
}

export default function WorldPanel({
  gameState,
  setGameState,
  location,
  setLocation,
  currentIsland,
  currentPortTown,
  currentDungeon,
  renderIslandName,
  renderPortTownName,
  renderDungeonName,
  enterCurrentDungeon,
  returnToIslandFromDungeon,
  resolveDungeonDiscovery,
  day,
  setDay,
  hero,
  armor,
  heroWeakened,
  enemies,
  activeEvent,
  setActiveEvent,
  hand,
  discardPile,
  combatLog,
  energy,
  maxEnergy,
  combatPhase,
  victoryPending,
  combatVictory,
  combatLoot,
  allCombatLootClaimed,
  eventLoot,
  allEventLootClaimed,
  enemyActionMessage,
  handleSailOrExplore,
  startSailFromShip,
  returnToShipFromIsland,
  anchorAtDiscoveredIsland,
  abandonDiscoveredIsland,
  dockAtPortTown,
  sailPastPortTown,
  claimCombatLoot,
  claimEventLoot,
  completeTreasureEvent,
  acknowledgeGenericEvent,
  acknowledgeWeatherEvent,
  abandonLockedDungeonChest,
  unlockDungeonChestWithKey,
  pickLockOnChest,
  forceOpenDungeonChest,
  dungeonChestUnlocked,
  chestMessage,
  forceOpenAttempted,
  dismissCombatVictory,
  playCombatCard,
  endPlayerTurn,
  resetToLobby,
  goToLobby,
  healHero,
  openRest,
  wakeFromRest,
  leaveRest,
  restComplete,
  restMessage,
  openCookstove,
  leaveCookstove,
  cookAtStove,
  dismissCookstoveEncounter,
  cookMessage,
  shopMessage,
  shopVariant,
  buyShopItem,
  sellShopItem,
  sellShopEquipment,
  leaveShop,
  openShipShop,
  openMerchantShop,
  openIslandTraderShop,
  openPortShop,
  openShipwright,
  openTavern,
  leavePort,
  returnToPort,
  nearPortTown,
  leaveTavern,
  leaveShipwright,
  tavernMessage,
  buyTavernCard,
  refineTavernCard,
  exploreTestContext,
  exploreTestOptions,
  applyExploreTestOutcome,
  cancelExploreTest,
  levelUpCardChoices,
  chooseLevelUpCard,
  resolveShipwreckDive,
  onOpenCharacterSheet,
}: WorldPanelProps) {
  const isPlayerTurn =
    combatPhase === "player" && !victoryPending && !combatVictory;
  const [cardZone, setCardZone] = useState<"hand" | "discard">("hand");
  const [passConfirmOpen, setPassConfirmOpen] = useState(false);
  const viewingHand = cardZone === "hand";
  const displayedCards = viewingHand ? hand : discardPile;

  const HERO_LOG_COLORS = [
    "#D8E7BF",
    "#BFD5A0",
    "#A2C27D",
    "#89AD69",
    "#75955A",
  ] as const;
  const ENEMY_LOG_COLORS = [
    "#F4C2B2",
    "#E99F8A",
    "#DB7F68",
    "#C9644D",
    "#AD4F3E",
  ] as const;

  const getCombatLogEntryStyle = (
    side: CombatLogSide,
    ageFromNewest: number,
  ) => {
    const palette = side === "hero" ? HERO_LOG_COLORS : ENEMY_LOG_COLORS;
    const colorIndex = Math.min(ageFromNewest, palette.length - 1);
    return {
      fontWeight: ageFromNewest === 0 ? ("bold" as const) : ("normal" as const),
      color: palette[colorIndex]!,
    };
  };

  const handlePass = () => {
    if (!isPlayerTurn) return;
    if (energy > 0) {
      setPassConfirmOpen(true);
      return;
    }
    endPlayerTurn();
  };

  const confirmPassWithEnergy = () => {
    endPlayerTurn();
  };

  const panelContent = (() => {
  switch (gameState) {
    case "home":
      return (
        <VStack
          align="stretch"
          gap={{ base: 4, md: 5 }}
          w="100%"
          {...SQUALLS_WORLD_PANEL}
          p={{ base: 3, md: 4 }}
        >
          <SquallsHeading>
            {location === "ship"
              ? "Captain's Orders"
              : location === "port"
                ? `Harbor Briefing${currentPortTown ? ` — ${renderPortTownName(currentPortTown)}` : ""}`
                : location === "dungeon" && currentDungeon
                  ? `Delve Orders — ${renderDungeonName(currentDungeon)}`
                  : `Island Expedition${currentIsland ? ` — ${renderIslandName(currentIsland)}` : ""}`}
          </SquallsHeading>

          {location === "ship" && (
            <ShipView
              onShop={openShipShop}
              onRest={openRest}
              onSail={startSailFromShip}
              islandExplorePoints={
                currentIsland !== null
                  ? Math.max(0, currentIsland.explorePoints)
                  : undefined
              }
              onIsland={
                currentIsland !== null
                  ? () => {
                      setGameState("home");
                      setLocation("island");
                    }
                  : undefined
              }
              onEnterWreck={
                currentDungeon?.kind === "wreck"
                  ? enterCurrentDungeon
                  : undefined
              }
              wreckDelvePoints={
                currentDungeon?.kind === "wreck"
                  ? Math.max(0, currentDungeon.delvePoints)
                  : undefined
              }
              onReturnToPort={
                nearPortTown
                  ? returnToPort
                  : undefined
              }
              onCookstove={openCookstove}
            />
          )}

          {location === "island" && (
            <SquallsActionSheet>
              <SquallsActionSection label="Explore And Advance">
                <SquallsActionOption
                  emoji="🧭"
                  title={`Explore the island (${currentIsland ? Math.max(0, currentIsland.explorePoints) : 0})`}
                  detail="Push inland for discoveries, danger, and treasure."
                  tone="explore"
                  disabled={!currentIsland || currentIsland.explorePoints <= 0}
                  onClick={handleSailOrExplore}
                />
                {currentDungeon && isActiveIslandDungeon(currentDungeon) ? (
                  <SquallsActionOption
                    emoji={getDungeonKindEmoji(currentDungeon.kind)}
                    title={getEnterDungeonLabel(currentDungeon)}
                    detail="Enter the discovered site and test yer luck below."
                    tone="risk"
                    onClick={enterCurrentDungeon}
                  />
                ) : null}
              </SquallsActionSection>
              <SquallsActionSection label="Supplies And Services">
                {currentIsland?.cookstoveFound ? (
                  <SquallsActionOption
                    emoji="🍳"
                    title="Use the cookstove"
                    detail="Prepare raw provisions before the next battle."
                    tone="service"
                    onClick={openCookstove}
                  />
                ) : null}
              </SquallsActionSection>
              <SquallsActionSection label="Retreat And Return">
                <SquallsActionOption
                  emoji="⛵"
                  title="Return to ship"
                  detail="Leave the shore and regroup aboard."
                  tone="retreat"
                  onClick={returnToShipFromIsland}
                />
              </SquallsActionSection>
            </SquallsActionSheet>
          )}

          {location === "port" && (
            <PortView
              onShop={openPortShop}
              onShipwright={openShipwright}
              onTavern={openTavern}
              onReturnToIsland={leavePort}
            />
          )}

          {location === "dungeon" && currentDungeon && (
            <DungeonView
              delvePoints={currentDungeon.delvePoints}
              onDelve={handleSailOrExplore}
              onReturn={returnToIslandFromDungeon}
              returnLabel={
                currentDungeon.kind === "wreck"
                  ? "Return to Ship"
                  : "Return to Island"
              }
              returnEmoji={currentDungeon.kind === "wreck" ? "⛵" : "🏝️"}
            />
          )}

        </VStack>
      );

    case "shop":
      return (
        <ShopView
          hero={hero}
          shopVariant={shopVariant}
          shopMessage={shopMessage}
          onBuyItem={buyShopItem}
          onSellItem={sellShopItem}
          onSellEquipment={sellShopEquipment}
          onBack={leaveShop}
        />
      );

    case "shipwright":
      return <ShipwrightView onBack={leaveShipwright} />;

    case "tavern":
      return (
        <TavernView
          hero={hero}
          tavernMessage={tavernMessage}
          onBuyCard={buyTavernCard}
          onRefineCard={refineTavernCard}
          onBack={leaveTavern}
        />
      );

    case "exploreTest":
      return exploreTestContext ? (
        <ExploreTestPickerView
          context={exploreTestContext}
          options={exploreTestOptions}
          onSelect={applyExploreTestOutcome}
          onCancel={cancelExploreTest}
        />
      ) : null;

    case "levelUp":
      return (
        <LevelUpPickerView
          choices={levelUpCardChoices}
          equipped={hero.equipped}
          onChoose={chooseLevelUpCard}
        />
      );

    case "rest":
      return (
        <RestView
          hero={hero}
          restComplete={restComplete}
          restMessage={restMessage}
          onRest={healHero}
          onWakeUp={wakeFromRest}
          onBack={leaveRest}
        />
      );

    case "cookstove":
      return (
        <CookstoveView
          hero={hero}
          cookMessage={cookMessage}
          onCook={() => cookAtStove(false)}
          onDismiss={leaveCookstove}
        />
      );

    case "event": {
      if (activeEvent && isCookstoveEvent(activeEvent)) {
        return (
          <CookstoveView
            hero={hero}
            cookMessage={cookMessage}
            onCook={() => cookAtStove(true)}
            onDismiss={dismissCookstoveEncounter}
          />
        );
      }

      const eventReturnLabel =
        location === "dungeon"
          ? "Return to Dungeon"
          : location === "island"
            ? "Return to Island"
            : "Return to Ship";

      if (
        activeEvent &&
        isLockedTreasureChest(activeEvent, location, dungeonChestUnlocked)
      ) {
        return (
          <LockedChestPanel
            event={activeEvent}
            hero={hero}
            message={chestMessage}
            headingEmoji={
              isSeaTreasureEvent(activeEvent)
                ? TREASURE_CHEST_EMOJI
                : "🔒"
            }
            leaveEmoji={
              isSeaTreasureEvent(activeEvent) ? "⛵" : undefined
            }
            leaveLabel={
              isSeaTreasureEvent(activeEvent) ? "Sail On" : undefined
            }
            leaveTone={isSeaTreasureEvent(activeEvent) ? "explore" : undefined}
            onUnlockWithKey={unlockDungeonChestWithKey}
            onPickLock={pickLockOnChest}
            onForceOpen={forceOpenDungeonChest}
            forceOpenDisabled={forceOpenAttempted}
            onLeave={abandonLockedDungeonChest}
          />
        );
      }

      if (activeEvent && isTreasureEvent(activeEvent)) {
        return (
          <LootClaimPanel
            title={`${
              isSeaTreasureEvent(activeEvent)
                ? TREASURE_CHEST_EMOJI
                : isBuriedTreasureEvent(activeEvent) ||
                    isSupplyCacheEvent(activeEvent)
                  ? "🪎"
                  : "💎"
            } ${activeEvent.name}`}
            intro={
              isFloatingSuppliesEvent(activeEvent)
                ? FLOATING_SUPPLIES_UNLOCKED_INTRO
                : isBuriedTreasureEvent(activeEvent)
                  ? BURIED_TREASURE_INTRO
                  : isSupplyCacheEvent(activeEvent)
                    ? SUPPLY_CACHE_INTRO
                    : undefined
            }
            loot={eventLoot}
            allClaimed={allEventLootClaimed}
            returnLabel={eventReturnLabel}
            onClaim={claimEventLoot}
            onComplete={completeTreasureEvent}
            inlineReturnInHeader
          />
        );
      }

      return (
        <VStack
          align="stretch"
          gap={{ base: 3.5, md: 4 }}
          w="100%"
          {...SQUALLS_WORLD_PANEL}
          p={{ base: 3, md: 4 }}
        >
          <SquallsHeading>{eventHeadingEmoji(activeEvent)} {activeEvent?.name}</SquallsHeading>

          {activeEvent && isDungeonDiscoveryEvent(activeEvent) ? (
            <Box w="100%">
              <VStack align="stretch" gap={2} mb={4} w="100%">
                <Text fontSize="lg" fontWeight="semibold">
                  While exploring, ye discover <strong>{activeEvent.name}</strong>.
                </Text>
                <Text fontSize="sm" color={SQUALLS_TEXT_ZONE.muted}>
                  The passage is pitch black and unknown. A candle gives ye a fighting
                  chance down there.
                </Text>
              </VStack>
              <SquallsActionSheet title="Choose Yer Approach">
                <SquallsActionSection label="Explore And Advance">
                  {getItemCount(hero.inventory, "candle") > 0 ? (
                    <SquallsActionOption
                      emoji="🕯️"
                      title="Descend with a candle"
                      detail="Spend light now to explore what lies below."
                      tone="explore"
                      onClick={() => resolveDungeonDiscovery(true)}
                    />
                  ) : null}
                </SquallsActionSection>
                <SquallsActionSection label="Retreat And Return">
                  <SquallsActionOption
                    emoji="🌿"
                    title="Leave the opening undisturbed"
                    detail="Mark the location and continue with safer plans."
                    tone="retreat"
                    onClick={() => resolveDungeonDiscovery(false)}
                  />
                </SquallsActionSection>
              </SquallsActionSheet>
            </Box>
          ) : activeEvent?.type === "discovery" ? (
            <Box w="100%">
              <Text fontSize="lg" fontWeight="semibold" mb={4}>
                On the horizon, ye spy{" "}
                <strong>
                  {currentIsland
                    ? renderIslandName(currentIsland)
                    : "an unknown shore"}
                </strong>
                .
              </Text>
              <SquallsActionSheet title="Captain's Call">
                <SquallsActionSection label="Explore And Advance">
                  <SquallsActionOption
                    emoji="⚓"
                    title="Drop anchor at the island"
                    detail="Land a party and seek fortune ashore."
                    tone="explore"
                    onClick={anchorAtDiscoveredIsland}
                  />
                </SquallsActionSection>
                <SquallsActionSection label="Retreat And Return">
                  <SquallsActionOption
                    emoji="⛵"
                    title="Keep sailing past"
                    detail="Ignore the shore and trust the open sea."
                    tone="retreat"
                    onClick={abandonDiscoveredIsland}
                  />
                </SquallsActionSection>
              </SquallsActionSheet>
            </Box>
          ) : activeEvent?.type === "port" ? (
            <Box w="100%">
              <Text fontSize="lg" fontWeight="semibold" mb={4}>
                In the distance, ye spy{" "}
                <strong>
                  {currentPortTown
                    ? renderPortTownName(currentPortTown)
                    : "a port town"}
                </strong>
                .
              </Text>
              <SquallsActionSheet title="Harbor Decision">
                <SquallsActionSection label="Supplies And Services">
                  <SquallsActionOption
                    emoji="⚓"
                    title="Dock at the port"
                    detail="Trade, recruit, and resupply behind safer walls."
                    tone="service"
                    onClick={dockAtPortTown}
                  />
                </SquallsActionSection>
                <SquallsActionSection label="Explore And Advance">
                  <SquallsActionOption
                    emoji="⛵"
                    title="Sail past the harbor"
                    detail="Stay on course and risk the next sea event."
                    tone="explore"
                    onClick={sailPastPortTown}
                  />
                </SquallsActionSection>
              </SquallsActionSheet>
            </Box>
          ) : activeEvent?.type === "merchant" ? (
            <Box w="100%">
              <Text fontSize="lg" fontWeight="semibold" mb={4}>
                {isIslandTraderEvent(activeEvent)
                  ? "A local trader beckons ye over with island wares and a hard bargain."
                  : "A merchant vessel hails ye and offers trade in open water."}
              </Text>
              <SquallsActionSheet title="Trade Or Move">
                <SquallsActionSection label="Supplies And Services">
                  <SquallsActionOption
                    emoji="💰"
                    title="Parley and trade"
                    detail="Spend gold now to improve odds later."
                    tone="service"
                    onClick={
                      isIslandTraderEvent(activeEvent)
                        ? openIslandTraderShop
                        : openMerchantShop
                    }
                  />
                </SquallsActionSection>
                <SquallsActionSection label="Explore And Advance">
                  <SquallsActionOption
                    emoji={location === "island" ? "🏝️" : "⛵"}
                    title={location === "island" ? "Move on from the trader" : "Sail on"}
                    detail="Keep momentum and leave this encounter behind."
                    tone="explore"
                    onClick={() => {
                      setActiveEvent(null);
                      setGameState("home");
                      setDay(day + 1);
                    }}
                  />
                </SquallsActionSection>
              </SquallsActionSheet>
            </Box>
          ) : activeEvent?.type === "shipwreck" ? (
            <Box w="100%">
              <VStack align="stretch" gap={2} mb={4} w="100%">
                <Text fontSize="lg" fontWeight="semibold">
                  Through the swells ye spot a half-sunk hull, heavy with barnacles and kelp.
                </Text>
                <Text fontSize="sm" color={SQUALLS_TEXT_ZONE.muted}>
                  Something worth salvaging likely waits below deck, if ye can survive the dive.
                </Text>
              </VStack>
              {getItemCount(hero.inventory, "siren_gills") <= 0 &&
              getItemCount(hero.inventory, "dive_helmet") <= 0 ? (
                <Text fontSize="sm" color={SQUALLS_TEXT_ZONE.muted} mb={4}>
                  Ye cannot breathe underwater yet, so a wreck dive is impossible for now.
                </Text>
              ) : null}
              <SquallsActionSheet title="Wreck Approach">
                <SquallsActionSection label="Explore And Advance">
                  {getItemCount(hero.inventory, "siren_gills") > 0 ? (
                    <SquallsActionOption
                      emoji="🫁"
                      title="Dive with siren gills"
                      detail="Risk the depths to reclaim what the sea swallowed."
                      tone="risk"
                      onClick={() => resolveShipwreckDive("siren_gills")}
                    />
                  ) : null}
                  {getItemCount(hero.inventory, "dive_helmet") > 0 ? (
                    <SquallsActionOption
                      emoji="🤿"
                      title="Dive with helmet"
                      detail="A safer descent, but still a gamble in dark waters."
                      tone="risk"
                      onClick={() => resolveShipwreckDive("dive_helmet")}
                    />
                  ) : null}
                </SquallsActionSection>
                <SquallsActionSection label="Retreat And Return">
                  <SquallsActionOption
                    emoji="⛵"
                    title="Sail on"
                    detail="Leave the wreck untouched and preserve crew strength."
                    tone="retreat"
                    onClick={() => resolveShipwreckDive("sail_past")}
                  />
                </SquallsActionSection>
              </SquallsActionSheet>
            </Box>
          ) : activeEvent?.type === "weather" ? (
            <Box w="100%">
              <Text fontSize="sm" mb={4}>
                {location === "island" && isIslandWeatherEvent(activeEvent)
                  ? activeEvent.name === "Storm!"
                    ? "Dark clouds gather over the island and rain lashes the shore."
                    : activeEvent.name === "Wind"
                      ? "A stiff wind tears through palms and sand stings yer eyes."
                      : activeEvent.name === "Heat Wave"
                        ? "The sun beats down mercilessly and the air shimmers with heat."
                        : `The island weather turns: ${activeEvent.name}.`
                  : activeEvent.name === "Storm!"
                    ? "Lightning splits the sky while waves crash over the rail."
                    : activeEvent.name === "Fog Bank"
                      ? "A calm mist settles over deck and grants a brief breath of peace."
                      : `The sea turns rough: ${activeEvent.name}.`}
              </Text>
              {location !== "island" && seaWeatherEffectLabel(activeEvent.name) ? (
                <Text fontSize="sm" color={SQUALLS_TEXT_ZONE.muted} mb={4}>
                  {seaWeatherEffectLabel(activeEvent.name)}
                </Text>
              ) : null}
              <SquallsActionSheet title="Weather Response">
                <SquallsActionSection label="Explore And Advance">
                  <SquallsActionOption
                    emoji="✅"
                    title="Weather the change"
                    detail="Brace the crew and move forward."
                    tone="explore"
                    onClick={
                      location === "island" && isIslandWeatherEvent(activeEvent)
                        ? acknowledgeGenericEvent
                        : acknowledgeWeatherEvent
                    }
                  />
                </SquallsActionSection>
              </SquallsActionSheet>
            </Box>
          ) : (
            <Box w="100%">
              <Text fontSize="sm" mb={4}>
                {activeEvent?.type === "hazard"
                  ? "Danger approaches quickly. Choose with care."
                  : `Ye have encountered: ${activeEvent?.name}`}
              </Text>
              <SquallsActionSheet title="Decision">
                <SquallsActionSection label="Explore And Advance">
                  <SquallsActionOption
                    emoji="✅"
                    title="Face it and continue"
                    detail="Accept the event and let the journey carry on."
                    tone="explore"
                    onClick={acknowledgeGenericEvent}
                  />
                </SquallsActionSection>
              </SquallsActionSheet>
            </Box>
          )}
        </VStack>
      );
    }

    case "battle": {
      const combatHandCols = 3;
      const combatHandMinRows = 2;
      const combatHandRows = Math.max(
        combatHandMinRows,
        Math.ceil(displayedCards.length / combatHandCols),
      );
      const combatHandSlotCount = combatHandRows * combatHandCols;
      const cardSlots = Array.from({ length: combatHandSlotCount }, (_, index) =>
        displayedCards[index] ?? null,
      );
      const returnDestinationLabel =
        location === "dungeon"
          ? "Return to Dungeon"
          : location === "island"
            ? "Return to Island"
            : "Return to Ship";

      return (
        <CombatBattleDnd
          hand={hand}
          equipped={hero.equipped}
          isPlayerTurn={isPlayerTurn}
          viewingHand={viewingHand}
          energy={energy}
          heroAmmo={hero.ammo}
          onPlayCard={playCombatCard}
        >
          <Box
            h="100dvh"
            w="100%"
            display="grid"
            gridTemplateRows="auto 1fr"
            overflow="hidden"
          >
            {/* Top half: hero, battle header, enemies, log */}
            <Box
              minH={0}
              flexShrink={0}
              display="flex"
              flexDirection="column"
              gap={2}
              px={2}
              pt={2}
              pb={1}
              overflow="hidden"
              borderBottomWidth="1px"
              borderColor={SQUALLS_HUD_COLORS.panelBorder}
            >
              <AdventureStripe
                location={location}
                gameState="battle"
                currentIsland={currentIsland}
                currentDungeon={currentDungeon}
                renderIslandName={renderIslandName}
                renderDungeonName={renderDungeonName}
                onOpenCharacterSheet={onOpenCharacterSheet}
              />

              {enemyActionMessage && !combatVictory && (
                <Box
                  w="100%"
                  py={1}
                  px={2}
                  borderRadius="md"
                  bg="rgba(12, 28, 37, 0.72)"
                  borderWidth="1px"
                  borderColor={SQUALLS_HUD_COLORS.panelBorder}
                  flexShrink={0}
                >
                  <Text fontSize="xs" fontWeight="medium" lineClamp={2}>
                    {enemyActionMessage}
                  </Text>
                </Box>
              )}

              <CombatDefendDropZone>
                <SimpleGrid
                  columns={3}
                  gap={1.5}
                  w="100%"
                  gridTemplateRows="repeat(2, minmax(4.25rem, auto))"
                >
                  {Array.from({ length: MAX_BATTLEFIELD_ENEMIES }, (_, index) => {
                    const enemy = enemies[index];
                    if (!enemy) {
                      return <Box key={`enemy-slot-${index}`} w="100%" aria-hidden />;
                    }
                    const slain = !isEnemyAlive(enemy);
                    return (
                      <CombatEnemyDropTarget
                        key={`${enemy.name}-${index}`}
                        enemyIndex={index}
                        slain={slain}
                      >
                        <CombatEnemyCard
                          enemy={enemy}
                          heroLevel={hero.level}
                          slain={slain}
                        />
                      </CombatEnemyDropTarget>
                    );
                  })}
                </SimpleGrid>
              </CombatDefendDropZone>

              <Box
                w="100%"
                flexShrink={0}
                overflow="hidden"
                borderRadius="md"
                bg="rgba(11, 24, 32, 0.6)"
                px={2}
                py={1}
              >
                {combatLog.length === 0 ? (
                  <Text fontSize="xs" color={SQUALLS_HUD_COLORS.panelMuted}>
                    {combatVictory
                      ? "Victory!"
                      : combatPhase === "player"
                        ? "Your turn - choose an action"
                        : "Enemy turn"}
                  </Text>
                ) : (
                  combatLog.map((entry, index) => {
                    const ageFromNewest = combatLog.length - 1 - index;
                    const entryStyle = getCombatLogEntryStyle(
                      entry.side,
                      ageFromNewest,
                    );
                    return (
                      <Text
                        key={`${index}-${entry.text}`}
                        fontSize="xs"
                        lineHeight="short"
                        fontWeight={entryStyle.fontWeight}
                        color={entryStyle.color}
                      >
                        {entry.text}
                      </Text>
                    );
                  })
                )}
              </Box>
            </Box>

            {/* Bottom half: hand / discard or victory */}
            <Box
              minH={0}
              h="100%"
              display="flex"
              flexDirection="column"
              gap={1}
              px={2}
              pt={2}
              pb={2}
              overflow="hidden"
            >
              {combatVictory ? (
                <LootClaimPanel
                  title="Ye Have Won Combat"
                  titleSize="xl"
                  loot={combatLoot}
                  allClaimed={allCombatLootClaimed}
                  returnLabel={returnDestinationLabel}
                  onClaim={claimCombatLoot}
                  onComplete={dismissCombatVictory}
                  fillHeight
                  inlineReturnInHeader
                />
              ) : (
                <>
                  <PlayerPanel
                    hero={hero}
                    gameState="battle"
                    armor={armor}
                    weakened={heroWeakened}
                    onOpenCharacterSheet={onOpenCharacterSheet}
                  />
                  <HStack
                    w="100%"
                    justify="space-between"
                    align="center"
                    gap={2}
                    flexShrink={0}
                  >
                    <HStack gap={1} flexShrink={0}>
                      <Button
                        size="sm"
                        variant={viewingHand ? "solid" : "ghost"}
                        colorPalette={viewingHand ? "gray" : undefined}
                        onClick={() => setCardZone("hand")}
                      >
                        Hand
                      </Button>
                      <Button
                        size="sm"
                        variant={!viewingHand ? "solid" : "ghost"}
                        colorPalette={!viewingHand ? "gray" : undefined}
                        onClick={() => setCardZone("discard")}
                      >
                        Discard
                      </Button>
                    </HStack>
                    {isPlayerTurn && (
                      <Button
                        size="xs"
                        colorPalette="orange"
                        flexShrink={0}
                        onClick={handlePass}
                      >
                        Pass
                      </Button>
                    )}
                    <CombatEnergyGems energy={energy} maxEnergy={maxEnergy} />
                  </HStack>

                  <Box flex="1" minH={0} w="100%" overflowY="auto" overflowX="hidden">
                    <SimpleGrid
                      columns={combatHandCols}
                      gap={1.5}
                      w="100%"
                      maxW={CARD_GRID_3COL_MAX_WIDTH}
                      mx="auto"
                    >
                      {displayedCards.length === 0 ? (
                        <Text
                          gridColumn="1 / -1"
                          py={8}
                          fontSize="xs"
                          color={SQUALLS_HUD_COLORS.panelMuted}
                          textAlign="center"
                          px={2}
                        >
                          {viewingHand ? "No cards in hand" : "No cards in discard"}
                        </Text>
                      ) : (
                        cardSlots.map((card, index) => (
                          <Box
                            key={`${cardZone}-slot-${index}`}
                            position="relative"
                            w="100%"
                            aspectRatio={CARD_ASPECT_RATIO}
                          >
                            {card ? (
                              viewingHand ? (
                                <DraggableCombatHandCard
                                  handIndex={index}
                                  card={card}
                                  cost={getCardEnergyCost(card)}
                                  equipped={hero.equipped}
                                  heroAmmo={hero.ammo}
                                  disabled={
                                    !(isPlayerTurn && energy >= getCardEnergyCost(card)) ||
                                    (cardRequiresAmmo(card) && hero.ammo < 1)
                                  }
                                />
                              ) : (
                                <CombatHandCard
                                  card={card}
                                  cost={getCardEnergyCost(card)}
                                  equipped={hero.equipped}
                                  layout="hand"
                                  fillSlot
                                  viewOnly
                                  disabled
                                  onClick={() => {}}
                                />
                              )
                            ) : null}
                          </Box>
                        ))
                      )}
                    </SimpleGrid>
                  </Box>

                  {isPlayerTurn && viewingHand && (
                    <Text
                      fontSize="xs"
                      color={SQUALLS_HUD_COLORS.panelMuted}
                      textAlign="center"
                      flexShrink={0}
                      w="100%"
                    >
                      Drag attacks onto a foe; drag defend into the battlefield
                    </Text>
                  )}
                </>
              )}
            </Box>
          </Box>
        </CombatBattleDnd>
      );
    }

    case "dead":
      return (
        <VStack align="start" gap={4} {...SQUALLS_WORLD_PANEL} p={{ base: 3, md: 4 }}>
          <SquallsHeading>☠️ Ye Are Dead!</SquallsHeading>
          <Button onClick={resetToLobby}>Return to Lobby</Button>
        </VStack>
      );

    default:
      return (
        <VStack align="start" gap={4} {...SQUALLS_WORLD_PANEL} p={{ base: 3, md: 4 }}>
          <SquallsHeading>Ye Be Lost at Sea</SquallsHeading>
          <Text>State: {gameState}</Text>
          <Button onClick={goToLobby}>Return Home</Button>
        </VStack>
      );
  }
  })();

  return (
    <>
      {panelContent}
      <PassEnergyConfirmModal
        open={passConfirmOpen}
        onOpenChange={setPassConfirmOpen}
        energy={energy}
        maxEnergy={maxEnergy}
        onConfirm={confirmPassWithEnergy}
      />
    </>
  );
}
