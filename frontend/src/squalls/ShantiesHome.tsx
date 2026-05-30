import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import AdventureStripe from "./AdventureStripe";
import CharacterSheetModal from "./CharacterSheetModal";
import GameShell from "./GameShell";
import PlayerPanel from "./PlayerPanel";
import { getSceneKey, useSquallsSceneFade } from "./squallsSceneTransition";
import { setSquallsInGame } from "./squallsBreadcrumbBridge";
import { useFrozenSceneProps } from "./useFrozenSceneProps";
import { pickWorldPanelVisuals } from "./worldPanelVisuals";
import WorldPanel from "./WorldPanel";
import { useShantiesGame } from "./useShantiesGame";
import type { SquallsPlayIntent } from "./squallsPlayIntent";

type ShantiesHomeProps = {
  playIntent?: SquallsPlayIntent | null;
};

export default function ShantiesHome({ playIntent = null }: ShantiesHomeProps) {
  const navigate = useNavigate();
  const intentHandledRef = useRef(false);
  const game = useShantiesGame();
  const [characterSheetOpen, setCharacterSheetOpen] = useState(false);
  const sceneKey = getSceneKey(game.gameState, game.location);
  const sceneFade = useSquallsSceneFade(sceneKey);
  const shouldFreezeScene =
    sceneFade.scenePending || sceneFade.isTransitioning;

  const openCharacterSheet = () => setCharacterSheetOpen(true);

  const worldVisuals = useMemo(
    () =>
      pickWorldPanelVisuals({
        currentIsland: game.currentIsland,
        currentDungeon: game.currentDungeon,
        day: game.day,
        hero: game.hero,
        armor: game.armor,
        heroWeakened: game.heroWeakened,
        enemies: game.battlefieldEnemies,
        activeEvent: game.activeEvent,
        hand: game.hand,
        discardPile: game.discardPile,
        combatLog: game.combatLog,
        energy: game.energy,
        maxEnergy: game.maxEnergy,
        combatPhase: game.combatPhase,
        victoryPending: game.victoryPending,
        combatVictory: game.combatVictory,
        combatLoot: game.combatLoot,
        allCombatLootClaimed: game.allCombatLootClaimed,
        eventLoot: game.eventLoot,
        allEventLootClaimed: game.allEventLootClaimed,
        enemyActionMessage: game.enemyActionMessage,
        dungeonChestUnlocked: game.dungeonChestUnlocked,
        chestMessage: game.chestMessage,
        forceOpenAttempted: game.forceOpenAttempted,
        restComplete: game.restComplete,
        restMessage: game.restMessage,
        shopMessage: game.shopMessage,
        shopVariant: game.shopVariant,
      }),
    [
      game.currentIsland,
      game.currentDungeon,
      game.day,
      game.hero,
      game.armor,
      game.heroWeakened,
      game.battlefieldEnemies,
      game.activeEvent,
      game.hand,
      game.discardPile,
      game.combatLog,
      game.energy,
      game.maxEnergy,
      game.combatPhase,
      game.victoryPending,
      game.combatVictory,
      game.combatLoot,
      game.allCombatLootClaimed,
      game.eventLoot,
      game.allEventLootClaimed,
      game.enemyActionMessage,
      game.dungeonChestUnlocked,
      game.chestMessage,
      game.forceOpenAttempted,
      game.restComplete,
      game.restMessage,
      game.shopMessage,
      game.shopVariant,
    ],
  );

  const frozenWorldVisuals = useFrozenSceneProps({
    shouldFreeze: shouldFreezeScene,
    displayKey: sceneFade.displayKey,
    sceneKey,
    props: worldVisuals,
  });

  const playerVisuals = useMemo(
    () => ({
      hero: game.hero,
      armor: game.armor,
      weakened: game.heroWeakened,
    }),
    [game.hero, game.armor, game.heroWeakened],
  );

  const frozenPlayerVisuals = useFrozenSceneProps({
    shouldFreeze: shouldFreezeScene,
    displayKey: sceneFade.displayKey,
    sceneKey,
    props: playerVisuals,
  });

  useEffect(() => {
    if (intentHandledRef.current) return;

    if (playIntent?.restart) {
      intentHandledRef.current = true;
      game.restartAdventure();
      navigate("/squalls/play", { replace: true, state: null });
      return;
    }

    if (playIntent?.resume) {
      intentHandledRef.current = true;
      game.resumeAdventure();
      navigate("/squalls/play", { replace: true, state: null });
      return;
    }

    if (game.gameState === "lobby") {
      navigate("/squalls", { replace: true });
    }
  }, [
    playIntent,
    game.gameState,
    game.restartAdventure,
    game.resumeAdventure,
    navigate,
  ]);

  const leaveToSquallsLobby = useCallback(() => {
    game.goToLobby();
    setSquallsInGame(false);
    navigate("/squalls");
  }, [game.goToLobby, navigate]);

  const returnToSquallsLobby = useCallback(() => {
    game.resetToLobby();
    setSquallsInGame(false);
    navigate("/squalls");
  }, [game.resetToLobby, navigate]);

  useEffect(() => {
    setSquallsInGame(game.gameState !== "lobby");
    return () => setSquallsInGame(false);
  }, [game.gameState]);

  return (
    <>
      <GameShell
        targetGameState={game.gameState}
        targetLocation={game.location}
        displayGameState={sceneFade.gameState}
        displayLocation={sceneFade.location}
        sceneOpacity={sceneFade.opacity}
        sceneFadeMs={sceneFade.fadeMs}
        isTransitioning={sceneFade.isTransitioning}
        adventure={
          <AdventureStripe
            location={sceneFade.location}
            gameState={sceneFade.gameState}
            currentIsland={frozenWorldVisuals.currentIsland}
            currentDungeon={frozenWorldVisuals.currentDungeon}
            renderIslandName={game.renderIslandName}
            renderDungeonName={game.renderDungeonName}
          />
        }
        world={
          <WorldPanel
            gameState={sceneFade.gameState}
            setGameState={game.setGameState}
            location={sceneFade.location}
            setLocation={game.setLocation}
            renderIslandName={game.renderIslandName}
            renderPortTownName={game.renderPortTownName}
            setCurrentDungeon={game.setCurrentDungeon}
            renderDungeonName={game.renderDungeonName}
            enterCurrentDungeon={game.enterCurrentDungeon}
            returnToIslandFromDungeon={game.returnToIslandFromDungeon}
            resolveDungeonDiscovery={game.resolveDungeonDiscovery}
            setDay={game.setDay}
            setActiveEvent={game.setActiveEvent}
            claimCombatLoot={game.claimCombatLoot}
            claimEventLoot={game.claimEventLoot}
            completeTreasureEvent={game.completeTreasureEvent}
            acknowledgeGenericEvent={game.acknowledgeGenericEvent}
            acknowledgeWeatherEvent={game.acknowledgeWeatherEvent}
            abandonLockedDungeonChest={game.abandonLockedDungeonChest}
            unlockDungeonChestWithKey={game.unlockDungeonChestWithKey}
            pickLockOnChest={game.pickLockOnChest}
            forceOpenDungeonChest={game.forceOpenDungeonChest}
            dismissCombatVictory={game.dismissCombatVictory}
            handleSailOrExplore={game.handleSailOrExplore}
            startSailFromShip={game.startSailFromShip}
            returnToShipFromIsland={game.returnToShipFromIsland}
            anchorAtDiscoveredIsland={game.anchorAtDiscoveredIsland}
            abandonDiscoveredIsland={game.abandonDiscoveredIsland}
            dockAtPortTown={game.dockAtPortTown}
            sailPastPortTown={game.sailPastPortTown}
            playCombatCard={game.playCombatCard}
            endPlayerTurn={game.endPlayerTurn}
            resetToLobby={returnToSquallsLobby}
            goToLobby={leaveToSquallsLobby}
            healHero={game.healHero}
            openRest={game.openRest}
            wakeFromRest={game.wakeFromRest}
            leaveRest={game.leaveRest}
            openCookstove={game.openCookstove}
            leaveCookstove={game.leaveCookstove}
            cookAtStove={game.cookAtStove}
            dismissCookstoveEncounter={game.dismissCookstoveEncounter}
            cookMessage={game.cookMessage}
            buyShopItem={game.buyShopItem}
            sellShopItem={game.sellShopItem}
            sellShopEquipment={game.sellShopEquipment}
            leaveShop={game.leaveShop}
            openShipShop={game.openShipShop}
            openMerchantShop={game.openMerchantShop}
            openIslandTraderShop={game.openIslandTraderShop}
            openPortShop={game.openPortShop}
            openShipwright={game.openShipwright}
            openTavern={game.openTavern}
            leavePort={game.leavePort}
            returnToPort={game.returnToPort}
            nearPortTown={game.nearPortTown}
            leaveTavern={game.leaveTavern}
            leaveShipwright={game.leaveShipwright}
            tavernMessage={game.tavernMessage}
            buyTavernCard={game.buyTavernCard}
            refineTavernCard={game.refineTavernCard}
            exploreTestContext={game.exploreTestContext}
            exploreTestOptions={game.exploreTestOptions}
            applyExploreTestOutcome={game.applyExploreTestOutcome}
            cancelExploreTest={game.cancelExploreTest}
            resolveShipwreckDive={game.resolveShipwreckDive}
            onOpenCharacterSheet={openCharacterSheet}
            currentPortTown={game.currentPortTown}
            {...frozenWorldVisuals}
          />
        }
        player={
          <PlayerPanel
            hero={frozenPlayerVisuals.hero}
            gameState={sceneFade.gameState}
            armor={frozenPlayerVisuals.armor}
            weakened={frozenPlayerVisuals.weakened}
            onOpenCharacterSheet={openCharacterSheet}
          />
        }
      />
      <CharacterSheetModal
        open={characterSheetOpen}
        onOpenChange={setCharacterSheetOpen}
        hero={game.hero}
        day={game.day}
        gameState={game.gameState}
        combatPhase={game.combatPhase}
        energy={game.energy}
        victoryPending={game.victoryPending}
        combatVictory={game.combatVictory}
        armor={game.armor}
        currentIndoorArea={game.currentIndoorArea}
        illuminatedAreas={game.illuminatedAreas}
        itemMessage={game.itemMessage}
        onUseItem={game.useItem}
        onClearItemMessage={game.clearItemMessage}
        onEquipmentChange={game.updateHeroEquipment}
      />
    </>
  );
}
