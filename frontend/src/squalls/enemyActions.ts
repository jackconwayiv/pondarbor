import { rollD4 } from "./combatRules";
import type {
  EnemyAction,
  EnemyBroadcast,
  EnemyTrait,
  EnemyType,
} from "./shantiesTypes";

export function actionToBroadcast(action: EnemyAction): EnemyBroadcast {
  switch (action) {
    case "attack":
      return "attack";
    case "defend":
      return "defend";
    case "evade":
      return "buff";
    case "electrify":
      return "buff";
    case "weaken":
      return "debuff";
  }
}

export function formatEnemyBroadcastLabel(broadcast: EnemyBroadcast): string {
  switch (broadcast) {
    case "attack":
      return "Attack";
    case "defend":
      return "Defend";
    case "buff":
      return "Buff";
    case "debuff":
      return "Debuff";
  }
}

export function enemyBroadcastColor(broadcast: EnemyBroadcast): string {
  switch (broadcast) {
    case "attack":
      return "red.700";
    case "defend":
      return "blue.700";
    case "buff":
      return "purple.700";
    case "debuff":
      return "orange.700";
  }
}

/** 5 Attack, 3 Defend, 1 Evade, 1 Weaken. */
export function createStandardEnemyActionDeck(): EnemyAction[] {
  return [
    ...Array.from({ length: 5 }, () => "attack" as const),
    ...Array.from({ length: 3 }, () => "defend" as const),
    "evade",
    "weaken",
  ];
}

const BUFF_ENEMY_ACTIONS: readonly EnemyAction[] = ["evade", "electrify"];

export const BUFF_ON_TOP_START_CHANCE = 0.5;

export function isBuffEnemyAction(action: EnemyAction): boolean {
  return BUFF_ENEMY_ACTIONS.includes(action);
}

export function deckHasBuffAction(deck: readonly EnemyAction[]): boolean {
  return deck.some(isBuffEnemyAction);
}

export function formatEnemyActionDeckSummary(deck: readonly EnemyAction[]): string {
  const counts = new Map<string, number>();
  for (const action of deck) {
    const label = action.charAt(0).toUpperCase() + action.slice(1);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([action, count]) => `${count}× ${action}`)
    .join(", ");
}

/** Electric Eel swaps Evade for Electrify (grants Shocking instead of Evasive). */
export function createEnemyActionDeckForMonster(monsterName: string): EnemyAction[] {
  switch (monsterName) {
    case "Boar":
    case "Skeleton":
      return [
        ...Array.from({ length: 6 }, () => "attack" as const),
        ...Array.from({ length: 4 }, () => "defend" as const),
      ];
    case "Bat":
      return [
        ...Array.from({ length: 6 }, () => "attack" as const),
        ...Array.from({ length: 3 }, () => "defend" as const),
        "evade",
      ];
    case "Wolf":
      return [
        ...Array.from({ length: 6 }, () => "attack" as const),
        ...Array.from({ length: 3 }, () => "defend" as const),
        "weaken",
      ];
    case "Electric Eel":
      return [
        ...Array.from({ length: 5 }, () => "attack" as const),
        ...Array.from({ length: 3 }, () => "defend" as const),
        "electrify",
        "weaken",
      ];
    default:
      return createStandardEnemyActionDeck();
  }
}

function prepareInitialEnemyDrawPile(deck: EnemyAction[]): EnemyAction[] {
  const shuffled = shuffleEnemyActions([...deck]);
  if (!deckHasBuffAction(deck) || Math.random() >= BUFF_ON_TOP_START_CHANCE) {
    return shuffled;
  }
  const buffIndex = shuffled.findIndex(isBuffEnemyAction);
  if (buffIndex <= 0) return shuffled;
  const [buff] = shuffled.splice(buffIndex, 1);
  shuffled.unshift(buff!);
  return shuffled;
}

