import { useState } from "react";
import GameShell from "./GameShell";
import PlayerPanel from "./PlayerPanel";
import WorldPanel from "./WorldPanel";

import type {
  GameLocationTypes,
  GameStateTypes,
  IslandType,
} from "./shantiesTypes";

export default function ShantiesHome() {
  const [gameState, setGameState] = useState<GameStateTypes>("lobby");

  const [location, setLocation] = useState<GameLocationTypes>("ship");

  const [currentIsland, setCurrentIsland] = useState<IslandType | null>(null);

  const hero = {
    name: "Silver",
    class: "Swashbuckler",
    current_hp: 20,
    max_hp: 20,
    gold: 50,
    deck: [],
  };

  const generateIsland = (): IslandType => ({
    name: "Foggy Isle",
    size: "Large",
    vibe: "Foreboding",
  });

  const renderIslandName = (i: IslandType) =>
    `${i.size ? i.size + ", " : ""}${i.vibe ? i.vibe + " " : ""}${i.name}`;

  return (
    <GameShell
      gameState={gameState}
      location={location}
      world={
        <WorldPanel
          gameState={gameState}
          setGameState={setGameState}
          location={location}
          setLocation={setLocation}
          currentIsland={currentIsland}
          setCurrentIsland={setCurrentIsland}
          generateIsland={generateIsland}
          renderIslandName={renderIslandName}
        />
      }
      player={
        <PlayerPanel hero={hero} gameState={gameState} location={location} />
      }
    />
  );
}
