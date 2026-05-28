import { useState } from "react";
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
import { isLockedDungeonTreasure } from "./dungeonTreasure";
import LockedChestPanel from "./LockedChestPanel";
import {
  getDungeonKindEmoji,
  getEnterDungeonLabel,
  isDungeonDiscoveryEvent,
} from "./dungeonExplore";
import DungeonView from "./DungeonView";
import CombatHandCard from "./CombatHandCard";
import LootClaimPanel from "./LootClaimPanel";
import {
  formatEnemyHp,
  formatEnemyIntentLabel,
  getCardEnergyCost,
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
import type { WorldPanelProps } from "./shantiesTypes";

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
  abandonLockedDungeonChest,
  unlockDungeonChestWithKey,
  forceOpenDungeonChest,
  dungeonChestUnlocked,
  chestMessage,
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
  buyShopItem,
  sellShopItem,
  sellShopEquipment,
  leaveShop,
  onOpenCharacterSheet,
}: WorldPanelProps) {
  const isPlayerTurn =
    combatPhase === "player" && !victoryPending && !combatVictory;
  const [cardZone, setCardZone] = useState<"hand" | "discard">("hand");
  const [passConfirmOpen, setPassConfirmOpen] = useState(false);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const viewingHand = cardZone === "hand";
  const displayedCards = viewingHand ? hand : discardPile;

  const getCombatLogEntryStyle = (ageFromNewest: number) => {
    if (ageFromNewest === 0) {
      return { fontWeight: "bold" as const, color: "gray.900" };
    }
    if (ageFromNewest === 1) {
      return { fontWeight: "normal" as const, color: "gray.700" };
    }
    if (ageFromNewest === 2) {
      return { fontWeight: "normal" as const, color: "gray.600" };
    }
    if (ageFromNewest === 3) {
      return { fontWeight: "normal" as const, color: "gray.500" };
    }
    return { fontWeight: "normal" as const, color: "gray.400" };
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
          <Text color="fg.muted">Yer saved adventure</Text>
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
                  <Text fontSize="sm" color="fg.muted" flexShrink={0}>
                    {line.label}
                  </Text>
                  <Text fontSize="sm" fontWeight="medium" textAlign="right">
                    {line.value}
                  </Text>
                </HStack>
              ))}
            </VStack>
            {lobbySavedAtLabel ? (
              <Text fontSize="xs" color="fg.muted" mt={3}>
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
            <Text fontSize="xs" color="fg.muted">
              No adventure in progress — restart to set sail.
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
              onShop={() => setGameState("shop")}
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
            />
          )}

          {location === "island" && (
            <HomeActionGrid>
              {currentDungeon ? (
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
              onReturnToIsland={returnToIslandFromDungeon}
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
        isLockedDungeonTreasure(activeEvent, location, dungeonChestUnlocked)
      ) {
        return (
          <LockedChestPanel
            event={activeEvent}
            hero={hero}
            message={chestMessage}
            onUnlockWithKey={unlockDungeonChestWithKey}
            onForceOpen={forceOpenDungeonChest}
            onLeave={abandonLockedDungeonChest}
          />
        );
      }

      if (activeEvent && isTreasureEvent(activeEvent)) {
        return (
          <LootClaimPanel
            title={`💎 ${activeEvent.name}`}
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
        <VStack align="start" gap={4}>
          <Heading>⛈️ {activeEvent?.name}</Heading>

          {activeEvent && isDungeonDiscoveryEvent(activeEvent) ? (
            <Box>
              <Text mb={4} fontSize="lg">
                While exploring, ye discover{" "}
                <strong>{activeEvent.name}</strong>!
              </Text>
              <HStack gap={2}>
                <Button
                  colorPalette="teal"
                  onClick={() => resolveDungeonDiscovery(true)}
                >
                  Enter
                </Button>
                <Button onClick={() => resolveDungeonDiscovery(false)}>
                  Leave it be
                </Button>
              </HStack>
            </Box>
          ) : activeEvent?.type === "discovery" ? (
            <Box>
              <Text mb={4} fontSize="lg">
                On the horizon, ye spy{" "}
                <strong>
                  {currentIsland
                    ? renderIslandName(currentIsland)
                    : "an unknown shore"}
                </strong>
                !
              </Text>
              <HStack gap={2}>
                <Button colorPalette="teal" onClick={anchorAtDiscoveredIsland}>
                  Anchor at Island
                </Button>
                <Button onClick={abandonDiscoveredIsland}>Keep Sailing</Button>
              </HStack>
            </Box>
          ) : (
            <Box>
              <Text mb={4}>
                {activeEvent?.type === "hazard"
                  ? "Danger approaches quickly..."
                  : `Ye have encountered: ${activeEvent?.name}`}
              </Text>
              <Button
                colorPalette="blue"
                onClick={() => {
                  setGameState("home");
                  setDay(day + 1);
                  setActiveEvent(null);
                }}
              >
                Acknowledge
              </Button>
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
                                ? "gray.600"
                                : enemy.intent === "attack"
                                  ? "red.700"
                                  : "blue.700"
                            }
                          >
                            {slain ? "Slain" : formatEnemyIntentLabel(enemy.intent)}
                          </Text>
                          <Box
                            minH="1.25rem"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            w="100%"
                          >
                            {!slain && enemy.armor > 0 ? (
                              <Text fontSize="xs" textAlign="center" color="fg.muted">
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
                  <Text fontSize="xs" color="fg.muted">
                    {combatVictory
                      ? "Victory!"
                      : combatPhase === "player"
                        ? "Your turn - choose an action"
                        : "Enemy turn"}
                  </Text>
                ) : (
                  combatLog.map((entry, index) => {
                    const ageFromNewest = combatLog.length - 1 - index;
                    const entryStyle = getCombatLogEntryStyle(ageFromNewest);
                    return (
                      <Text
                        key={`${index}-${entry}`}
                        fontSize="xs"
                        lineHeight="short"
                        fontWeight={entryStyle.fontWeight}
                        color={entryStyle.color}
                      >
                        {entry}
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
                        color="fg.muted"
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
                              disabled={
                                !(isPlayerTurn && energy >= getCardEnergyCost(card))
                              }
                            />
                          ) : (
                            <CombatHandCard
                              card={card}
                              cost={getCardEnergyCost(card)}
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
                      color="fg.muted"
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
