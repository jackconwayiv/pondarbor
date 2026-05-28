import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  allLootClaimed,
  claimLootItem,
  generateCombatLoot,
  generateEventLoot,
  isTreasureEvent,
} from "./combatLoot";
import {
  appendCombatLog,
  applyAttackDamageToEnemy,
  clampHp,
  CARDS_DRAWN_PER_TURN,
  drawFromPiles,
  formatPlayerAttackLog,
  getCardEnergyCost,
  MAX_ENERGY_PER_TURN,
  assignEnemyIntents,
  countLivingEnemies,
  executeEnemyIntent,
  findNextLivingEnemyIndex,
  formatEnemyIntentLabel,
  isEnemyAlive,
  setupCombatDeck,
  spawnEnemy,
} from "./combatRules";
import {
  applyCoconutUse,
  applyBuyItem,
  applySellItem,
  checkBuyItem,
  checkSellItem,
  checkUseItem,
  getItemCount,
  grantLootItemToInventory,
  getItemEnergyCost,
  COCONUT_HEAL_AMOUNT,
  formatIndoorAreaLabel,
  ITEM_DEFINITIONS,
  removeItemFromInventory,
} from "./shantiesItems";
import type {
  CombatCard,
  CombatLootItem,
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
} from "./shantiesTypes";
import {
  clearShantiesSave,
  createDefaultSaveData,
  createInitialHero,
  readShantiesSave,
  readShantiesSaveWithMeta,
  writeShantiesSave,
  type ShantiesSaveData,
} from "./shantiesLocalSave";
import {
  generateDungeon,
  renderDungeonName,
} from "./dungeonExplore";
import {
  applySellEquipment,
  checkSellEquipment,
  EQUIPMENT_DEFINITIONS,
} from "./shantiesEquipment";
import {
  applyRest,
  checkRest,
} from "./shantiesRest";
import {
  FORCE_OPEN_FAIL_MESSAGE,
  prepareDungeonTreasureEvent,
  rollForceOpenChest,
} from "./dungeonTreasure";
import {
  applyEncounterDrawPenalty,
  createEmptyScopedEncounterModifiers,
  pickDungeonEvent,
  pickIslandExploreEvent,
  pickSailEvent,
  type EncounterScope,
  type ScopedEncounterModifiers,
} from "./encounterProbability";
import {
  buildSaveSummaryLines,
  formatSavedAt,
  hasResumableAdventure,
} from "./shantiesSaveSummary";
import {
  isAttackCard,
  targetsEnemyManually,
  targetsSelfAutomatically,
} from "./shantiesTypes";

const isBattle = () => Math.random() < 0.5;

function encounterScopeForLocation(
  location: GameLocationTypes,
): EncounterScope {
  if (location === "ship") return "sail";
  if (location === "island") return "island";
  return "dungeon";
}

const rollDie = () => Math.random();

const VICTORY_DELAY_MS = 1800;

