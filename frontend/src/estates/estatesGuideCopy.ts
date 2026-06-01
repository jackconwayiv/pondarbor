import { ZONE_ALLOWED_SUITS, type CanonicalSuit, type ZoneName } from "./estatesDropRules";

export const ESTATES_GUIDE_TITLE = "How to play Estates";

/** Zones in scoring order (matches backend). */
export const ESTATES_SCORING_ZONE_ORDER: readonly ZoneName[] = [
  "gate",
  "throne",
  "farm",
  "road",
  "tower",
] as const;

export const ZONE_LABELS: Record<ZoneName, string> = {
  farm: "FARM",
  gate: "GATE",
  road: "ROAD",
  throne: "THRONE",
  tower: "TOWER",
};

export const ZONE_SCORE_ORDER_HINTS: Record<ZoneName, string> = {
  gate: "Scored 1st",
  throne: "Scored 2nd",
  farm: "Scored 3rd",
  road: "Scored 4th",
  tower: "Scored 5th",
};

export const ZONE_SUIT_HINTS: Record<ZoneName, string> = {
  gate: "Any suit",
  farm: "Peasants only",
  road: "Peasants or nobles only",
  tower: "Nobles or royals only",
  throne: "Royals only",
};

export const ZONE_EFFECT_HINTS: Record<ZoneName, string> = {
  gate: "Give a card in play -1 this round",
  farm: "Permanent +1 to a card in hand",
  road: "Draw +2 cards next turn",
  tower: "Go second next round and discard any cards from hand you choose",
  throne: "Gain 1 point",
};

export type SuitGuideEntry = {
  suit: CanonicalSuit;
  name: string;
  colorLabel: string;
  demoCard: Record<string, unknown>;
};

export const ESTATES_SUIT_GUIDE: readonly SuitGuideEntry[] = [
  {
    suit: "peasant",
    name: "Peasant",
    colorLabel: "Green",
    demoCard: {
      card_id: "guide-peasant-3",
      suit: "peasant",
      color: "green",
      rank: 3,
      temporary_value_modifier: 0,
      permanent_value_bonus: 0,
    },
  },
  {
    suit: "noble",
    name: "Noble",
    colorLabel: "Blue",
    demoCard: {
      card_id: "guide-noble-3",
      suit: "noble",
      color: "blue",
      rank: 3,
      temporary_value_modifier: 0,
      permanent_value_bonus: 0,
    },
  },
  {
    suit: "royal",
    name: "Royal",
    colorLabel: "Gold",
    demoCard: {
      card_id: "guide-royal-3",
      suit: "royal",
      color: "yellow",
      rank: 3,
      temporary_value_modifier: 0,
      permanent_value_bonus: 0,
    },
  },
] as const;

export const ESTATES_SUIT_STRENGTH_LINE = "On a tie, Royals beat Nobles beat Peasants.";

export type ZoneGuideEntry = {
  zone: ZoneName;
  scoringStep: number;
  allowedSuits: readonly CanonicalSuit[];
};

const ZONE_GUIDE_SUIT_ORDER: readonly CanonicalSuit[] = ["peasant", "noble", "royal"];

export const ESTATES_ZONE_GUIDE: readonly ZoneGuideEntry[] = ESTATES_SCORING_ZONE_ORDER.map(
  (zone, index) => ({
    zone,
    scoringStep: index + 1,
    allowedSuits: ZONE_GUIDE_SUIT_ORDER.filter((suit) => ZONE_ALLOWED_SUITS[zone].has(suit)),
  }),
);

export const ESTATES_GUIDE_SECTIONS = {
  goal: {
    heading: "Goal",
    body: "Be the first to 7 points. All points come from the Throne: reaching 7 points ends the game immediately.",
  },
  round: {
    heading: "Each round",
    body: "Both players start with 5 cards. Each player takes turns playing 1 card, at most one card per zone, 3 times per round. After scoring, each player draws back up to 5 (keep any cards still in hand).",
    roadNote: "Winning the Tower lets you choose any cards from your hand you wish to discard. Winning the Road lets you draw 2 extra cards at the start of the next round.",
  },
  suits: {
    heading: "Cards & suits",
    intro: "Each card has a rank (1–5) and a suit. Higher total value wins the zone.",
    tiebreak: ESTATES_SUIT_STRENGTH_LINE,
    bonuses: "Temporary -1 on the board and permanent +1 stars on cards count toward value.",
  },
  zones: {
    heading: "Zones",
    intro: "Play only allowed suits in each zone. Zones are scored in order after all six cards are placed.",
  },
} as const;
