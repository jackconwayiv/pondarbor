import React from "react";

import type { ReactNode } from "react";

export type GameShellProps = {
  world: ReactNode;
  player: ReactNode;
  gameState: GameStateTypes;
  location: GameLocationTypes;
};

/* =========================
   CORE GAME STATE TYPES
========================= */

export type GameStateTypes =
  | "lobby"
  | "shop"
  | "home"
  | "battle"
  | "rest"
  | "explore"
  | "event"
  | "sail"
  | "win"
  | "dead";

export type GameLocationTypes = "ship" | "island";

/* =========================
   ISLAND TYPES
========================= */

export type IslandType = {
  name: string;
  size: "Small" | "Large" | null;
  vibe: "Inviting" | "Foreboding" | null;
};

/* =========================
   HERO / PLAYER TYPES
========================= */

export type CardType = {
  name: string;
  minDamage: number;
  maxDamage: number;
};

export type HeroType = {
  name: string;
  class: string;
  current_hp: number;
  max_hp: number;
  gold: number;
  deck: CardType[];
};

/* =========================
   WORLD PANEL PROPS
========================= */

export type WorldPanelProps = {
  gameState: GameStateTypes;
  setGameState: React.Dispatch<React.SetStateAction<GameStateTypes>>;

  location: GameLocationTypes;
  setLocation: React.Dispatch<React.SetStateAction<GameLocationTypes>>;

  currentIsland: IslandType | null;
  setCurrentIsland: React.Dispatch<React.SetStateAction<IslandType | null>>;

  generateIsland: () => IslandType;
  renderIslandName: (island: IslandType) => string;
};

/* =========================
   PLAYER PANEL PROPS
========================= */

export type PlayerPanelProps = {
  hero: HeroType;
  gameState: GameStateTypes;
  location: GameLocationTypes;
};

/* =========================
   OPTIONAL: GAME CONTEXT TYPE
   (useful if you later move to useReducer/Context)
========================= */

export type GameContextType = {
  gameState: GameStateTypes;
  setGameState: React.Dispatch<React.SetStateAction<GameStateTypes>>;

  location: GameLocationTypes;
  setLocation: React.Dispatch<React.SetStateAction<GameLocationTypes>>;

  currentIsland: IslandType | null;
  setCurrentIsland: React.Dispatch<React.SetStateAction<IslandType | null>>;
};
