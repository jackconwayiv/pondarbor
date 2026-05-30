import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  allLootClaimed,
  generateCombatLoot,
  generateEventLoot,
  isTreasureEvent,
  applyLootClaim,
} from "./combatLoot";
import {
  executeEnemyAction,
  formatEnemyBroadcastLabel,
  initializeEnemyActionDeck,
} from "./enemyActions";
import {
  appendCombatLog,
  clampHp,
  combatLogLine,
  CARDS_DRAWN_PER_TURN,
  drawFromPiles,
  getCardEnergyCost,
  MAX_ENERGY_PER_TURN,
  countLivingEnemies,
  findNextLivingEnemyIndex,
  isEnemyAlive,
  setupCombatDeck,
  spawnEnemy,
} from "./combatRules";
import {
  applyBuyItem,
  applyFoodUse,
  applySellItem,
  addItemToInventory,
  checkBuyItem,
  checkSellItem,
  checkUseItem,
  getItemEnergyCost,
  rollFoodHealAmount,
  getItemCount,
  formatIndoorAreaLabel,
  isFoodItem,
  ITEM_DEFINITIONS,
  removeItemFromInventory,
} from "./shantiesItems";
import type {
  CombatCard,
  CombatLootItem,
  CombatLogEntry,
  CombatPhase,
  EnemyType,
  EventType,
  GameLocationTypes,
  GameStateTypes,
  HeroType,
  IndoorAreaId,
  DungeonType,
  IslandType,
  ItemId,
  PortTownType,
  ShopVariant,
  WreckUnlockItemId,
} from "./shantiesTypes";
import {
  clearShantiesSave,
  createDefaultSaveData,
  createInitialHero,
  readShantiesSave,
  writeShantiesSave,
} from "./shantiesLocalSave";
import {
  generateDungeon,
  isDepletedDungeon,
  isIslandDungeonKind,
  renderDungeonName,
} from "./dungeonExplore";
import { buildSeaEventDeck, drawSeaEvent } from "./seaEventDeck";
import {
  applySellEquipment,
  breakEquippedLockpick,
  addEquipmentToBag,
  checkSellEquipment,
  EQUIPMENT_DEFINITIONS,
  heroHasLockpickEquipped,
} from "./shantiesEquipment";
import {
  applyRest,
  checkRest,
} from "./shantiesRest";
import {
  generateFloatingSuppliesLoot,
  isSeaTreasureEvent,
  isSeaTreasureTemplate,
  prepareSeaTreasureEvent,
} from "./floatingSuppliesLoot";
import {
  drawIslandEvent,
  ensureIslandEventDeck,
} from "./islandEventDeck";
import {
  generateIslandTreasureLoot,
  isIslandTreasureEvent,
  prepareIslandTreasureEvent,
} from "./islandTreasureLoot";
import {
  FORCE_OPEN_FAIL_MESSAGE,
  PICK_LOCK_FAIL_BROKEN_MESSAGE,
  PICK_LOCK_SUCCESS_BROKEN_MESSAGE,
  prepareDungeonTreasureEvent,
  rollForceOpenChest,
  rollPickLock,
} from "./dungeonTreasure";
import {
  applyEncounterDrawPenalty,
  createEmptyScopedEncounterModifiers,
  type EncounterScope,
  type ScopedEncounterModifiers,
} from "./encounterProbability";
import { applySeaWeatherToHero } from "./seaWeather";
import { formatIslandDisplayName } from "./shantiesSaveSummary";
import {
  applyCookAtStove,
  canCookAtStove,
  formatCookResultMessage,
} from "./cookstove";
import { isPortTownEvent } from "./portEvents";
import {
  generatePortTown,
  renderPortTownName,
} from "./portTowns";
import { shopAllowsSelling } from "./shantiesShop";
import {
  encounterPoolScopeForDungeonKind,
  getIslandDungeonBossName,
  getMonsterTemplate,
  pickEncounterMonsterNames,
  type IslandDungeonBossKind,
  type EncounterPoolScope,
} from "./monsters";
import {
  applyBuyTavernCard,
  applyRefineTavernCard,
  checkBuyTavernCard,
  checkRefineTavernCard,
  applyLevelUpCardPick,
  levelUpChoicesAsCombatCards,
  rollLevelUpCardChoices,
} from "./tavernCards";
import {
  findExploreTestOption,
  getExploreTestOptions,
  type ExploreTestContext,
} from "./exploreTestPicker";
import {
  cardRequiresAmmo,
  isAttackCard,
  targetsAllEnemiesAutomatically,
  targetsEnemyManually,
  targetsSelfAutomatically,
} from "./shantiesTypes";
import {
  applyAllEnemiesAttack,
  applyMeleeAttackToEnemyIndex,
  applyRangedAttackToEnemyIndex,
  applySelfDefendCard,
} from "./combatPlayHelpers";
import { isDeckValid } from "./deckValidation";
import { type CardId } from "./squallsCardCatalog";
import { CARD_CATALOG } from "./squallsCardCatalog";
import { heroLevelFromXp } from "./squallsXpProgression";
import {
  resolveEncounterBaseLevel,
  rollEncounterLevel,
  type EncounterLevelContext,
} from "./squallsEncounterLevel";
import { scaleMonsterStats } from "./squallsMonsterScaling";
import { maxHpForLevel } from "./squallsHeroProgression";

function encounterScopeForLocation(
  location: GameLocationTypes,
): EncounterScope {
  if (location === "ship") return "sail";
  if (location === "island") return "island";
  return "dungeon";
}

const VICTORY_DELAY_MS = 1800;

function spawnRegistryMonster(
  name: string,
  level: number,
  isBoss = false,
): EnemyType {
  const template = getMonsterTemplate(name);
  if (!template) {
    return spawnEnemy({ name, level, hp: 7, isBoss });
  }
  const scaled = scaleMonsterStats(template, level);
  return spawnEnemy({
    name,
    level,
    hp: scaled.hp,
    damageMin: scaled.damageMin,
    damageMax: scaled.damageMax,
    traits: template.traits,
    armor: scaled.armor,
    isBoss: isBoss || template.isBoss === true,
  });
}

function spawnEncounter(
  scope: EncounterPoolScope,
  context: EncounterLevelContext,
): EnemyType[] {
  return pickEncounterMonsterNames(scope).map((name) => {
    const baseLevel = resolveEncounterBaseLevel({ ...context, scope });
    const rolledLevel = rollEncounterLevel(baseLevel);
    return spawnRegistryMonster(name, rolledLevel);
  });
}

function spawnBossEncounter(
  kind: IslandDungeonBossKind,
  context: EncounterLevelContext,
): EnemyType[] {
  const bossName = getIslandDungeonBossName(kind);
  const baseLevel = resolveEncounterBaseLevel({ ...context, scope: "islandDungeon" });
  const rolledLevel = rollEncounterLevel(baseLevel);
  return [spawnRegistryMonster(bossName, rolledLevel, true)];
}

function loadPersistedSave() {
  return readShantiesSave() ?? createDefaultSaveData();
}

