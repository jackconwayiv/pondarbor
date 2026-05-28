import { useEffect, useMemo, useState } from "react";

import AdventureStripe from "./AdventureStripe";
import CharacterSheetModal from "./CharacterSheetModal";
import GameShell from "./GameShell";
import PlayerPanel from "./PlayerPanel";
import { getSceneKey, useSquallsSceneFade } from "./squallsSceneTransition";
import { setSquallsInGame } from "./squallsBreadcrumbBridge";
import { useFrozenSceneProps } from "./useFrozenSceneProps";
import WorldPanel from "./WorldPanel";
import { useShantiesGame } from "./useShantiesGame";

export default function ShantiesHome() {
  const game = useShantiesGame();
  const [characterSheetOpen, setCharacterSheetOpen] = useState(false);
  const sceneKey = getSceneKey(game.gameState, game.location);
  const sceneFade = useSquallsSceneFade(sceneKey);
  const shouldFreezeScene =
    sceneFade.scenePending || sceneFade.isTransitioning;

  const openCharacterSheet = () => setCharacterSheetOpen(true);

  const worldVisuals = useMemo(
    () => ({
      currentIsland: game.currentIsland,
      currentDungeon: game.currentDungeon,
      day: game.day,
      hero: game.hero,
      armor: game.armor,
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
      canResumeAdventure: game.canResumeAdventure,
      lobbySaveSummaryLines: game.lobbySaveSummaryLines,
      lobbySavedAtLabel: game.lobbySavedAtLabel,
      illuminatedAreas: game.illuminatedAreas,
      currentIndoorArea: game.currentIndoorArea,
    }),
    [
      game.currentIsland,
      game.currentDungeon,
      game.day,
      game.hero,
      game.armor,
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
      game.allEventLootClaimed,
      game.eventLoot,
      game.allCombatLootClaimed,
      game.enemyActionMessage,
      game.canResumeAdventure,
      game.lobbySaveSummaryLines,
      game.lobbySavedAtLabel,
      game.illuminatedAreas,
      game.currentIndoorArea,
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
    }),
    [game.hero, game.armor],
  );

  const frozenPlayerVisuals = useFrozenSceneProps({
    shouldFreeze: shouldFreezeScene,
    displayKey: sceneFade.displayKey,
    sceneKey,
    props: playerVisuals,
  });

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
            day={frozenWorldVisuals.day}
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
            abandonLockedDungeonChest={game.abandonLockedDungeonChest}
            unlockDungeonChestWithKey={game.unlockDungeonChestWithKey}
            forceOpenDungeonChest={game.forceOpenDungeonChest}
            dungeonChestUnlocked={game.dungeonChestUnlocked}
            chestMessage={game.chestMessage}
            dismissCombatVictory={game.dismissCombatVictory}
            handleSailOrExplore={game.handleSailOrExplore}
            startSailFromShip={game.startSailFromShip}
            returnToShipFromIsland={game.returnToShipFromIsland}
            anchorAtDiscoveredIsland={game.anchorAtDiscoveredIsland}
            abandonDiscoveredIsland={game.abandonDiscoveredIsland}
            playCombatCard={game.playCombatCard}
            endPlayerTurn={game.endPlayerTurn}
            resetToLobby={game.resetToLobby}
            goToLobby={game.goToLobby}
            resumeAdventure={game.resumeAdventure}
            restartAdventure={game.restartAdventure}
            healHero={game.healHero}
            leaveRest={game.leaveRest}
            restMessage={game.restMessage}
            shopMessage={game.shopMessage}
            buyShopItem={game.buyShopItem}
            sellShopItem={game.sellShopItem}
            sellShopEquipment={game.sellShopEquipment}
            leaveShop={game.leaveShop}
            onOpenCharacterSheet={openCharacterSheet}
            {...frozenWorldVisuals}
          />
        }
        player={
          <PlayerPanel
            hero={frozenPlayerVisuals.hero}
            gameState={sceneFade.gameState}
            armor={frozenPlayerVisuals.armor}
            onOpenCharacterSheet={openCharacterSheet}
          />
        }
      />
      <CharacterSheetModal
        open={characterSheetOpen}
        onOpenChange={setCharacterSheetOpen}
        hero={game.hero}
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