const rollDamage = (min: number, max: number) =>
  Math.floor(rollDie() * (max - min + 1)) + min;

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
  const [combatLog, setCombatLog] = useState<string[]>(initialSave.combatLog);
  const [armor, setArmor] = useState(initialSave.armor);
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
  const [restMessage, setRestMessage] = useState<string | null>(null);
  const [encounterModifiers, setEncounterModifiers] =
    useState<ScopedEncounterModifiers>(
      initialSave.encounterModifiers ?? createEmptyScopedEncounterModifiers(),
    );
  const [dungeonChestUnlocked, setDungeonChestUnlocked] = useState(
    initialSave.dungeonChestUnlocked ?? false,
  );
  const [chestMessage, setChestMessage] = useState<string | null>(null);

  const resetEncounterModifiers = useCallback((scope: EncounterScope) => {
    setEncounterModifiers((prev) => ({ ...prev, [scope]: {} }));
  }, []);

  const resetAllEncounterModifiers = useCallback(() => {
    setEncounterModifiers(createEmptyScopedEncounterModifiers());
  }, []);

  const battlefieldEnemies =
    victoryEnemies.length > 0 ? victoryEnemies : enemies;

  const heroRef = useRef(hero);
  const armorRef = useRef(armor);
  const enemiesRef = useRef(enemies);
  const drawPileRef = useRef(drawPile);
  const discardPileRef = useRef(discardPile);
  const victoryTimerRef = useRef<number | null>(null);
  const victoryPendingRef = useRef(false);
  /** Bumped when an enemy-turn effect cleans up so stale timers cannot act twice. */
  const enemyTurnRunRef = useRef(0);
  const startPlayerTurnRef = useRef<() => void>(() => {});

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
    armorRef.current = armor;
  }, [armor]);
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
    writeShantiesSave({
      gameState,
      location,
      currentIsland,
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
    });
  }, [
    gameState,
    location,
    currentIsland,
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
  ]);

  const grantLootItem = useCallback((item: CombatLootItem) => {
    if (item.kind === "gold") {
      setHero((h) => ({ ...h, gold: h.gold + item.amount }));
      return;
    }
    if (item.kind === "xp") {
      setHero((h) => ({ ...h, xp: h.xp + item.amount }));
      return;
    }
    if (item.kind === "item" && item.itemId) {
      setHero((h) => ({
        ...h,
        inventory: grantLootItemToInventory(h.inventory, item.itemId!),
      }));
    }
  }, []);

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
    setHand([]);
    setDrawPile([]);
    setDiscardPile([]);
    setCombatLog([]);
    setArmor(0);
    setEnergy(MAX_ENERGY_PER_TURN);
    setCombatPhase("player");
    setEnemyTurnIndex(null);
    setEnemyActionMessage(null);
  }, [cancelVictoryDelay]);

  const beginCombat = useCallback((sourceDeck: CombatCard[]) => {
    cancelVictoryDelay();
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
    setEnergy(MAX_ENERGY_PER_TURN);
    setCombatPhase("player");
    setEnemyTurnIndex(null);
    setEnemyActionMessage(null);
    setCombatLog([]);
  }, [cancelVictoryDelay]);

  const startPlayerTurn = useCallback(() => {
    setCombatPhase("player");
    setEnergy(MAX_ENERGY_PER_TURN);
    setEnemyTurnIndex(null);
    setEnemyActionMessage(null);
    drawCardsForTurn();
    setEnemies((prev) => assignEnemyIntents(prev));
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

    let explorePoints = 5;
    if (size === "Small") explorePoints -= 2;
    if (size === "Large") explorePoints += 2;

    let levelFactor = 0;
    if (vibe === "Foreboding") levelFactor += 1;
    if (vibe === "Inviting") levelFactor -= 1;

    const name = `${weatherList[Math.floor(Math.random() * weatherList.length)]} ${
      isleList[Math.floor(Math.random() * isleList.length)]
    } of ${attributeList[Math.floor(Math.random() * attributeList.length)]}`;

    return { name, size, explorePoints, levelFactor, vibe };
  }, []);

  const renderIslandName = useCallback((island: IslandType) => {
    let fullIslandName = "";
    if (island.size) fullIslandName += `${island.size}, `;
    if (island.vibe) fullIslandName += `${island.vibe} `;
    fullIslandName += island.name;
    return fullIslandName;
  }, []);

  const renderDungeonNameStable = useCallback(
    (dungeon: DungeonType) => renderDungeonName(dungeon),
    [],
  );

  const lobbySaveSnapshot = useMemo(
    (): ShantiesSaveData => ({
      gameState,
      location,
      currentIsland,
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
    }),
    [
      gameState,
      location,
      currentIsland,
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
    ],
  );

  const canResumeAdventure = hasResumableAdventure(lobbySaveSnapshot);
  const lobbySaveSummaryLines = useMemo(
    () => buildSaveSummaryLines(lobbySaveSnapshot, renderIslandName),
    [lobbySaveSnapshot, renderIslandName],
  );
  const lobbySavedAtLabel = useMemo(() => {
    const meta = readShantiesSaveWithMeta();
    return formatSavedAt(meta?.savedAtMs ?? null);
  }, [lobbySaveSnapshot]);

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
    setChestMessage(null);
    resetAllEncounterModifiers();
    resetCombatState();
    setCombatVictory(false);
    setGameState("home");
  }, [cancelVictoryDelay, resetAllEncounterModifiers, resetCombatState]);

  const initiateBattle = useCallback(() => {
    const levelOneMonsterArray = [
      { name: "Harpy", level: 1, hp: 6 },
      { name: "Siren", level: 1, hp: 5 },
    ] as const;
    const monsterCount = Math.floor(Math.random() * 2) + 1;
    const selectedMonsters: EnemyType[] = [];
    for (let i = 0; i < monsterCount; i++) {
      const randomIndex = Math.floor(
        Math.random() * levelOneMonsterArray.length,
      );
      selectedMonsters.push(spawnEnemy(levelOneMonsterArray[randomIndex]));
    }
    setEnemies(selectedMonsters);
    beginCombat([...hero.deck]);
    setGameState("battle");
  }, [beginCombat, hero.deck]);

  const initiateIslandBattle = useCallback(() => {
    const monsterPool = [
      { name: "Boar", level: 1, hp: 4 },
      { name: "Wolf", level: 1, hp: 5 },
    ] as const;
    const count = Math.floor(Math.random() * 2) + 1;
    const selected = Array.from({ length: count }, () =>
      spawnEnemy(monsterPool[Math.floor(Math.random() * monsterPool.length)]),
    );
    setEnemies(selected);
    beginCombat([...hero.deck]);
    setGameState("battle");
  }, [beginCombat, hero.deck]);

  const initiateDungeonBattle = useCallback(() => {
    const monsterPool = [
      { name: "Bat", level: 1, hp: 3 },
      { name: "Skeleton", level: 1, hp: 5 },
    ] as const;
    const count = Math.floor(Math.random() * 2) + 1;
    const selected = Array.from({ length: count }, () =>
      spawnEnemy(monsterPool[Math.floor(Math.random() * monsterPool.length)]),
    );
    setEnemies(selected);
    beginCombat([...hero.deck]);
    setGameState("battle");
  }, [beginCombat, hero.deck]);

  const enterCurrentDungeon = useCallback(() => {
    if (!currentDungeon) return;
    setLocation("dungeon");
    setCurrentIndoorArea(currentDungeon.areaId);
    setGameState("home");
  }, [currentDungeon]);

  const returnToIslandFromDungeon = useCallback(() => {
    setLocation("island");
    setCurrentIndoorArea(null);
    setGameState("home");
  }, []);

  const returnToShipFromIsland = useCallback(() => {
    resetEncounterModifiers("island");
    setLocation("ship");
    setGameState("home");
  }, [resetEncounterModifiers]);

  const anchorAtDiscoveredIsland = useCallback(() => {
    resetEncounterModifiers("sail");
    setLocation("island");
    setGameState("home");
    setActiveEvent(null);
    setDay((d) => d + 1);
  }, [resetEncounterModifiers]);

  const abandonDiscoveredIsland = useCallback(() => {
    setCurrentIsland(null);
    setGameState("home");
    setActiveEvent(null);
    setDay((d) => d + 1);
  }, []);

  const resolveDungeonDiscovery = useCallback(
    (enterNow: boolean) => {
      const kind = activeEvent?.dungeonKind;
      if (!kind) return;
      const dungeon = generateDungeon(kind, currentIsland);
      setCurrentDungeon(dungeon);
      resetEncounterModifiers("dungeon");
      setActiveEvent(null);
      setEventLoot([]);
      setDay((d) => d + 1);
      if (enterNow) {
        setLocation("dungeon");
        setCurrentIndoorArea(dungeon.areaId);
      }
      setGameState("home");
    },
    [activeEvent?.dungeonKind, currentIsland, resetEncounterModifiers],
  );

  const handleSailOrExplore = useCallback(() => {
    let dungeonDelveAfter: number | null = null;

    if (location === "island") {
      if (!currentIsland || currentIsland.explorePoints <= 0) return;
      setCurrentIsland({
        ...currentIsland,
        explorePoints: currentIsland.explorePoints - 1,
      });
    }
    if (location === "dungeon") {
      if (!currentDungeon || currentDungeon.delvePoints <= 0) return;
      dungeonDelveAfter = currentDungeon.delvePoints - 1;
      setCurrentDungeon({
        ...currentDungeon,
        delvePoints: dungeonDelveAfter,
      });
    }

    if (isBattle()) {
      if (location === "dungeon") {
        initiateDungeonBattle();
      } else if (location === "island") {
        initiateIslandBattle();
      } else {
        initiateBattle();
      }
      return;
    }

    const scope = encounterScopeForLocation(location);
    const scopeModifiers = encounterModifiers[scope];
    const drawn =
      scope === "sail"
        ? pickSailEvent(scopeModifiers)
        : scope === "island"
          ? pickIslandExploreEvent(scopeModifiers)
          : pickDungeonEvent(scopeModifiers);

    setEncounterModifiers((prev) => ({
      ...prev,
      [scope]: applyEncounterDrawPenalty(prev[scope], drawn),
    }));

    let eventToSet: EventType = drawn;
    if (location === "dungeon" && isTreasureEvent(drawn)) {
      eventToSet = prepareDungeonTreasureEvent(drawn);
    }
    const chestUnlocked = !eventToSet.locked;
    setActiveEvent(eventToSet);
    setDungeonChestUnlocked(chestUnlocked);
    setChestMessage(null);
    setEventLoot(isTreasureEvent(drawn) ? generateEventLoot(drawn) : []);
    if (location === "ship" && drawn.type === "discovery") {
      setCurrentIsland(generateIsland());
    }
    setGameState("event");

    if (dungeonDelveAfter === 0) {
      resetEncounterModifiers("dungeon");
    }
  }, [
    currentDungeon,
    currentIsland,
    encounterModifiers,
    generateIsland,
    initiateBattle,
    initiateDungeonBattle,
    initiateIslandBattle,
    location,
    resetEncounterModifiers,
  ]);

  const startSailFromShip = useCallback(() => {
    setLocation("ship");
    setCurrentIsland(null);
    resetEncounterModifiers("island");
    handleSailOrExplore();
  }, [handleSailOrExplore, resetEncounterModifiers]);

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
      setCombatLoot(generateCombatLoot(frozen));
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
      setCombatLoot((prev) =>
        claimLootItem(prev, lootId, grantLootItem),
      );
    },
    [grantLootItem],
  );

  const claimEventLoot = useCallback(
    (lootId: string) => {
      setEventLoot((prev) => claimLootItem(prev, lootId, grantLootItem));
    },
    [grantLootItem],
  );

  const completeTreasureEvent = useCallback(() => {
    setActiveEvent(null);
    setEventLoot([]);
    setDungeonChestUnlocked(false);
    setChestMessage(null);
    setDay((d) => d + 1);
    setGameState("home");
  }, []);

  const abandonLockedDungeonChest = useCallback(() => {
    setActiveEvent(null);
    setEventLoot([]);
    setDungeonChestUnlocked(false);
    setChestMessage(null);
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

  const forceOpenDungeonChest = useCallback(() => {
    const result = rollForceOpenChest();
    if (result.outcome === "success") {
      setDungeonChestUnlocked(true);
      setChestMessage(null);
      return;
    }
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
  }, []);

  const dismissCombatVictory = useCallback(() => {
    setCombatVictory(false);
    setVictoryEnemies([]);
    setCombatLoot([]);
    setEnemies([]);
    resetCombatState();
    setDay((d) => d + 1);
    setGameState("home");
  }, [resetCombatState]);

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
      const log: string[] = [];

      if (targetsEnemyManually(card)) {
        if (!isAttackCard(card)) return;
        if (targetIndex === undefined) return;
        const target = updatedEnemies[targetIndex];
        if (!target || !isEnemyAlive(target)) return;
        const damage = rollDamage(card.minDamage, card.maxDamage);
        const attackResult = applyAttackDamageToEnemy(target, damage);
        updatedEnemies[targetIndex] = attackResult.enemy;
        log.push(
          formatPlayerAttackLog(
            hero.name,
            target.name,
            attackResult.armorBroken,
            attackResult.damageDealt,
          ),
        );
        if (attackResult.enemy.hp <= 0) {
          log.push(`${target.name} has been slain!`);
        }
      } else if (targetsSelfAutomatically(card)) {
        const nextArmor = armor + 1;
        setArmor(nextArmor);
        log.push(`${hero.name} gains 1 armor (${nextArmor} total)`);
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
    const enemy = currentEnemies[enemyTurnIndex];

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

    setEnemyActionMessage(
      `${enemy.name} — ${formatEnemyIntentLabel(enemy.intent)}…`,
    );

    let resolveTimer: number | undefined;

    const windUpTimer = window.setTimeout(() => {
      if (isStale()) return;

      const h = heroRef.current;
      const a = armorRef.current;
      const result = executeEnemyIntent(enemy, h.name, h.current_hp, a);

      setEnemies((prev) => {
        const next = [...prev];
        if (next[enemyTurnIndex]) {
          next[enemyTurnIndex] = result.enemy;
        }
        enemiesRef.current = next;
        return next;
      });
      setArmor(result.playerArmor);
      setHero({
        ...h,
        current_hp: clampHp(result.heroHp),
        max_hp: clampHp(h.max_hp),
      });
      setCombatLog((prev) => appendCombatLog(prev, result.message));
      setEnemyActionMessage(result.message);

      resolveTimer = window.setTimeout(() => {
        if (isStale()) return;

        if (result.heroHp <= 0) {
          setCombatLog((prev) =>
            appendCombatLog(prev, `${h.name} has been slain!`),
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
    setChestMessage(null);
    resetAllEncounterModifiers();
    resetCombatState();
    setCombatVictory(false);
    setResumeGameState(null);
    setGameState("lobby");
  }, [cancelVictoryDelay, resetAllEncounterModifiers, resetCombatState]);

  const healHero = useCallback(() => {
    const check = checkRest(hero);
    if (!check.ok) {
      setRestMessage(check.message);
      return;
    }
    setHero((h) => applyRest(h));
    setRestMessage("Ye wake refreshed and ready for adventure.");
    setGameState("home");
  }, [hero]);

  const leaveRest = useCallback(() => {
    setRestMessage(null);
    setGameState("home");
  }, []);

  const clearItemMessage = useCallback(() => {
    setItemMessage(null);
  }, []);

  const clearShopMessage = useCallback(() => {
    setShopMessage(null);
  }, []);

  const buyShopItem = useCallback(
    (itemId: ItemId) => {
      const check = checkBuyItem(hero, itemId);
      if (!check.ok) {
        setShopMessage(check.message);
        return;
      }
      setHero((h) => applyBuyItem(h, itemId));
      setShopMessage(
        `Ye bought a ${ITEM_DEFINITIONS[itemId].name.toLowerCase()}.`,
      );
    },
    [hero],
  );

  const sellShopItem = useCallback(
    (itemId: ItemId) => {
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
    [hero],
  );

  const sellShopEquipment = useCallback(
    (bagIndex: number) => {
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
    [hero],
  );

  const leaveShop = useCallback(() => {
    setShopMessage(null);
    setGameState("home");
  }, []);

  const updateHeroEquipment = useCallback((next: HeroType) => {
    setHero(next);
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

      if (itemId === "coconut") {
        setHero((h) => applyCoconutUse(h));
        setItemMessage(`Ye eat the coconut and recover ${COCONUT_HEAL_AMOUNT} HP.`);
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
    energy,
    maxEnergy: MAX_ENERGY_PER_TURN,
    combatPhase,
    victoryPending,
    combatVictory,
    combatLoot,
    allCombatLootClaimed: allLootClaimed(combatLoot),
    eventLoot,
    allEventLootClaimed: allLootClaimed(eventLoot),
    enemyActionMessage,
    claimCombatLoot,
    claimEventLoot,
    completeTreasureEvent,
    abandonLockedDungeonChest,
    unlockDungeonChestWithKey,
    forceOpenDungeonChest,
    dungeonChestUnlocked,
    chestMessage,
    dismissCombatVictory,
    hero,
    generateIsland,
    renderIslandName,
    renderDungeonName: renderDungeonNameStable,
    handleSailOrExplore,
    startSailFromShip,
    returnToShipFromIsland,
    anchorAtDiscoveredIsland,
    abandonDiscoveredIsland,
    enterCurrentDungeon,
    returnToIslandFromDungeon,
    resolveDungeonDiscovery,
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
    leaveRest,
    restMessage,
    illuminatedAreas,
    currentIndoorArea,
    setCurrentIndoorArea,
    itemMessage,
    useItem,
    clearItemMessage,
    shopMessage,
    buyShopItem,
    sellShopItem,
    sellShopEquipment,
    leaveShop,
    clearShopMessage,
    updateHeroEquipment,
  };
}
