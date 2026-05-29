import { useState } from "react";
import { Link } from "react-router";
import {
  Box,
  Button,
  Heading,
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
import { isTreasureEvent } from "./combatLoot";
import { isLockedTreasureChest } from "./dungeonTreasure";
import {
  isFloatingSuppliesEvent,
  isSeaTreasureEvent,
  FLOATING_SUPPLIES_UNLOCKED_INTRO,
  TREASURE_CHEST_EMOJI,
} from "./floatingSuppliesLoot";
import { isIslandTraderEvent, isIslandWeatherEvent } from "./islandEventDeck";
import {
  isBuriedTreasureEvent,
  isSupplyCacheEvent,
  BURIED_TREASURE_INTRO,
  SUPPLY_CACHE_INTRO,
} from "./islandTreasureLoot";
import {
  enemyBroadcastColor,
  formatEnemyBroadcastLabel,
} from "./enemyActions";
import { seaWeatherEffectLabel } from "./seaWeather";
import LockedChestPanel from "./LockedChestPanel";
import {
  getDungeonKindEmoji,
  getEnterDungeonLabel,
  isActiveIslandDungeon,
  isDungeonDiscoveryEvent,
} from "./dungeonExplore";
import DungeonView from "./DungeonView";
import CombatHandCard from "./CombatHandCard";
import LootClaimPanel from "./LootClaimPanel";
import {
  formatEnemyHp,
  getCardEnergyCost,
  getEnemyDisplayTraits,
  isEnemyAlive,
} from "./combatRules";
import AdventureStripe from "./AdventureStripe";
import PlayerPanel from "./PlayerPanel";
import HomeActionGrid from "./HomeActionGrid";
import PassEnergyConfirmModal from "./PassEnergyConfirmModal";
import RestartAdventureConfirmModal from "./RestartAdventureConfirmModal";
import RestView from "./RestView";
import ShipView from "./ShipView";
import ShopView from "./ShopView";
import SquallsActionCard from "./SquallsActionCard";
import { getItemCount } from "./shantiesItems";
import type { CombatLogSide, EventType, WorldPanelProps } from "./shantiesTypes";

function eventHeadingEmoji(event: EventType | null): string {
  if (!event) return "⛈️";
  if (isDungeonDiscoveryEvent(event) && event.dungeonKind) {
    return getDungeonKindEmoji(event.dungeonKind);
  }
  switch (event.type) {
    case "discovery":
      return "🏝️";
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
  currentDungeon,
  renderIslandName,
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
  resumeAdventure,
  restartAdventure,
  canResumeAdventure,
  lobbySaveSummaryLines,
  lobbySavedAtLabel,
  healHero,
  openRest,
  wakeFromRest,
  leaveRest,
  restComplete,
  restMessage,
  shopMessage,
  shopVariant,
  buyShopItem,
  sellShopItem,
  sellShopEquipment,
  leaveShop,
  openShipShop,
  openMerchantShop,
  openIslandTraderShop,
  resolveShipwreckDive,
  onOpenCharacterSheet,
  isStaff = false,
}: WorldPanelProps) {
  const isPlayerTurn =
    combatPhase === "player" && !victoryPending && !combatVictory;
  const [cardZone, setCardZone] = useState<"hand" | "discard">("hand");
  const [passConfirmOpen, setPassConfirmOpen] = useState(false);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const viewingHand = cardZone === "hand";
  const displayedCards = viewingHand ? hand : discardPile;

  const HERO_LOG_COLORS = [
    "green.800",
    "green.700",
    "green.600",
    "green.500",
    "green.400",
  ] as const;
  const ENEMY_LOG_COLORS = [
    "red.800",
    "red.700",
    "red.600",
    "red.500",
    "red.400",
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
    case "lobby":
      return (
        <VStack align="start" gap={4} w="100%" maxW="md">
          <Heading>🏴‍☠️ Squalls & Shanties</Heading>
          <Text color="gray.900">Yer saved adventure</Text>
          <Box
            w="100%"
            borderWidth="1px"
            borderColor="blackAlpha.200"
            borderRadius="md"
            bg="blackAlpha.50"
            px={4}
            py={3}
          >
            <VStack align="stretch" gap={2}>
              {lobbySaveSummaryLines.map((line) => (
                <HStack
                  key={line.label}
                  w="100%"
                  justify="space-between"
                  gap={3}
                  align="baseline"
                >
                  <Text fontSize="sm" color="gray.900" flexShrink={0}>
                    {line.label}
                  </Text>
                  <Text fontSize="sm" fontWeight="medium" textAlign="right">
                    {line.value}
                  </Text>
                </HStack>
              ))}
            </VStack>
            {lobbySavedAtLabel ? (
              <Text fontSize="xs" color="gray.900" mt={3}>
                Last saved {lobbySavedAtLabel}
              </Text>
            ) : null}
          </Box>
          <HStack gap={3} wrap="wrap" w="100%">
            <Button
              colorPalette="orange"
              onClick={resumeAdventure}
              disabled={!canResumeAdventure}
            >
              Resume playing
            </Button>
            <Button
              variant="outline"
              onClick={() => setRestartConfirmOpen(true)}
            >
              Restart adventure
            </Button>
          </HStack>
          {!canResumeAdventure ? (
            <Text fontSize="xs" color="gray.900">
              No adventure in progress — restart to set sail.
            </Text>
          ) : null}
          {isStaff ? (
            <Text fontSize="sm">
              <Link to="/squalls/dm">Game reference (staff)</Link>
            </Text>
          ) : null}
        </VStack>
      );

    case "home":
      return (
        <VStack align="stretch" gap={5} w="100%">
          <Heading>
            {location === "ship"
              ? "⛵ Ye Be on the Ship"
              : location === "dungeon" && currentDungeon
                ? `${getDungeonKindEmoji(currentDungeon.kind)} ${renderDungeonName(currentDungeon)}`
                : `🏝️ ${currentIsland ? renderIslandName(currentIsland) : "Unknown Island"}`}
          </Heading>

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
            />
          )}

          {location === "island" && (
            <HomeActionGrid>
              {currentDungeon && isActiveIslandDungeon(currentDungeon) ? (
                <SquallsActionCard
                  emoji={getDungeonKindEmoji(currentDungeon.kind)}
                  label={getEnterDungeonLabel(currentDungeon)}
                  accent="orange"
                  onClick={enterCurrentDungeon}
                />
              ) : null}
              <SquallsActionCard
                emoji="🧭"
                label={`Explore Island (${currentIsland ? Math.max(0, currentIsland.explorePoints) : 0})`}
                accent="teal"
                disabled={!currentIsland || currentIsland.explorePoints <= 0}
                onClick={handleSailOrExplore}
              />
              <SquallsActionCard
                emoji="⛵"
                label="Return to Ship"
                accent="blue"
                onClick={returnToShipFromIsland}
              />
            </HomeActionGrid>
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

          <Box w="100%" maxW="7rem">
            <SquallsActionCard
              emoji="🚪"
              label="Quit Game"
              accent="gray"
              onClick={goToLobby}
            />
          </Box>
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

    case "event": {
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
            leaveAccent={
              isSeaTreasureEvent(activeEvent) ? "blue" : undefined
            }
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
        <VStack align="stretch" gap={4} w="100%">
          <Heading>{eventHeadingEmoji(activeEvent)} {activeEvent?.name}</Heading>

          {activeEvent && isDungeonDiscoveryEvent(activeEvent) ? (
            <Box w="100%">
              <Text mb={4} fontSize="lg">
                While exploring, ye discover{" "}
                <strong>{activeEvent.name}</strong>!
              </Text>
              <Text mb={4} fontSize="sm" color="gray.900">
                The passage is pitch black — ye'll need a candle to explore it.
              </Text>
              <HomeActionGrid>
                {getItemCount(hero.inventory, "candle") > 0 ? (
                  <SquallsActionCard
                    emoji="🕯️"
                    label="Enter with Candle"
                    accent="teal"
                    onClick={() => resolveDungeonDiscovery(true)}
                  />
                ) : null}
                <SquallsActionCard
                  emoji="🌿"
                  label="Leave it be"
                  accent="gray"
                  onClick={() => resolveDungeonDiscovery(false)}
                />
              </HomeActionGrid>
            </Box>
          ) : activeEvent?.type === "discovery" ? (
            <Box w="100%">
              <Text mb={4} fontSize="lg">
                On the horizon, ye spy{" "}
                <strong>
                  {currentIsland
                    ? renderIslandName(currentIsland)
                    : "an unknown shore"}
                </strong>
                !
              </Text>
              <HomeActionGrid>
                <SquallsActionCard
                  emoji="⚓"
                  label="Anchor at Island"
                  accent="teal"
                  onClick={anchorAtDiscoveredIsland}
                />
                <SquallsActionCard
                  emoji="⛵"
                  label="Keep Sailing"
                  accent="blue"
                  onClick={abandonDiscoveredIsland}
                />
              </HomeActionGrid>
            </Box>
          ) : activeEvent?.type === "merchant" ? (
            <Box w="100%">
              <Text mb={4} fontSize="lg">
                {isIslandTraderEvent(activeEvent)
                  ? "A local trader beckons ye over, offering island goods for gold."
                  : "A friendly merchant hails ye from a nearby vessel, offering goods for gold."}
              </Text>
              <HomeActionGrid>
                <SquallsActionCard
                  emoji="💰"
                  label="Trade"
                  accent="yellow"
                  onClick={
                    isIslandTraderEvent(activeEvent)
                      ? openIslandTraderShop
                      : openMerchantShop
                  }
                />
                <SquallsActionCard
                  emoji={location === "island" ? "🏝️" : "⛵"}
                  label={location === "island" ? "Move On" : "Sail on"}
                  accent="blue"
                  onClick={() => {
                    setActiveEvent(null);
                    setGameState("home");
                    setDay(day + 1);
                  }}
                />
              </HomeActionGrid>
            </Box>
          ) : activeEvent?.type === "shipwreck" ? (
            <Box w="100%">
              <Text mb={4} fontSize="lg">
                Through the swells ye spot a half-sunk hull — barnacles and
                kelp cling to its timbers. Something worth salvaging may lie
                below decks, but ye'll need a way to breathe underwater.
              </Text>
              {getItemCount(hero.inventory, "siren_gills") <= 0 &&
              getItemCount(hero.inventory, "dive_helmet") <= 0 ? (
                <Text mb={4} fontSize="sm" color="gray.900">
                  You can't breathe underwater yet, so exploring this shipwreck
                  isn't possible...
                </Text>
              ) : null}
              <HomeActionGrid>
                {getItemCount(hero.inventory, "siren_gills") > 0 ? (
                  <SquallsActionCard
                    emoji="🫁"
                    label="Explore with Siren Gills"
                    accent="teal"
                    onClick={() => resolveShipwreckDive("siren_gills")}
                  />
                ) : null}
                {getItemCount(hero.inventory, "dive_helmet") > 0 ? (
                  <SquallsActionCard
                    emoji="🤿"
                    label="Explore with Dive Helmet"
                    accent="teal"
                    onClick={() => resolveShipwreckDive("dive_helmet")}
                  />
                ) : null}
                <SquallsActionCard
                  emoji="⛵"
                  label="Sail On"
                  accent="blue"
                  onClick={() => resolveShipwreckDive("sail_past")}
                />
              </HomeActionGrid>
            </Box>
          ) : activeEvent?.type === "weather" ? (
            <Box w="100%">
              <Text mb={4}>
                {location === "island" && isIslandWeatherEvent(activeEvent)
                  ? activeEvent.name === "Storm!"
                    ? "Dark clouds gather over the island — rain lashes the shore."
                    : activeEvent.name === "Wind"
                      ? "A stiff wind whips through the palms and sand stings yer eyes."
                      : activeEvent.name === "Heat Wave"
                        ? "The sun beats down mercilessly — the air shimmers with heat."
                        : `The island weather turns — ${activeEvent.name}.`
                  : activeEvent.name === "Storm!"
                    ? "Lightning splits the sky and waves crash over the rail. The crew weathers it as best they can."
                    : activeEvent.name === "Fog Bank"
                      ? "A calm mist settles over the deck — the seas grow gentle and ye catch yer breath."
                      : `The sea turns rough — ${activeEvent.name}.`}
              </Text>
              {location !== "island" && seaWeatherEffectLabel(activeEvent.name) ? (
                <Text mb={4} fontSize="sm" color="gray.900">
                  {seaWeatherEffectLabel(activeEvent.name)}
                </Text>
              ) : null}
              <HomeActionGrid>
                <SquallsActionCard
                  emoji="✅"
                  label="Acknowledge"
                  accent="blue"
                  onClick={
                    location === "island" && isIslandWeatherEvent(activeEvent)
                      ? acknowledgeGenericEvent
                      : acknowledgeWeatherEvent
                  }
                />
              </HomeActionGrid>
            </Box>
          ) : (
            <Box w="100%">
              <Text mb={4}>
                {activeEvent?.type === "hazard"
                  ? "Danger approaches quickly..."
                  : `Ye have encountered: ${activeEvent?.name}`}
              </Text>
              <HomeActionGrid>
                <SquallsActionCard
                  emoji="✅"
                  label="Acknowledge"
                  accent="blue"
                  onClick={acknowledgeGenericEvent}
                />
              </HomeActionGrid>
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
          onPlayCard={playCombatCard}
        >
          <Box
            h="100dvh"
            w="100%"
            display="grid"
            gridTemplateRows="50dvh 50dvh"
            overflow="hidden"
          >
            {/* Top half: hero, battle header, enemies, log */}
            <Box
              minH={0}
              display="flex"
              flexDirection="column"
              gap={2}
              px={2}
              pt={2}
              pb={1}
              overflow="hidden"
              borderBottomWidth="1px"
              borderColor="blackAlpha.200"
            >
              <AdventureStripe
                day={day}
                location={location}
                gameState="battle"
                currentIsland={currentIsland}
                currentDungeon={currentDungeon}
                renderIslandName={renderIslandName}
                renderDungeonName={renderDungeonName}
              />
              <PlayerPanel
                hero={hero}
                gameState="battle"
                armor={armor}
                weakened={heroWeakened}
                onOpenCharacterSheet={onOpenCharacterSheet}
              />

              {enemyActionMessage && !combatVictory && (
                <Box
                  w="100%"
                  py={1}
                  px={2}
                  borderRadius="md"
                  bg="blackAlpha.400"
                  borderWidth="1px"
                  borderColor="whiteAlpha.300"
                  flexShrink={0}
                >
                  <Text fontSize="xs" fontWeight="medium" lineClamp={2}>
                    {enemyActionMessage}
                  </Text>
                </Box>
              )}

              <CombatDefendDropZone>
                <Box minH={0} h="100%" overflowY="auto" w="100%">
                <SimpleGrid columns={3} gap={1.5} w="100%" gridAutoRows="auto">
                  {Array.from({ length: 9 }, (_, index) => {
                    const enemy = enemies[index];
                    if (!enemy) {
                      return <Box key={`enemy-slot-${index}`} minH={0} />;
                    }
                    const slain = !isEnemyAlive(enemy);
                    return (
                      <CombatEnemyDropTarget
                        key={`${enemy.name}-${index}`}
                        enemyIndex={index}
                        slain={slain}
                      >
                        <Box
                          p={1.5}
                          minH="3.25rem"
                          w="100%"
                          h="100%"
                          display="flex"
                          flexDirection="column"
                          justifyContent="space-between"
                          gap={0.5}
                          borderWidth="1px"
                          borderColor={slain ? "gray.500" : "red.500"}
                          borderRadius="md"
                          bg={slain ? "blackAlpha.100" : "blackAlpha.200"}
                          opacity={slain ? 0.55 : 1}
                          filter={slain ? "grayscale(1)" : undefined}
                          pointerEvents={slain ? "none" : undefined}
                        >
                          <HStack
                            w="100%"
                            justify="space-between"
                            align="center"
                            gap={1}
                            minW={0}
                          >
                            <Text
                              fontWeight="bold"
                              fontSize="xs"
                              lineClamp={1}
                              flex={1}
                            >
                              {enemy.name}
                            </Text>
                            <Text fontSize="xs" fontWeight="semibold" flexShrink={0}>
                              {formatEnemyHp(enemy)}
                            </Text>
                          </HStack>
                          <Text
                            fontSize="xs"
                            fontWeight="semibold"
                            textAlign="center"
                            color={
                              slain
                                ? "gray.900"
                                : enemyBroadcastColor(enemy.broadcast)
                            }
                          >
                            {slain
                              ? "Slain"
                              : formatEnemyBroadcastLabel(enemy.broadcast)}
                          </Text>
                          {!slain && getEnemyDisplayTraits(enemy).length > 0 ? (
                            <Text
                              fontSize="2xs"
                              fontWeight="semibold"
                              textAlign="center"
                              color="purple.700"
                            >
                              {getEnemyDisplayTraits(enemy).join(", ")}
                            </Text>
                          ) : null}
                          <Box
                            minH="1.25rem"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            w="100%"
                          >
                            {!slain && enemy.armor > 0 ? (
                              <Text fontSize="xs" textAlign="center" color="gray.900">
                                Armor {enemy.armor}
                              </Text>
                            ) : null}
                          </Box>
                        </Box>
                      </CombatEnemyDropTarget>
                    );
                  })}
                </SimpleGrid>
                </Box>
              </CombatDefendDropZone>

              <Box
                w="100%"
                flexShrink={0}
                overflow="hidden"
                borderRadius="md"
                bg="blackAlpha.200"
                px={2}
                py={1}
              >
                {combatLog.length === 0 ? (
                  <Text fontSize="xs" color="gray.900">
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
                  title="🏆 Ye Have Won Combat"
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
                    <Text
                      fontSize="sm"
                      fontWeight="semibold"
                      textAlign="right"
                      flexShrink={0}
                    >
                      Energy: {energy}/{maxEnergy}
                    </Text>
                  </HStack>

                  <Box
                    position="relative"
                    flex="1"
                    minH={0}
                    w="100%"
                    display="grid"
                    gridTemplateColumns="repeat(3, minmax(0, 1fr))"
                    gridTemplateRows={`repeat(${combatHandRows}, minmax(0, 1fr))`}
                    gap={1.5}
                  >
                    {displayedCards.length === 0 && (
                      <Text
                        gridColumn="1 / -1"
                        gridRow="1 / -1"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        fontSize="xs"
                        color="gray.900"
                        textAlign="center"
                        px={2}
                        pointerEvents="none"
                      >
                        {viewingHand ? "No cards in hand" : "No cards in discard"}
                      </Text>
                    )}
                    {cardSlots.map((card, index) => (
                      <Box
                        key={`${cardZone}-slot-${index}`}
                        position="relative"
                        minH={0}
                        minW={0}
                        h="100%"
                        w="100%"
                      >
                        {card ? (
                          viewingHand ? (
                            <DraggableCombatHandCard
                              handIndex={index}
                              card={card}
                              cost={getCardEnergyCost(card)}
                              equipped={hero.equipped}
                              disabled={
                                !(isPlayerTurn && energy >= getCardEnergyCost(card))
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
                    ))}
                  </Box>

                  {isPlayerTurn && viewingHand && (
                    <Text
                      fontSize="xs"
                      color="gray.900"
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
        <VStack align="start" gap={4}>
          <Heading>☠️ Ye Are Dead!</Heading>
          <Button onClick={resetToLobby}>Return to Lobby</Button>
        </VStack>
      );

    default:
      return (
        <VStack align="start" gap={4}>
          <Heading>Ye Be Lost at Sea</Heading>
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
      <RestartAdventureConfirmModal
        open={restartConfirmOpen}
        onOpenChange={setRestartConfirmOpen}
        onConfirm={restartAdventure}
      />
    </>
  );
}
