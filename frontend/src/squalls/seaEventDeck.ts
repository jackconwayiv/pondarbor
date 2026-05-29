import type { EventType } from "./shantiesTypes";

const SEA_ISLAND_DISCOVERY: EventType = {
  name: "Discover an Island!",
  type: "discovery",
};

const SEA_COMBAT: EventType = {
  name: "Sea Combat",
  type: "combat",
};

const SEA_EVENT_POOL: EventType[] = [
  { name: "Storm!", type: "weather" },
  { name: "Fog Bank", type: "weather" },
  { name: "Merchant Ship", type: "merchant" },
  { name: "Floating Supplies", type: "treasure" },
  { name: "Shipwreck Dive", type: "shipwreck" },
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(items: T[]): T[] {
  const deck = [...items];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

/** Build a fresh 10-card sea deck: 4–6 combat, 1–2 island, remainder from the event pool. */
export function buildSeaEventDeck(): EventType[] {
  const combatCount = randomInt(4, 6);
  const islandCount = randomInt(1, 2);
  const remainder = 10 - combatCount - islandCount;
  const poolPicks: EventType[] = [];
  for (let i = 0; i < remainder; i++) {
    const template =
      SEA_EVENT_POOL[Math.floor(Math.random() * SEA_EVENT_POOL.length)]!;
    poolPicks.push({ ...template });
  }
  const deck: EventType[] = [
    ...Array.from({ length: combatCount }, () => ({ ...SEA_COMBAT })),
    ...Array.from({ length: islandCount }, () => ({ ...SEA_ISLAND_DISCOVERY })),
    ...poolPicks,
  ];
  return shuffle(deck);
}

export type DrawSeaEventResult = {
  drawn: EventType;
  remainingDeck: EventType[];
};

/** Pop the top card; auto-builds a new deck if empty. */
export function drawSeaEvent(deck: EventType[]): DrawSeaEventResult {
  let working = deck;
  if (working.length === 0) {
    working = buildSeaEventDeck();
  }
  const drawn = working[working.length - 1]!;
  return {
    drawn,
    remainingDeck: working.slice(0, -1),
  };
}

export function normalizeSeaEventDeck(raw: unknown): EventType[] {
  if (!Array.isArray(raw)) return [];
  const deck: EventType[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.name !== "string" || typeof record.type !== "string") {
      continue;
    }
    const dungeonKind =
      record.dungeonKind === "cave" ||
      record.dungeonKind === "ruins" ||
      record.dungeonKind === "temple" ||
      record.dungeonKind === "wreck"
        ? record.dungeonKind
        : undefined;
    deck.push({
      name: record.name,
      type: record.type,
      ...(dungeonKind ? { dungeonKind } : {}),
      ...(record.locked === true ? { locked: true } : {}),
    });
  }
  return deck;
}