export function useShantiesGame() {
  const [initialSave] = useState(loadPersistedSave);

  const [gameState, setGameState] = useState<GameStateTypes>(
    initialSave.gameState,
  );
  const [location, setLocation] = useState<GameLocationTypes>(
    initialSave.location,
  );
  const [currentIsland, setCurrentIsland] = useState<IslandType | null>(
    initialSave.currentIsland,
  );
  const [currentPortTown, setCurrentPortTown] = useState<PortTownType | null>(
    initialSave.currentPortTown,
  );
  const [currentDungeon, setCurrentDungeon] = useState<DungeonType | null>(
    initialSave.currentDungeon,
  );
  const [enemies, setEnemies] = useState<EnemyType[]>(initialSave.enemies);
  const [activeEvent, setActiveEvent] = useState<EventType | null>(
    initialSave.activeEvent,
  );
  const [day, setDay] = useState(initialSave.day);
  const [hand, setHand] = useState<CombatCard[]>(initialSave.hand);
  const [drawPile, setDrawPile] = useState<CombatCard[]>(initialSave.drawPile);
  const [discardPile, setDiscardPile] = useState<CombatCard[]>(
    initialSave.discardPile,
  );
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>(initialSave.combatLog);
  const [armor, setArmor] = useState(initialSave.armor);
  const [heroWeakened, setHeroWeakened] = useState(initialSave.heroWeakened);
  const [energy, setEnergy] = useState(initialSave.energy);
  const [combatPhase, setCombatPhase] = useState<CombatPhase>(
    initialSave.combatPhase,
  );
  const [enemyTurnIndex, setEnemyTurnIndex] = useState<number | null>(
    initialSave.enemyTurnIndex,
  );
  const [enemyActionMessage, setEnemyActionMessage] = useState<string | null>(
    null,
  );
  const [victoryPending, setVictoryPending] = useState(false);
  const [combatVictory, setCombatVictory] = useState(initialSave.combatVictory);
  const [victoryEnemies, setVictoryEnemies] = useState<EnemyType[]>(
    initialSave.victoryEnemies,
  );
  const [combatLoot, setCombatLoot] = useState(initialSave.combatLoot);
  const [eventLoot, setEventLoot] = useState(initialSave.eventLoot);
  const [resumeGameState, setResumeGameState] = useState<GameStateTypes | null>(
    initialSave.resumeGameState,
  );
  const [hero, setHero] = useState<HeroType>(initialSave.hero);
  const [illuminatedAreas, setIlluminatedAreas] = useState<IndoorAreaId[]>(
    initialSave.illuminatedAreas,
  );
  const [currentIndoorArea, setCurrentIndoorArea] = useState<IndoorAreaId | null>(
    initialSave.currentIndoorArea,
  );
  const [itemMessage, setItemMessage] = useState<string | null>(null);
  const [shopMessage, setShopMessage] = useState<string | null>(null);
  const [tavernMessage, setTavernMessage] = useState<string | null>(null);
  const [restMessage, setRestMessage] = useState<string | null>(null);
  const [restComplete, setRestComplete] = useState(false);
  const [cookMessage, setCookMessage] = useState<string | null>(null);
  const [encounterModifiers, setEncounterModifiers] =
    useState<ScopedEncounterModifiers>(
      initialSave.encounterModifiers ?? createEmptyScopedEncounterModifiers(),
    );
  const [dungeonChestUnlocked, setDungeonChestUnlocked] = useState(
    initialSave.dungeonChestUnlocked ?? false,
  );
  const [seaEventDeck, setSeaEventDeck] = useState<EventType[]>(
    initialSave.seaEventDeck,
  );
  const [shopVariant, setShopVariant] = useState<ShopVariant | null>(
    initialSave.shopVariant,
  );
  const [nearPortTown, setNearPortTown] = useState(initialSave.nearPortTown);
  const [exploreTestContext, setExploreTestContext] =
    useState<ExploreTestContext | null>(null);
  const [levelUpPicksRemaining, setLevelUpPicksRemaining] = useState(
    initialSave.levelUpPicksRemaining ?? 0,
  );
  const [levelUpCardChoiceIds, setLevelUpCardChoiceIds] = useState<CardId[]>(
    initialSave.levelUpCardChoices ?? [],
  );
  const [heroEvasiveStacks, setHeroEvasiveStacks] = useState(0);
  const [characterSheetRequest, setCharacterSheetRequest] = useState<
    { tab: "deck" } | null
  >(null);
  const [chestMessage, setChestMessage] = useState<string | null>(null);
  const [forceOpenAttempted, setForceOpenAttempted] = useState(false);

  const clearChestInteraction = useCallback(() => {
    setChestMessage(null);
    setForceOpenAttempted(false);
  }, []);

  const resetEncounterModifiers = useCallback((scope: EncounterScope) => {
    setEncounterModifiers((prev) => ({ ...prev, [scope]: {} }));
  }, []);

  const resetAllEncounterModifiers = useCallback(() => {
    setEncounterModifiers(createEmptyScopedEncounterModifiers());
  }, []);

  const battlefieldEnemies =
    victoryEnemies.length > 0 ? victoryEnemies : enemies;

  const exploreTestOptions = useMemo(
    () =>
      exploreTestContext
        ? getExploreTestOptions(exploreTestContext, {
            seaEventDeck,
            currentIsland,
            dungeonModifiers: encounterModifiers.dungeon,
          })
        : [],
    [exploreTestContext, seaEventDeck, currentIsland, encounterModifiers.dungeon],
  );

  const heroRef = useRef(hero);
  const levelUpPicksRemainingRef = useRef(levelUpPicksRemaining);
  const resumeGameStateRef = useRef(resumeGameState);
  const armorRef = useRef(armor);
  const heroWeakenedRef = useRef(heroWeakened);
  const heroEvasiveStacksRef = useRef(heroEvasiveStacks);
  const enemiesRef = useRef(enemies);
  const drawPileRef = useRef(drawPile);
  const discardPileRef = useRef(discardPile);
  const victoryTimerRef = useRef<number | null>(null);
  const victoryPendingRef = useRef(false);
  /** Bumped when an enemy-turn effect cleans up so stale timers cannot act twice. */
  const enemyTurnRunRef = useRef(0);
  const combatAmmoSpentRef = useRef(0);
  const combatLootRef = useRef(combatLoot);
  const eventLootRef = useRef(eventLoot);
  const startPlayerTurnRef = useRef<() => void>(() => {});

  const levelUpCardChoices = useMemo(
    () => levelUpChoicesAsCombatCards(levelUpCardChoiceIds),
    [levelUpCardChoiceIds],
  );

  const requestCharacterSheetDeck = useCallback(() => {
    setCharacterSheetRequest({ tab: "deck" });
  }, []);

  const clearCharacterSheetRequest = useCallback(() => {
    setCharacterSheetRequest(null);
  }, []);

  const openLevelUpMenu = useCallback(() => {
    setLevelUpCardChoiceIds(rollLevelUpCardChoices(heroRef.current));
    setGameState("levelUp");
  }, []);

  const queueLevelUpPicks = useCallback(
    (count: number) => {
      if (count <= 0) return;
      setLevelUpPicksRemaining((prev) => prev + count);
      if (gameState !== "levelUp" && gameState !== "battle") {
        setResumeGameState((prev) => prev ?? gameState);
        openLevelUpMenu();
      }
    },
    [gameState, openLevelUpMenu],
  );

  const cancelVictoryDelay = useCallback(() => {
    if (victoryTimerRef.current !== null) {
      window.clearTimeout(victoryTimerRef.current);
      victoryTimerRef.current = null;
    }
    victoryPendingRef.current = false;
    setVictoryPending(false);
  }, []);

  useEffect(() => {
    return () => cancelVictoryDelay();
  }, [cancelVictoryDelay]);

  useEffect(() => {
    heroRef.current = hero;
  }, [hero]);
  useEffect(() => {
    levelUpPicksRemainingRef.current = levelUpPicksRemaining;
  }, [levelUpPicksRemaining]);
  useEffect(() => {
    resumeGameStateRef.current = resumeGameState;
  }, [resumeGameState]);
  useEffect(() => {
    armorRef.current = armor;
  }, [armor]);
  useEffect(() => {
    heroWeakenedRef.current = heroWeakened;
  }, [heroWeakened]);
  useEffect(() => {
    heroEvasiveStacksRef.current = heroEvasiveStacks;
  }, [heroEvasiveStacks]);
  useEffect(() => {
    enemiesRef.current = enemies;
  }, [enemies]);
  useEffect(() => {
    drawPileRef.current = drawPile;
  }, [drawPile]);
  useEffect(() => {
    discardPileRef.current = discardPile;
  }, [discardPile]);
  useEffect(() => {
    combatLootRef.current = combatLoot;
  }, [combatLoot]);
  useEffect(() => {
    eventLootRef.current = eventLoot;
  }, [eventLoot]);

  useEffect(() => {
    if (levelUpPicksRemaining <= 0 || gameState === "levelUp") return;
    if (gameState === "battle") return;
    setResumeGameState((prev) => prev ?? gameState);
    openLevelUpMenu();
  }, [
    gameState,
    levelUpPicksRemaining,
    openLevelUpMenu,
  ]);

  useEffect(() => {
    if (
      gameState === "levelUp" &&
      levelUpPicksRemaining > 0 &&
      levelUpCardChoiceIds.length === 0
    ) {
      setLevelUpCardChoiceIds(rollLevelUpCardChoices(heroRef.current));
    }
  }, [gameState, levelUpCardChoiceIds.length, levelUpPicksRemaining]);

  useEffect(() => {
    writeShantiesSave({
      gameState,
      location,
      currentIsland,
      currentPortTown,
      currentDungeon,
      day,
      hero,
      enemies,
      activeEvent,
      hand,
      drawPile,
      discardPile,
      combatLog,
      armor,
      heroWeakened,
      energy,
      combatPhase,
      enemyTurnIndex,
      combatVictory,
      victoryEnemies,
      combatLoot,
      eventLoot,
      resumeGameState,
      illuminatedAreas,
      currentIndoorArea,
      encounterModifiers,
      dungeonChestUnlocked,
      seaEventDeck,
      shopVariant,
      nearPortTown,
      levelUpPicksRemaining,
      levelUpCardChoices: levelUpCardChoiceIds,
    });
  }, [
    gameState,
    location,
    currentIsland,
    currentPortTown,
    currentDungeon,
    day,
    hero,
    enemies,
    activeEvent,
    hand,
    drawPile,
    discardPile,
    combatLog,
    armor,
    heroWeakened,
    energy,
    combatPhase,
    enemyTurnIndex,
    combatVictory,
    victoryEnemies,
    combatLoot,
    eventLoot,
    resumeGameState,
    illuminatedAreas,
    currentIndoorArea,
    encounterModifiers,
    dungeonChestUnlocked,
    seaEventDeck,
    shopVariant,
    nearPortTown,
    levelUpPicksRemaining,
    levelUpCardChoiceIds,
  ]);

  const grantLootItem = useCallback((item: CombatLootItem) => {
    if (item.kind === "gold") {
      setHero((h) => ({ ...h, gold: h.gold + item.amount }));
      return;
    }
    if (item.kind === "xp") {
      setHero((h) => {
        const nextXp = h.xp + item.amount;
        const nextLevel = heroLevelFromXp(nextXp);
        const gained = Math.max(0, nextLevel - h.level);
        if (gained > 0) {
          queueLevelUpPicks(gained);
        }
        const nextMaxHp = maxHpForLevel(nextLevel);
        const hpGain = gained * 5;
        const nextCurrentHp = Math.min(nextMaxHp, h.current_hp + hpGain);
        return {
          ...h,
          xp: nextXp,
          level: nextLevel,
          max_hp: nextMaxHp,
          current_hp: nextCurrentHp,
        };
      });
      return;
    }
    if (item.kind === "item" && item.itemId) {
      setHero((h) => ({
        ...h,
        inventory: addItemToInventory(
          h.inventory,
          item.itemId!,
          Math.max(1, item.amount),
        ),
      }));
      return;
    }
    if (item.kind === "equipment" && item.equipmentId) {
      setHero((h) => addEquipmentToBag(h, item.equipmentId!));
    }
  }, [queueLevelUpPicks]);

  const drawCardsForTurn = useCallback(() => {
    const result = drawFromPiles(
      drawPileRef.current,
      discardPileRef.current,
      CARDS_DRAWN_PER_TURN,
    );
    drawPileRef.current = result.drawPile;
    discardPileRef.current = result.discardPile;
    setDrawPile(result.drawPile);
    setDiscardPile(result.discardPile);
    setHand(result.drawn);
  }, []);

  const resetCombatState = useCallback(() => {
    cancelVictoryDelay();
    combatAmmoSpentRef.current = 0;
    setHand([]);
    setDrawPile([]);
    setDiscardPile([]);
    setCombatLog([]);
    setArmor(0);
    setHeroWeakened(false);
    setHeroEvasiveStacks(0);
    setEnergy(MAX_ENERGY_PER_TURN);
    setCombatPhase("player");
    setEnemyTurnIndex(null);
    setEnemyActionMessage(null);
  }, [cancelVictoryDelay]);

  const beginCombat = useCallback((sourceDeck: readonly CardId[]) => {
    cancelVictoryDelay();
    combatAmmoSpentRef.current = 0;
    setCombatVictory(false);
    setVictoryEnemies([]);
    setCombatLoot([]);
    const { drawPile: pile, discardPile: discard, hand: openingHand } =
      setupCombatDeck([...sourceDeck]);

    drawPileRef.current = pile;
    discardPileRef.current = discard;
    setDrawPile(pile);
    setDiscardPile(discard);
    setHand(openingHand);
    setArmor(0);
    setHeroWeakened(false);
    setHeroEvasiveStacks(0);
    setEnergy(MAX_ENERGY_PER_TURN);
    setCombatPhase("player");
    setEnemyTurnIndex(null);
    setEnemyActionMessage(null);
    setCombatLog([]);
    setEnemies((prev) => prev.map(initializeEnemyActionDeck));
  }, [cancelVictoryDelay]);

  const startPlayerTurn = useCallback(() => {
    setCombatPhase("player");
    armorRef.current = 0;
    setArmor(0);
    setEnergy(MAX_ENERGY_PER_TURN);
    setEnemyTurnIndex(null);
    setEnemyActionMessage(null);
    drawCardsForTurn();
  }, [drawCardsForTurn]);

  startPlayerTurnRef.current = startPlayerTurn;

  const generateIsland = useCallback((): IslandType => {
    const weatherList = [
      "Foggy",
      "Stony",
      "Rocky",
      "Sandy",
      "Damp",
      "Jungle",
      "Misty",
      "Lonely",
      "Sunny",
      "Steep",
      "Craggy",
      "Rainy",
      "Drizzly",
      "Blustery",
    ];
    const isleList = [
      "Island",
      "Cove",
      "Inlet",
      "Isle",
      "Islet",
      "Bay",
      "Cay",
      "Shoals",
      "Strand",
      "Atoll",
      "Cape",
      "Peninsula",
    ];
    const attributeList = [
      "Cliffs",
      "Brine",
      "Howling Wind",
      "Blossoms",
      "Wreckage",
      "Petroglyphs",
      "Falls",
      "Seafarers",
      "Stars",
      "Coral",
    ];

    const roll = Math.random();
    let vibe: IslandType["vibe"] = null;
    if (roll < 0.15) vibe = "Foreboding";
    else if (roll < 0.3) vibe = "Inviting";

    const sizeRoll = Math.random();
    let size: IslandType["size"] = null;
    if (sizeRoll < 0.3) size = "Small";
    else if (sizeRoll < 0.6) size = "Large";

    const explorePoints = 0;

    let levelFactor = 0;
    if (vibe === "Foreboding") levelFactor += 1;
    if (vibe === "Inviting") levelFactor -= 1;

    const name = `${weatherList[Math.floor(Math.random() * weatherList.length)]} ${
      isleList[Math.floor(Math.random() * isleList.length)]
    } of ${attributeList[Math.floor(Math.random() * attributeList.length)]}`;

    return { name, size, explorePoints, levelFactor, vibe };
  }, []);

  const renderIslandName = useCallback(
    (island: IslandType) => formatIslandDisplayName(island),
    [],
  );

  const renderPortTownNameStable = useCallback(
    (port: PortTownType) => renderPortTownName(port),
    [],
  );

  const renderDungeonNameStable = useCallback(
    (dungeon: DungeonType) => renderDungeonName(dungeon),
    [],
  );

  const goToLobby = useCallback(() => {
    if (gameState !== "lobby") {
      setResumeGameState(gameState);
    }
    setGameState("lobby");
  }, [gameState]);

  const resumeAdventure = useCallback(() => {
    const target = resumeGameState ?? "home";
    setResumeGameState(null);
    setGameState(target === "lobby" ? "home" : target);
  }, [resumeGameState]);

  const restartAdventure = useCallback(() => {
    cancelVictoryDelay();
    clearShantiesSave();
    setLocation("ship");
    setCurrentIsland(null);
    setCurrentPortTown(null);
    setCurrentDungeon(null);
    setEnemies([]);
    setVictoryEnemies([]);
    setCombatLoot([]);
    setEventLoot([]);
    setActiveEvent(null);
    setResumeGameState(null);
    setDay(1);
    setHero(createInitialHero());
    setIlluminatedAreas([]);
    setCurrentIndoorArea(null);
    setItemMessage(null);
    setDungeonChestUnlocked(false);
    clearChestInteraction();
    resetAllEncounterModifiers();
    setSeaEventDeck(buildSeaEventDeck());
    setShopVariant(null);
    setNearPortTown(false);
    setLevelUpPicksRemaining(0);
    setLevelUpCardChoiceIds([]);
    resetCombatState();
    setCombatVictory(false);
    setGameState("home");
  }, [cancelVictoryDelay, resetAllEncounterModifiers, resetCombatState]);

  const initiateBattle = useCallback(() => {
    setEnemies(
      spawnEncounter("sea", {
        heroLevel: hero.level,
        scope: "sea",
        island: currentIsland,
        dungeon: currentDungeon,
      }),
    );
    beginCombat([...hero.deck]);
    setGameState("battle");
  }, [beginCombat, currentDungeon, currentIsland, hero.deck, hero.level]);

  const initiateIslandBattle = useCallback(() => {
    setEnemies(
      spawnEncounter("island", {
        heroLevel: hero.level,
        scope: "island",
        island: currentIsland,
        dungeon: currentDungeon,
      }),
    );
    beginCombat([...hero.deck]);
    setGameState("battle");
  }, [beginCombat, currentDungeon, currentIsland, hero.deck, hero.level]);

  const initiateDungeonBattle = useCallback(() => {
    if (currentDungeon && isIslandDungeonKind(currentDungeon.kind) && currentDungeon.delvePoints === 1) {
      setEnemies(
        spawnBossEncounter(currentDungeon.kind as IslandDungeonBossKind, {
          heroLevel: hero.level,
          scope: "islandDungeon",
          island: currentIsland,
          dungeon: currentDungeon,
        }),
      );
    } else {
      setEnemies(
        spawnEncounter(encounterPoolScopeForDungeonKind(currentDungeon?.kind), {
          heroLevel: hero.level,
          scope: currentDungeon?.kind === "wreck" ? "wreck" : "islandDungeon",
          island: currentIsland,
          dungeon: currentDungeon,
        }),
      );
    }
    beginCombat([...hero.deck]);
    setGameState("battle");
  }, [beginCombat, currentDungeon, currentIsland, hero.deck, hero.level]);

  const enterCurrentDungeon = useCallback(() => {
    if (!currentDungeon || isDepletedDungeon(currentDungeon)) return;
    let dungeon = currentDungeon;
    if (isIslandDungeonKind(dungeon.kind) && !dungeon.candleUnlocked) {
      if (getItemCount(hero.inventory, "candle") <= 0) {
        setItemMessage("Ye need a candle to explore the dark interior.");
        return;
      }
      setHero((h) => ({
        ...h,
        inventory: removeItemFromInventory(h.inventory, "candle"),
      }));
      dungeon = { ...dungeon, candleUnlocked: true };
      setCurrentDungeon(dungeon);
    }
    setLocation("dungeon");
    setCurrentIndoorArea(dungeon.areaId);
    setGameState("home");
  }, [currentDungeon, hero.inventory]);

  const returnToIslandFromDungeon = useCallback(() => {
    if (currentDungeon?.kind === "wreck") {
      setLocation("ship");
    } else {
      setLocation("island");
      if (currentDungeon && isDepletedDungeon(currentDungeon)) {
        setCurrentDungeon(null);
      }
    }
    setCurrentIndoorArea(null);
    setGameState("home");
  }, [currentDungeon]);

  const returnToShipFromIsland = useCallback(() => {
    resetEncounterModifiers("island");
    setSeaEventDeck(buildSeaEventDeck());
    setLocation("ship");
    setGameState("home");
  }, [resetEncounterModifiers]);

  const anchorAtDiscoveredIsland = useCallback(() => {
    resetEncounterModifiers("sail");
    setCurrentIsland((prev) => (prev ? ensureIslandEventDeck(prev) : prev));
    setLocation("island");
    setGameState("home");
    setActiveEvent(null);
    setDay((d) => d + 1);
  }, [resetEncounterModifiers]);

  const abandonDiscoveredIsland = useCallback(() => {
    setCurrentIsland(null);
    setSeaEventDeck(buildSeaEventDeck());
    setGameState("home");
    setActiveEvent(null);
    setDay((d) => d + 1);
  }, []);

  const dockAtPortTown = useCallback(() => {
    setNearPortTown(true);
    setLocation("port");
    setGameState("home");
    setActiveEvent(null);
    setDay((d) => d + 1);
  }, []);

  const sailPastPortTown = useCallback(() => {
    setCurrentPortTown(null);
    setNearPortTown(false);
    setSeaEventDeck(buildSeaEventDeck());
    setGameState("home");
    setActiveEvent(null);
    setDay((d) => d + 1);
  }, []);

  const resolveDungeonDiscovery = useCallback(
    (enterNow: boolean) => {
      const kind = activeEvent?.dungeonKind;
      if (!kind || kind === "wreck") return;
      setActiveEvent(null);
      setEventLoot([]);
      setDay((d) => d + 1);
      if (enterNow && getItemCount(hero.inventory, "candle") > 0) {
        const dungeon = generateDungeon(kind, currentIsland);
        resetEncounterModifiers("dungeon");
        setHero((h) => ({
          ...h,
          inventory: removeItemFromInventory(h.inventory, "candle"),
        }));
        const unlocked = { ...dungeon, candleUnlocked: true };
        setCurrentDungeon(unlocked);
        setLocation("dungeon");
        setCurrentIndoorArea(unlocked.areaId);
      }
      setGameState("home");
    },
    [activeEvent?.dungeonKind, currentIsland, hero.inventory, resetEncounterModifiers],
  );

  const resolveShipwreckDive = useCallback(
    (choice: "sail_past" | WreckUnlockItemId) => {
      if (choice === "sail_past") {
        setActiveEvent(null);
        setGameState("home");
        setDay((d) => d + 1);
        return;
      }
      if (getItemCount(hero.inventory, choice) <= 0) return;
      const dungeon = generateDungeon("wreck", currentIsland);
      setHero((h) => ({
        ...h,
        inventory: removeItemFromInventory(h.inventory, choice),
      }));
      setCurrentDungeon(dungeon);
      resetEncounterModifiers("dungeon");
      setLocation("dungeon");
      setCurrentIndoorArea(dungeon.areaId);
      setActiveEvent(null);
      setEventLoot([]);
      setGameState("home");
    },
    [currentIsland, hero.inventory, resetEncounterModifiers],
  );

  const cancelExploreTest = useCallback(() => {
    setExploreTestContext(null);
    setGameState("home");
  }, []);

  const chooseLevelUpCard = useCallback(
    (choiceIndex: number) => {
      const chosenId = levelUpCardChoiceIds[choiceIndex];
      if (!chosenId) return;
      const result = applyLevelUpCardPick(
        heroRef.current,
        chosenId,
        levelUpPicksRemainingRef.current,
      );
      if (!result.picked) return;
      levelUpPicksRemainingRef.current = result.picksRemaining;
      heroRef.current = result.hero;
      setHero(result.hero);
      setLevelUpPicksRemaining(result.picksRemaining);
      setLevelUpCardChoiceIds(result.nextChoices);
      if (result.levelUpComplete) {
        const resume = resumeGameStateRef.current;
        setGameState(resume === "lobby" || !resume ? "home" : resume);
        setResumeGameState(null);
      }
    },
    [levelUpCardChoiceIds],
  );

  const openExploreTestPicker = useCallback(
    (context: ExploreTestContext) => {
      const currentHero = heroRef.current;
      if (!isDeckValid(currentHero) || currentHero.deckEditRequired) {
        setItemMessage("Fix yer deck before exploring.");
        requestCharacterSheetDeck();
        return;
      }
      if (context === "island") {
        if (!currentIsland) return;
        const deck = currentIsland.eventDeck ?? [];
        if (deck.length === 0) return;
      }
      if (context === "dungeon") {
        if (!currentDungeon || currentDungeon.delvePoints <= 0) return;
        if (
          isIslandDungeonKind(currentDungeon.kind) &&
          !currentDungeon.candleUnlocked
        ) {
          setItemMessage("Ye need a light a candle before delving here.");
          return;
        }
        if (
          isIslandDungeonKind(currentDungeon.kind) &&
          currentDungeon.delvePoints === 1
        ) {
          setCurrentDungeon({ ...currentDungeon, delvePoints: 0 });
          setGameState("home");
          initiateDungeonBattle();
          resetEncounterModifiers("dungeon");
          return;
        }
      }
      setExploreTestContext(context);
      setGameState("exploreTest");
    },
    [currentDungeon, currentIsland, initiateDungeonBattle, requestCharacterSheetDeck, resetEncounterModifiers],
  );

  const applyExploreTestOutcome = useCallback(
    (optionId: string) => {
      if (!exploreTestContext) return;
      const option = findExploreTestOption(exploreTestContext, optionId, {
        seaEventDeck,
        currentIsland,
        dungeonModifiers: encounterModifiers.dungeon,
      });
      if (!option) return;

      setExploreTestContext(null);

      if (exploreTestContext === "sea") {
        const { remainingDeck } = drawSeaEvent(seaEventDeck);
        setSeaEventDeck(remainingDeck);

        if (option.event?.type === "combat") {
          setGameState("home");
          initiateBattle();
          return;
        }

        if (option.event?.type === "discovery") {
          setCurrentIsland(generateIsland());
          setActiveEvent({ ...option.event });
          setDungeonChestUnlocked(false);
          clearChestInteraction();
          setEventLoot([]);
          setGameState("event");
          return;
        }

        if (option.event && isPortTownEvent(option.event)) {
          setCurrentPortTown(generatePortTown());
          setActiveEvent({ ...option.event });
          setDungeonChestUnlocked(false);
          clearChestInteraction();
          setEventLoot([]);
          setGameState("event");
          return;
        }

        const drawn = option.event!;
        let eventToSet: EventType = drawn;
        if (isSeaTreasureTemplate(drawn)) {
          eventToSet = prepareSeaTreasureEvent(drawn);
        }

        setActiveEvent(eventToSet);
        setDungeonChestUnlocked(!eventToSet.locked);
        clearChestInteraction();
        setEventLoot(
          isTreasureEvent(eventToSet)
            ? isSeaTreasureEvent(eventToSet)
              ? generateFloatingSuppliesLoot()
              : generateEventLoot(eventToSet, { islandVibe: null })
            : [],
        );
        setGameState("event");
        return;
      }

      if (exploreTestContext === "island") {
        if (!currentIsland) return;
        const deck = currentIsland.eventDeck ?? [];
        const drawResult = drawIslandEvent(deck);
        if (!drawResult) return;

        setCurrentIsland({
          ...currentIsland,
          eventDeck: drawResult.remainingDeck,
          explorePoints: drawResult.remainingDeck.length,
        });

        if (option.event?.type === "combat") {
          setGameState("home");
          initiateIslandBattle();
          return;
        }

        const drawn = option.event ?? drawResult.drawn;
        let eventToSet: EventType = drawn;
        if (isIslandTreasureEvent(drawn)) {
          eventToSet = prepareIslandTreasureEvent(drawn);
        }

        setActiveEvent(eventToSet);
        setDungeonChestUnlocked(!eventToSet.locked);
        clearChestInteraction();
        setEventLoot(
          isTreasureEvent(eventToSet) && isIslandTreasureEvent(eventToSet)
            ? generateIslandTreasureLoot(eventToSet, hero, currentIsland)
            : [],
        );
        setGameState("event");
        return;
      }

      if (exploreTestContext === "dungeon") {
        if (!currentDungeon || currentDungeon.delvePoints <= 0) return;

        const dungeonDelveAfter = currentDungeon.delvePoints - 1;
        setCurrentDungeon({
          ...currentDungeon,
          delvePoints: dungeonDelveAfter,
        });

        if (option.forceCombat) {
          setGameState("home");
          initiateDungeonBattle();
          if (dungeonDelveAfter === 0) {
            resetEncounterModifiers("dungeon");
          }
          return;
        }

        const drawn = option.event!;
        const scope = encounterScopeForLocation(location);
        setEncounterModifiers((prev) => ({
          ...prev,
          [scope]: applyEncounterDrawPenalty(prev[scope], drawn),
        }));

        let eventToSet: EventType = drawn;
        if (isTreasureEvent(drawn)) {
          eventToSet = prepareDungeonTreasureEvent(drawn);
        }
        setActiveEvent(eventToSet);
        setDungeonChestUnlocked(!eventToSet.locked);
        clearChestInteraction();
        setEventLoot(
          isTreasureEvent(drawn)
            ? generateEventLoot(drawn, {
                islandVibe: currentIsland?.vibe ?? null,
                heroLevel: hero.level,
                levelFactor: currentDungeon.levelFactor,
              })
            : [],
        );
        setGameState("event");

        if (dungeonDelveAfter === 0) {
          resetEncounterModifiers("dungeon");
        }
      }
    },
    [
      clearChestInteraction,
      currentDungeon,
      currentIsland,
      encounterModifiers.dungeon,
      exploreTestContext,
      generateIsland,
      hero,
      initiateBattle,
      initiateDungeonBattle,
      initiateIslandBattle,
      location,
      resetEncounterModifiers,
      seaEventDeck,
    ],
  );

  const handleSailOrExplore = useCallback(() => {
    if (location === "ship") {
      openExploreTestPicker("sea");
      return;
    }
    if (location === "island") {
      openExploreTestPicker("island");
      return;
    }
    if (location === "dungeon") {
      openExploreTestPicker("dungeon");
    }
  }, [location, openExploreTestPicker]);

  const startSailFromShip = useCallback(() => {
    setLocation("ship");
    setCurrentIsland(null);
    setNearPortTown(false);
    setCurrentPortTown(null);
    resetEncounterModifiers("island");
    openExploreTestPicker("sea");
  }, [openExploreTestPicker, resetEncounterModifiers]);

  const scheduleCombatVictory = useCallback((snapshot?: EnemyType[]) => {
    cancelVictoryDelay();
    const frozen = [...(snapshot ?? enemiesRef.current)];
    enemiesRef.current = frozen;
    setVictoryEnemies(frozen);
    setEnemies(frozen);
    victoryPendingRef.current = true;
    setVictoryPending(true);
    victoryTimerRef.current = window.setTimeout(() => {
      victoryTimerRef.current = null;
      victoryPendingRef.current = false;
      setVictoryPending(false);
      setCombatLoot(
        generateCombatLoot(frozen, {
          ammoSpent: combatAmmoSpentRef.current,
        }),
      );
      setCombatVictory(true);
    }, VICTORY_DELAY_MS);
  }, [cancelVictoryDelay]);

  useEffect(() => {
    if (gameState !== "battle") return;
    if (combatVictory || victoryPending) return;
    if (enemies.length === 0) return;
    if (countLivingEnemies(enemies) > 0) return;
    scheduleCombatVictory(enemies);
  }, [gameState, combatVictory, victoryPending, enemies, scheduleCombatVictory]);

  const claimCombatLoot = useCallback(
    (lootId: string) => {
      const next = applyLootClaim(
        combatLootRef.current,
        lootId,
        grantLootItem,
      );
      if (next === combatLootRef.current) return;
      combatLootRef.current = next;
      setCombatLoot(next);
    },
    [grantLootItem],
  );

  const claimEventLoot = useCallback(
    (lootId: string) => {
      const next = applyLootClaim(
        eventLootRef.current,
        lootId,
        grantLootItem,
      );
      if (next === eventLootRef.current) return;
      eventLootRef.current = next;
      setEventLoot(next);
    },
    [grantLootItem],
  );

  const clearDepletedIslandDungeon = useCallback(() => {
    if (
      location === "dungeon" &&
      currentDungeon &&
      isIslandDungeonKind(currentDungeon.kind) &&
      isDepletedDungeon(currentDungeon)
    ) {
      setCurrentDungeon(null);
      setCurrentIndoorArea(null);
      setLocation("island");
    }
  }, [currentDungeon, location]);

  const completeTreasureEvent = useCallback(() => {
    setActiveEvent(null);
    setEventLoot([]);
    setDungeonChestUnlocked(false);
    clearChestInteraction();
    setDay((d) => d + 1);
    clearDepletedIslandDungeon();
    setGameState("home");
  }, [clearDepletedIslandDungeon]);

  const acknowledgeGenericEvent = useCallback(() => {
    setActiveEvent(null);
    setDay((d) => d + 1);
    clearDepletedIslandDungeon();
    setGameState("home");
  }, [clearDepletedIslandDungeon]);

  const acknowledgeWeatherEvent = useCallback(() => {
    if (!activeEvent || activeEvent.type !== "weather") return;
    setHero((h) => applySeaWeatherToHero(h, activeEvent.name));
    setActiveEvent(null);
    setDay((d) => d + 1);
    setGameState("home");
  }, [activeEvent]);

  const abandonLockedDungeonChest = useCallback(() => {
    setActiveEvent(null);
    setEventLoot([]);
    setDungeonChestUnlocked(false);
    clearChestInteraction();
    setDay((d) => d + 1);
    setGameState("home");
  }, []);

  const unlockDungeonChestWithKey = useCallback(() => {
    if (getItemCount(hero.inventory, "key") <= 0) {
      setChestMessage("Ye have no keys.");
      return;
    }
    setHero((h) => ({
      ...h,
      inventory: removeItemFromInventory(h.inventory, "key"),
    }));
    setDungeonChestUnlocked(true);
    setChestMessage(null);
  }, [hero.inventory]);

  const pickLockOnChest = useCallback(() => {
    if (!heroHasLockpickEquipped(hero)) {
      setChestMessage("Ye need a lockpick equipped in yer Relic 1 slot.");
      return;
    }
    const result = rollPickLock();
    if (result.outcome === "success") {
      setDungeonChestUnlocked(true);
      setChestMessage(null);
      return;
    }
    setHero((h) => breakEquippedLockpick(h));
    if (result.outcome === "success_broken") {
      setDungeonChestUnlocked(true);
      setChestMessage(PICK_LOCK_SUCCESS_BROKEN_MESSAGE);
      return;
    }
    setChestMessage(PICK_LOCK_FAIL_BROKEN_MESSAGE);
  }, [hero]);

  const forceOpenDungeonChest = useCallback(() => {
    if (forceOpenAttempted) return;
    const result = rollForceOpenChest();
    if (result.outcome === "success") {
      setDungeonChestUnlocked(true);
      setChestMessage(null);
      return;
    }
    setForceOpenAttempted(true);
    if (result.outcome === "hurt") {
      setHero((h) => ({
        ...h,
        current_hp: clampHp(Math.max(1, h.current_hp - result.damage)),
      }));
      setChestMessage(
        `Ye hurt yerself forcing the lid — ${result.damage} damage!`,
      );
      return;
    }
    setChestMessage(FORCE_OPEN_FAIL_MESSAGE);
  }, [forceOpenAttempted]);

  const dismissCombatVictory = useCallback(() => {
    setCombatVictory(false);
    setVictoryEnemies([]);
    setCombatLoot([]);
    setEnemies([]);
    resetCombatState();
    setHero((h) => ({ ...h, ammo: h.max_ammo }));
    setDay((d) => d + 1);
    clearDepletedIslandDungeon();
    setGameState("home");
  }, [clearDepletedIslandDungeon, resetCombatState]);

  const playCombatCard = useCallback(
    (handIndex: number, targetIndex?: number) => {
      if (
        combatPhase !== "player" ||
        victoryPendingRef.current ||
        combatVictory
      ) {
        return;
      }

      const card = hand[handIndex];
      if (!card) return;

      const cost = getCardEnergyCost(card);
      if (energy < cost) return;

      let updatedEnemies = [...enemies];
      const log: CombatLogEntry[] = [];
      let goldDelta = 0;

      if (targetsAllEnemiesAutomatically(card)) {
        if (cardRequiresAmmo(card) && heroRef.current.ammo < 1) return;
        if (cardRequiresAmmo(card)) {
          combatAmmoSpentRef.current += 1;
          setHero((h) => ({ ...h, ammo: Math.max(0, h.ammo - 1) }));
        }
        const aoe = applyAllEnemiesAttack(
          updatedEnemies,
          hero.equipped,
          card,
          hero.name,
          hero.current_hp,
          heroWeakened,
        );
        updatedEnemies = aoe.updatedEnemies;
        log.push(...aoe.log);
        if (aoe.heroHpDelta !== 0) {
          const nextHp = clampHp(hero.current_hp + aoe.heroHpDelta);
          setHero((h) => ({ ...h, current_hp: nextHp }));
          if (aoe.heroSlain) setGameState("dead");
        }
        goldDelta += aoe.goldStolen;
      } else if (targetsEnemyManually(card)) {
        if (!isAttackCard(card)) return;
        if (targetIndex === undefined) return;
        const target = updatedEnemies[targetIndex];
        if (!target || !isEnemyAlive(target)) return;
        if (cardRequiresAmmo(card) && heroRef.current.ammo < 1) return;

        if (cardRequiresAmmo(card)) {
          combatAmmoSpentRef.current += 1;
          setHero((h) => ({ ...h, ammo: Math.max(0, h.ammo - 1) }));
          const ranged = applyRangedAttackToEnemyIndex(
            updatedEnemies,
            targetIndex,
            hero.equipped,
            card,
            hero.name,
            heroWeakened,
          );
          updatedEnemies = ranged.updatedEnemies;
          log.push(...ranged.log);
        } else {
          const melee = applyMeleeAttackToEnemyIndex(
            updatedEnemies,
            targetIndex,
            hero.equipped,
            card,
            hero.name,
            hero.current_hp,
            heroWeakened,
          );
          updatedEnemies = melee.updatedEnemies;
          log.push(...melee.log);
          goldDelta += melee.goldStolen;
          if (melee.heroHpDelta !== 0) {
            const nextHp = clampHp(hero.current_hp + melee.heroHpDelta);
            setHero((h) => ({ ...h, current_hp: nextHp }));
            if (melee.heroSlain) setGameState("dead");
          }
        }
      } else if (targetsSelfAutomatically(card)) {
        const defend = applySelfDefendCard(
          card,
          hero.equipped,
          hero.name,
          armor,
        );
        setArmor(defend.nextArmor);
        if (defend.evasiveStacksGained > 0) {
          setHeroEvasiveStacks((stacks) => stacks + defend.evasiveStacksGained);
        }
        log.push(...defend.log);
      }

      if (goldDelta > 0) {
        setHero((h) => ({ ...h, gold: h.gold + goldDelta }));
      }

      setCombatLog((prev) => appendCombatLog(prev, ...log));
      setEnergy((e) => e - cost);
      setDiscardPile((prev) => {
        const next = [...prev, card];
        discardPileRef.current = next;
        return next;
      });
      setHand((prev) => prev.filter((_, i) => i !== handIndex));
      enemiesRef.current = updatedEnemies;
      setEnemies(updatedEnemies);

      if (countLivingEnemies(updatedEnemies) === 0) {
        scheduleCombatVictory(updatedEnemies);
      }
    },
    [
      armor,
      combatPhase,
      enemies,
      energy,
      hand,
      hero.name,
      hero.equipped,
      hero.current_hp,
      heroWeakened,
      combatVictory,
      scheduleCombatVictory,
    ],
  );

  const endPlayerTurn = useCallback(() => {
    if (
      combatPhase !== "player" ||
      countLivingEnemies(enemies) === 0 ||
      victoryPendingRef.current ||
      combatVictory
    ) {
      return;
    }
    setDiscardPile((prev) => {
      const next = [...prev, ...hand];
      discardPileRef.current = next;
      return next;
    });
    setHand([]);
    enemyTurnRunRef.current += 1;
    setCombatPhase("enemy");
    setEnemyTurnIndex(findNextLivingEnemyIndex(enemies, 0) ?? 0);
  }, [combatPhase, combatVictory, enemies, hand]);

  useEffect(() => {
    if (combatPhase !== "enemy" || enemyTurnIndex === null) return;

    const runId = ++enemyTurnRunRef.current;
    const isStale = () => enemyTurnRunRef.current !== runId;

    const currentEnemies = enemiesRef.current;
    let enemy = currentEnemies[enemyTurnIndex];

    if (!enemy || !isEnemyAlive(enemy)) {
      const nextLiving = findNextLivingEnemyIndex(
        currentEnemies,
        enemyTurnIndex + 1,
      );
      if (isStale()) return;
      if (nextLiving === null) {
        startPlayerTurnRef.current();
      } else {
        setEnemyTurnIndex(nextLiving);
      }
      return;
    }

    if (enemy.armor !== 0) {
      const stripped = [...currentEnemies];
      stripped[enemyTurnIndex] = { ...enemy, armor: 0 };
      enemiesRef.current = stripped;
      setEnemies(stripped);
      enemy = stripped[enemyTurnIndex]!;
    }

    setEnemyActionMessage(
      `${enemy.name} — ${formatEnemyBroadcastLabel(enemy.broadcast)}…`,
    );

    let resolveTimer: number | undefined;

    const windUpTimer = window.setTimeout(() => {
      if (isStale()) return;

      const h = heroRef.current;
      const a = armorRef.current;
      const result = executeEnemyAction(
        enemy,
        h.name,
        h.current_hp,
        a,
        heroWeakenedRef.current,
        heroEvasiveStacksRef.current,
      );

      setEnemies((prev) => {
        const next = [...prev];
        if (next[enemyTurnIndex]) {
          next[enemyTurnIndex] = result.enemy;
        }
        enemiesRef.current = next;
        return next;
      });
      setArmor(result.playerArmor);
      setHeroWeakened(result.heroWeakened);
      setHero({
        ...h,
        current_hp: clampHp(result.heroHp),
        max_hp: clampHp(h.max_hp),
      });
      setCombatLog((prev) =>
        appendCombatLog(prev, combatLogLine(result.message, "enemy")),
      );
      setEnemyActionMessage(result.message);

      resolveTimer = window.setTimeout(() => {
        if (isStale()) return;

        if (result.heroHp <= 0) {
          setCombatLog((prev) =>
            appendCombatLog(prev, combatLogLine(`${h.name} has been slain!`, "enemy")),
          );
          setGameState("dead");
          setCombatPhase("player");
          setEnemyTurnIndex(null);
          setEnemyActionMessage(null);
          return;
        }

        const nextLiving = findNextLivingEnemyIndex(
          enemiesRef.current,
          enemyTurnIndex + 1,
        );
        if (isStale()) return;
        if (nextLiving === null) {
          startPlayerTurnRef.current();
        } else {
          setEnemyTurnIndex(nextLiving);
        }
      }, 1000);
    }, 1000);

    return () => {
      enemyTurnRunRef.current += 1;
      clearTimeout(windUpTimer);
      if (resolveTimer !== undefined) clearTimeout(resolveTimer);
    };
  }, [combatPhase, enemyTurnIndex]);

  const resetToLobby = useCallback(() => {
    cancelVictoryDelay();
    clearShantiesSave();
    setLocation("ship");
    setCurrentIsland(null);
    setCurrentDungeon(null);
    setEnemies([]);
    setVictoryEnemies([]);
    setCombatLoot([]);
    setEventLoot([]);
    setActiveEvent(null);
    setDay(1);
    setHero(createInitialHero());
    setIlluminatedAreas([]);
    setCurrentIndoorArea(null);
    setDungeonChestUnlocked(false);
    clearChestInteraction();
    resetAllEncounterModifiers();
    resetCombatState();
    setCombatVictory(false);
    setResumeGameState(null);
    setLevelUpPicksRemaining(0);
    setLevelUpCardChoiceIds([]);
    setGameState("lobby");
  }, [cancelVictoryDelay, resetAllEncounterModifiers, resetCombatState]);

  const openRest = useCallback(() => {
    setRestComplete(false);
    setRestMessage(null);
    setGameState("rest");
  }, []);

  const healHero = useCallback(() => {
    const check = checkRest(hero);
    if (!check.ok) {
      setRestMessage(check.message);
      return;
    }
    setHero((h) => applyRest(h));
    setRestMessage(null);
    setRestComplete(true);
  }, [hero]);

  const wakeFromRest = useCallback(() => {
    setRestComplete(false);
    setRestMessage(null);
    setGameState("home");
  }, []);

  const leaveRest = useCallback(() => {
    setRestComplete(false);
    setRestMessage(null);
    setGameState("home");
  }, []);

  const markIslandCookstoveFound = useCallback(() => {
    setCurrentIsland((prev) =>
      prev && !prev.cookstoveFound ? { ...prev, cookstoveFound: true } : prev,
    );
  }, []);

  const openCookstove = useCallback(() => {
    setCookMessage(null);
    setGameState("cookstove");
  }, []);

  const leaveCookstove = useCallback(() => {
    setCookMessage(null);
    setGameState("home");
  }, []);

  const dismissCookstoveEncounter = useCallback(() => {
    markIslandCookstoveFound();
    setActiveEvent(null);
    setCookMessage(null);
    setGameState("home");
    setDay((d) => d + 1);
  }, [markIslandCookstoveFound]);

  const cookAtStove = useCallback(
    (fromIslandEvent = false) => {
      if (!canCookAtStove(hero)) {
        setCookMessage("Ye need a wood plank and somethin' raw to cook.");
        return;
      }
      const result = applyCookAtStove(hero);
      setHero(result.hero);
      setCookMessage(
        formatCookResultMessage(result.rawFishCooked, result.rawMeatCooked),
      );
      if (fromIslandEvent) {
        markIslandCookstoveFound();
        setActiveEvent(null);
        setGameState("home");
        setDay((d) => d + 1);
      }
    },
    [hero, markIslandCookstoveFound],
  );

  const clearItemMessage = useCallback(() => {
    setItemMessage(null);
  }, []);

  const clearShopMessage = useCallback(() => {
    setShopMessage(null);
  }, []);

  const openShipShop = useCallback(() => {
    setShopVariant("ship");
    setShopMessage(null);
    setGameState("shop");
  }, []);

  const openMerchantShop = useCallback(() => {
    setShopVariant("merchant");
    setShopMessage(null);
    setActiveEvent(null);
    setGameState("shop");
  }, []);

  const openIslandTraderShop = useCallback(() => {
    setShopVariant("island_trader");
    setShopMessage(null);
    setActiveEvent(null);
    setGameState("shop");
  }, []);

  const openPortShop = useCallback(() => {
    setShopVariant("port");
    setShopMessage(null);
    setGameState("shop");
  }, []);

  const openShipwright = useCallback(() => {
    setGameState("shipwright");
  }, []);

  const openTavern = useCallback(() => {
    setTavernMessage(null);
    setGameState("tavern");
  }, []);

  const leavePort = useCallback(() => {
    setLocation("ship");
    setGameState("home");
  }, []);

  const returnToPort = useCallback(() => {
    setLocation("port");
    setGameState("home");
  }, []);

  const leaveTavern = useCallback(() => {
    setTavernMessage(null);
    setGameState("home");
  }, []);

  const leaveShipwright = useCallback(() => {
    setGameState("home");
  }, []);

  const buyTavernCard = useCallback(
    (offerId: string) => {
      const check = checkBuyTavernCard(hero, offerId);
      if (!check.ok) {
        setTavernMessage(check.message);
        return;
      }
      const label = CARD_CATALOG[offerId as CardId]?.name ?? "card";
      setHero((h) => applyBuyTavernCard(h, offerId, check.price));
      setTavernMessage(`Ye bought a ${label.toLowerCase()} card.`);
    },
    [hero],
  );

  const refineTavernCard = useCallback(
    (deckIndex: number) => {
      const check = checkRefineTavernCard(hero, deckIndex);
      if (!check.ok) {
        setTavernMessage(check.message);
        return;
      }
      const removedId = hero.deck[deckIndex];
      const removedName = removedId
        ? CARD_CATALOG[removedId].name
        : "card";
      setHero((h) => applyRefineTavernCard(h, deckIndex));
      setTavernMessage(`Ye refined ${removedName.toLowerCase()} out of yer deck.`);
    },
    [hero],
  );

  const buyShopItem = useCallback(
    (itemId: ItemId) => {
      const check = checkBuyItem(hero, itemId, shopVariant);
      if (!check.ok) {
        setShopMessage(check.message);
        return;
      }
      setHero((h) => applyBuyItem(h, itemId, shopVariant));
      setShopMessage(
        `Ye bought a ${ITEM_DEFINITIONS[itemId].name.toLowerCase()}.`,
      );
    },
    [hero, shopVariant],
  );

  const sellShopItem = useCallback(
    (itemId: ItemId) => {
      if (!shopAllowsSelling(shopVariant)) {
        setShopMessage("Ye can't sell that here.");
        return;
      }
      const check = checkSellItem(hero, itemId);
      if (!check.ok) {
        setShopMessage(check.message);
        return;
      }
      setHero((h) => applySellItem(h, itemId));
      setShopMessage(
        `Ye sold a ${ITEM_DEFINITIONS[itemId].name.toLowerCase()}.`,
      );
    },
    [hero, shopVariant],
  );

  const sellShopEquipment = useCallback(
    (bagIndex: number) => {
      if (!shopAllowsSelling(shopVariant)) {
        setShopMessage("Ye can't sell that here.");
        return;
      }
      const check = checkSellEquipment(hero, bagIndex);
      if (!check.ok) {
        setShopMessage(check.message);
        return;
      }
      const equipmentId = hero.equipmentInventory[bagIndex];
      if (!equipmentId) return;
      setHero((h) => applySellEquipment(h, bagIndex));
      setShopMessage(
        `Ye sold yer ${EQUIPMENT_DEFINITIONS[equipmentId].name.toLowerCase()}.`,
      );
    },
    [hero, shopVariant],
  );

  const leaveShop = useCallback(() => {
    setShopMessage(null);
    const advancesDay =
      shopVariant === "merchant" || shopVariant === "island_trader";
    setShopVariant(null);
    setGameState("home");
    if (advancesDay) {
      setDay((d) => d + 1);
    }
  }, [shopVariant]);

  const updateHeroEquipment = useCallback((next: HeroType) => {
    const withFlag: HeroType = {
      ...next,
      deckEditRequired: !isDeckValid(next),
    };
    setHero(withFlag);
    if (withFlag.deckEditRequired) {
      requestCharacterSheetDeck();
    }
  }, [requestCharacterSheetDeck]);

  const updateHeroDeck = useCallback((deck: CardId[]) => {
    setHero((h) => {
      const next = { ...h, deck };
      return {
        ...next,
        deckEditRequired: !isDeckValid(next),
      };
    });
  }, []);

  const clearDeckEditRequired = useCallback(() => {
    setHero((h) => ({ ...h, deckEditRequired: false }));
  }, []);

  const useItem = useCallback(
    (itemId: ItemId) => {
      const check = checkUseItem(itemId, {
        gameState,
        hero,
        currentIndoorArea,
        illuminatedAreas,
        combatPhase,
        energy,
        victoryPending: victoryPendingRef.current,
        combatVictory,
      });
      if (!check.ok) {
        setItemMessage(check.message);
        return;
      }

      const energyCost = getItemEnergyCost(itemId);
      if (gameState === "battle" && energyCost !== null) {
        setEnergy((e) => e - energyCost);
      }

      if (isFoodItem(itemId)) {
        const healAmount = rollFoodHealAmount(itemId);
        const foodName = ITEM_DEFINITIONS[itemId].name.toLowerCase();
        setHero((h) => applyFoodUse(h, itemId, healAmount));
        setItemMessage(`Ye eat the ${foodName} and recover ${healAmount} HP.`);
        return;
      }

      if (itemId === "candle") {
        const areaId = currentIndoorArea!;
        setIlluminatedAreas((prev) =>
          prev.includes(areaId) ? prev : [...prev, areaId],
        );
        setHero((h) => ({
          ...h,
          inventory: removeItemFromInventory(h.inventory, "candle"),
        }));
        setItemMessage(
          `Ye light the candle — the ${formatIndoorAreaLabel(areaId).toLowerCase()} stays lit fer good.`,
        );
      }
    },
    [
      combatPhase,
      combatVictory,
      currentIndoorArea,
      energy,
      gameState,
      hero,
      illuminatedAreas,
    ],
  );

  return {
    gameState,
    setGameState,
    location,
    setLocation,
    currentIsland,
    setCurrentIsland,
    currentPortTown,
    setCurrentPortTown,
    currentDungeon,
    setCurrentDungeon,
    enemies,
    battlefieldEnemies,
    activeEvent,
    setActiveEvent,
    day,
    setDay,
    hand,
    discardPile,
    combatLog,
    armor,
    heroWeakened,
    energy,
    maxEnergy: MAX_ENERGY_PER_TURN,
    combatPhase,
    victoryPending,
    combatVictory,
    combatLoot,
    allCombatLootClaimed: allLootClaimed(combatLoot),
    eventLoot,
    allEventLootClaimed: allLootClaimed(eventLoot),
    levelUpCardChoices,
    enemyActionMessage,
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
    hero,
    generateIsland,
    renderIslandName,
    renderPortTownName: renderPortTownNameStable,
    renderDungeonName: renderDungeonNameStable,
    handleSailOrExplore,
    startSailFromShip,
    returnToShipFromIsland,
    anchorAtDiscoveredIsland,
    abandonDiscoveredIsland,
    dockAtPortTown,
    sailPastPortTown,
    enterCurrentDungeon,
    returnToIslandFromDungeon,
    resolveDungeonDiscovery,
    resolveShipwreckDive,
    playCombatCard,
    endPlayerTurn,
    resetToLobby,
    goToLobby,
    resumeAdventure,
    restartAdventure,
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
    illuminatedAreas,
    currentIndoorArea,
    setCurrentIndoorArea,
    itemMessage,
    useItem,
    clearItemMessage,
    shopMessage,
    shopVariant,
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
    chooseLevelUpCard,
    buyShopItem,
    sellShopItem,
    sellShopEquipment,
    leaveShop,
    clearShopMessage,
    updateHeroEquipment,
    updateHeroDeck,
    clearDeckEditRequired,
    characterSheetRequest,
    clearCharacterSheetRequest,
    deckValid: isDeckValid(hero),
  };
}