function shuffleEnemyActions(actions: EnemyAction[]): EnemyAction[] {
  const result = [...actions];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function drawOneEnemyAction(
  drawPile: EnemyAction[],
  discardPile: EnemyAction[],
): {
  drawPile: EnemyAction[];
  discardPile: EnemyAction[];
  drawn: EnemyAction | null;
} {
  let draw = [...drawPile];
  let discard = [...discardPile];
  if (draw.length === 0) {
    if (discard.length === 0) return { drawPile: draw, discardPile: discard, drawn: null };
    draw = shuffleEnemyActions(discard);
    discard = [];
  }
  const drawn = draw.shift() ?? null;
  return { drawPile: draw, discardPile: discard, drawn };
}

export function initializeEnemyActionDeck(
  enemy: Omit<
    EnemyType,
    "broadcast" | "nextAction" | "actionDrawPile" | "actionDiscardPile"
  >,
): EnemyType {
  const deck = createEnemyActionDeckForMonster(enemy.name);
  const drawPile = prepareInitialEnemyDrawPile(deck);
  const { drawPile: remainingDraw, discardPile, drawn } = drawOneEnemyAction(
    drawPile,
    [],
  );
  const nextAction = drawn ?? "attack";
  return {
    ...enemy,
    nextAction,
    broadcast: actionToBroadcast(nextAction),
    actionDrawPile: remainingDraw,
    actionDiscardPile: discardPile,
  };
}

function cycleEnemyAfterAction(enemy: EnemyType): EnemyType {
  const discard = [...enemy.actionDiscardPile, enemy.nextAction];
  const { drawPile, discardPile, drawn } = drawOneEnemyAction(
    enemy.actionDrawPile,
    discard,
  );
  const nextAction = drawn ?? "attack";
  return {
    ...enemy,
    nextAction,
    broadcast: actionToBroadcast(nextAction),
    actionDrawPile: drawPile,
    actionDiscardPile: discardPile,
  };
}

function grantShockingTrait(
  traits: readonly EnemyTrait[] | undefined,
): readonly EnemyTrait[] {
  if (traits?.includes("shocking")) return traits;
  return [...(traits ?? []), "shocking"];
}

function grantEvasiveTrait(
  traits: readonly EnemyTrait[] | undefined,
): readonly EnemyTrait[] {
  return [...(traits ?? []), "evasive"];
}

export function applyWeakenedToDamage(
  rawDamage: number,
  heroWeakened: boolean,
): number {
  if (!heroWeakened) return rawDamage;
  return Math.max(1, rawDamage - 1);
}

export function executeEnemyAction(
  enemy: EnemyType,
  heroName: string,
  heroHp: number,
  playerArmor: number,
  heroWeakened: boolean,
): {
  enemy: EnemyType;
  heroHp: number;
  playerArmor: number;
  heroWeakened: boolean;
  message: string;
} {
  const action = enemy.nextAction;

  if (action === "defend") {
    const gained = rollD4();
    const updated = {
      ...enemy,
      armor: enemy.armor + gained,
    };
    return {
      enemy: cycleEnemyAfterAction(updated),
      heroHp,
      playerArmor,
      heroWeakened,
      message: `${enemy.name} defends and gains ${gained} armor.`,
    };
  }

  if (action === "evade") {
    const updated = {
      ...enemy,
      traits: grantEvasiveTrait(enemy.traits),
    };
    return {
      enemy: cycleEnemyAfterAction(updated),
      heroHp,
      playerArmor,
      heroWeakened,
      message: `${enemy.name} takes an evasive stance.`,
    };
  }

  if (action === "electrify") {
    const updated = {
      ...enemy,
      traits: grantShockingTrait(enemy.traits),
    };
    return {
      enemy: cycleEnemyAfterAction(updated),
      heroHp,
      playerArmor,
      heroWeakened,
      message: `${enemy.name} electrifies the water!`,
    };
  }

  if (action === "weaken") {
    return {
      enemy: cycleEnemyAfterAction(enemy),
      heroHp,
      playerArmor,
      heroWeakened: true,
      message: `${enemy.name} weakens ${heroName}!`,
    };
  }

  const damage = rollD4();
  const armorBroken = Math.min(playerArmor, damage);
  const damageDealt = Math.max(0, damage - armorBroken);
  return {
    enemy: cycleEnemyAfterAction(enemy),
    heroHp: Math.max(0, heroHp - damageDealt),
    playerArmor: playerArmor - armorBroken,
    heroWeakened,
    message: formatEnemyAttackLog(enemy.name, heroName, armorBroken, damageDealt),
  };
}

function formatEnemyAttackLog(
  attackerName: string,
  targetName: string,
  armorBroken: number,
  damageDealt: number,
): string {
  if (armorBroken > 0 && damageDealt > 0) {
    return `${attackerName} attacked ${targetName}, broke ${armorBroken} armor, and dealt ${damageDealt} damage.`;
  }
  if (armorBroken > 0) {
    return `${attackerName} attacked ${targetName} and broke ${armorBroken} armor.`;
  }
  if (damageDealt > 0) {
    return `${attackerName} attacked ${targetName} and dealt ${damageDealt} damage.`;
  }
  return `${attackerName} attacked ${targetName} (no effect).`;
}

const ENEMY_ACTIONS: EnemyAction[] = [
  "attack",
  "defend",
  "evade",
  "electrify",
  "weaken",
];

export function normalizeEnemyAction(value: unknown): EnemyAction | null {
  return ENEMY_ACTIONS.includes(value as EnemyAction)
    ? (value as EnemyAction)
    : null;
}

export function normalizeEnemyActionPile(raw: unknown): EnemyAction[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => normalizeEnemyAction(entry))
    .filter((action): action is EnemyAction => action !== null);
}

export function normalizeEnemyBroadcast(value: unknown): EnemyBroadcast | null {
  if (
    value === "attack" ||
    value === "defend" ||
    value === "buff" ||
    value === "debuff"
  ) {
    return value;
  }
  return null;
}
