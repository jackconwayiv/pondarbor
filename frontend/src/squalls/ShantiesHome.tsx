import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";
import { useState } from "react";

const getRandomEvent = () => {
  const levelOneEventDeck = [
    { name: "Smooth Sailing", type: "neutral" },
    { name: "Storm!", type: "hazard" },
    { name: "Discover an Island!", type: "discovery" },
  ];

  return levelOneEventDeck[
    Math.floor(Math.random() * levelOneEventDeck.length)
  ];
};

const getIslandEvent = () => {
  const islandEvents = [
    { name: "Ancient Temple", type: "site" },
    { name: "Hidden Treasure", type: "neutral" },
    { name: "Wild Supplies", type: "neutral" },
  ];
  return islandEvents[Math.floor(Math.random() * islandEvents.length)];
};

const isBattle = () => {
  return Math.random() < 0.5;
};

const rollDie = () => {
  return Math.random();
};

const ShantiesHome = () => {
  type GameStateTypes =
    | "lobby"
    | "shop"
    | "home"
    | "battle"
    | "rest"
    | "event"
    | "sail"
    | "win"
    | "dead";
  type GameLocationTypes = "ship" | "island";

  type IslandType = {
    name: string;
    size: "Small" | "Large" | null;
    vibe: "Inviting" | "Foreboding" | null;
    explorePoints: number;
    levelFactor: number;
  };

  type EventType = {
    name: string;
    type: string;
  };

  type enemyType = { name: string; level: number; hp: number };

  const [gameState, setGameState] = useState<GameStateTypes>("lobby");
  const [location, setLocation] = useState<GameLocationTypes>("ship");
  const [currentIsland, setCurrentIsland] = useState<IslandType | null>(null);
  const [enemies, setEnemies] = useState<enemyType[]>([]);
  const [activeEvent, setActiveEvent] = useState<EventType | null>(null);
  const [day, setDay] = useState<number>(1);
  const [hand, setHand] = useState<cardType[]>([]);
  const [selectedCard, setSelectedCard] = useState<any | null>(null);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  //derive month as a set of 30 days, and year as a set of 360 days
  //so display would say "Year 1, Month 1, Day 1"
  const attackCard = { name: "Attack", minDamage: 1, maxDamage: 4 };
  const strongAttackCard = {
    name: "Strong Attack",
    minDamage: 2,
    maxDamage: 8,
  };
  const retreatCard = { name: "Retreat" };
  const defendCard = { name: "Defend" };

  const startDeck = [
    attackCard,
    attackCard,
    attackCard,
    attackCard,
    attackCard,
    strongAttackCard,
    strongAttackCard,
    retreatCard,
    retreatCard,
    defendCard,
  ];

  const rollDamage = (min: number, max: number) => {
    return Math.floor(rollDie() * (max - min + 1)) + min;
  };

  const handleCombatRound = (targetIndex?: number) => {
    if (!selectedCard) return;

    let updatedEnemies = [...enemies];
    let log: string[] = [];

    // HERO ACTION
    if (
      selectedCard.name === "Attack" ||
      selectedCard.name === "Strong Attack"
    ) {
      if (targetIndex === undefined) return;

      const damage = rollDamage(selectedCard.minDamage, selectedCard.maxDamage);

      updatedEnemies[targetIndex].hp -= damage;

      log.push(
        `${hero.name} used ${selectedCard.name} on ${updatedEnemies[targetIndex].name} for ${damage} damage`,
      );
    }

    if (selectedCard.name === "Retreat") {
      setGameState("home");
      return;
    }

    if (selectedCard.name === "Defend") {
      log.push(`${hero.name} braces for impact`);
    }

    // remove dead enemies
    updatedEnemies = updatedEnemies.filter((enemy) => enemy.hp > 0);

    // WIN CHECK
    if (updatedEnemies.length === 0) {
      setEnemies([]);
      setCombatLog(log);
      setGameState("win");
      return;
    }

    // ENEMY ACTIONS
    let heroHp = Number(hero.current_hp);

    updatedEnemies.forEach((enemy) => {
      heroHp -= 1;
      log.push(`${enemy.name} attacks for 1 damage`);
    });

    if (heroHp <= 0) {
      setCombatLog(log);
      setGameState("dead");
      return;
    }

    // draw replacement hand
    const shuffledDeck = [...hero.deck].sort(() => Math.random() - 0.5);
    setHand(shuffledDeck.slice(0, 3));

    setEnemies(updatedEnemies);
    setSelectedCard(null);
    setCombatLog(log);
  };

  const hero = {
    name: "Silver",
    class: "Swashbuckler",
    current_hp: "20",
    max_hp: "20",
    deck: startDeck,
  };

  const handleSailOrExplore = () => {
    if (isBattle()) {
      if (location === "island") {
        initiateIslandBattle();
      } else {
        initiateBattle(); // Your existing sea monster logic
      }
    } else {
      // Determine which event deck to use
      const drawn = location === "island" ? getIslandEvent() : getRandomEvent();
      setActiveEvent(drawn);

      // Only sea events can "discover" new islands
      if (location === "ship" && drawn.type === "discovery") {
        setCurrentIsland(generateIsland());
      }
      setGameState("event");
    }
  };

  const initiateIslandBattle = () => {
    const monsterPool = [
      { name: "Boar", level: 1, hp: 4 },
      { name: "Wolf", level: 1, hp: 5 },
    ];
    const count = Math.floor(Math.random() * 2) + 1;
    const selected = Array.from({ length: count }, () => ({
      ...monsterPool[Math.floor(Math.random() * monsterPool.length)],
    }));
    setEnemies(selected);
    const shuffledDeck = [...hero.deck].sort(() => Math.random() - 0.5);
    setHand(shuffledDeck.slice(0, 3));
    setSelectedCard(null);
    setCombatLog([]);
    setGameState("battle");
  };

  const initiateBattle = () => {
    const monster1 = { name: "Harpy", level: 1, hp: 6 };
    const monster2 = { name: "Siren", level: 1, hp: 5 };
    const levelOneMonsterArray = [monster1, monster2];

    // Determine if we face 1 or 2 monsters
    const monsterCount = Math.floor(Math.random() * 2) + 1;
    const selectedMonsters = [];

    for (let i = 0; i < monsterCount; i++) {
      // Pick a random monster from the pool
      const randomIndex = Math.floor(
        Math.random() * levelOneMonsterArray.length,
      );
      // Use the spread operator {...} to create a fresh copy so they have their own HP
      selectedMonsters.push({ ...levelOneMonsterArray[randomIndex] });
    }

    // 2. Save the monsters to state and change the view
    setEnemies(selectedMonsters);
    const shuffledDeck = [...hero.deck].sort(() => Math.random() - 0.5);
    setHand(shuffledDeck.slice(0, 3));
    setSelectedCard(null);
    setCombatLog([]);
    setGameState("battle");
  };

  const generateIsland = () => {
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

    // Logic for Vibe (15% Foreboding, 15% Inviting, else null)
    let vibe: IslandType["vibe"] = null;
    if (roll < 0.15) vibe = "Foreboding";
    else if (roll < 0.3) vibe = "Inviting";

    // Logic for Size (30% Small, 30% Large, else null)
    const sizeRoll = Math.random();
    let size: IslandType["size"] = null;
    if (sizeRoll < 0.3) size = "Small";
    else if (sizeRoll < 0.6) size = "Large";
    let explorePoints = 5;
    if (size === "Small") explorePoints = explorePoints - 2;
    if (size === "Large") explorePoints = explorePoints + 2;
    let levelFactor = 0;
    if (vibe === "Foreboding") levelFactor = levelFactor + 1;
    if (vibe === "Inviting") levelFactor = levelFactor - 1;

    const name = `${weatherList[Math.floor(Math.random() * weatherList.length)]} ${
      isleList[Math.floor(Math.random() * isleList.length)]
    } of ${attributeList[Math.floor(Math.random() * attributeList.length)]}`;

    return { name, size, explorePoints, levelFactor, vibe };
  };

  const renderIslandName = (currentIsland: IslandType) => {
    let fullIslandName = "";
    if (currentIsland.size) fullIslandName += currentIsland.size + ", ";
    if (currentIsland.vibe) fullIslandName += currentIsland.vibe + " ";
    fullIslandName += currentIsland.name;
    return fullIslandName;
  };

  return (
    <Box
      minH="100vh"
      bg={location === "island" ? "yellow.200" : "blue.200"}
      color="black"
    >
      <Text paddingTop={4} paddingLeft={4}>
        Day {day} | Welcome {hero.name} the {hero.class}!
      </Text>

      {(() => {
        // 1. Define the object
        const views: Record<GameStateTypes, React.ReactNode> = {
          lobby: (
            <Box padding="4">
              <Heading mb="4">🏴‍☠️ Squalls & Shanties</Heading>
              <Text mb="4">Welcome to an adventure!</Text>
              <Button
                onClick={() => {
                  setGameState("home");
                }}
              >
                Begin Adventure
              </Button>
            </Box>
          ),
          home: (
            <Box padding="4">
              {location === "ship" ? (
                <Heading mb="4">🚢 Ye Be on the Ship</Heading>
              ) : (
                <Heading mb="4">
                  🏝️{" "}
                  {currentIsland
                    ? renderIslandName(currentIsland)
                    : "Unknown Island"}
                </Heading>
              )}

              <HStack gap={2}>
                {location === "ship" && (
                  <>
                    <Button onClick={() => setGameState("shop")}>Shop</Button>
                    <Button onClick={() => setGameState("rest")}>Rest</Button>
                  </>
                )}

                {location === "island" && (
                  <>
                    <Button onClick={handleSailOrExplore}>Explore</Button>
                  </>
                )}
                {/* How to handle accessing ship functions while on island */}
                {location === "island" && (
                  <>
                    <Button
                      onClick={() => {
                        setGameState("home");
                        setLocation("ship");
                      }}
                    >
                      Ship
                    </Button>
                  </>
                )}
                {location === "ship" && currentIsland !== null && (
                  <>
                    <Button
                      onClick={() => {
                        setGameState("home");
                        setLocation("island");
                      }}
                    >
                      Island
                    </Button>
                  </>
                )}

                {location === "ship" && (
                  <Button
                    onClick={() => {
                      setLocation("ship");
                      setCurrentIsland(null);
                      handleSailOrExplore();
                    }}
                  >
                    Sail
                  </Button>
                )}
                <Button onClick={() => setGameState("lobby")}>Quit</Button>
              </HStack>
            </Box>
          ),
          shop: (
            <Box padding="4">
              <Heading mb="4">💰 Ye Be Shopping</Heading>
              <Button onClick={() => setGameState("home")}>Back</Button>
            </Box>
          ),
          event: (
            <Box padding="4">
              <Heading mb="4">⛈️ {activeEvent?.name}</Heading>

              {activeEvent?.type === "discovery" ? (
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
                    <Button
                      colorScheme="teal"
                      onClick={() => {
                        setLocation("island");
                        setGameState("home");
                        setActiveEvent(null);
                        setDay(day + 1);
                      }}
                    >
                      Anchor at Island
                    </Button>
                    <Button
                      onClick={() => {
                        setCurrentIsland(null); // Clear it if they skip it
                        setGameState("home");
                        setActiveEvent(null);
                        setDay(day + 1);
                      }}
                    >
                      Keep Sailing
                    </Button>
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
                    colorScheme="blue"
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
            </Box>
          ),
          win: (
            <Box padding="4">
              <Heading mb="4">🪎 Ye Have Won Combat</Heading>
              <Button
                onClick={() => {
                  setGameState("home");
                  setDay(day + 1);
                }}
              >
                Back
              </Button>
            </Box>
          ),
          battle: (
            <Box padding="4">
              <Heading mb="4">⚔️ Ye Be in Battle!</Heading>

              <Text mb={4}>Hero HP: {hero.current_hp}</Text>

              <Heading size="md" mb={2}>
                Enemies
              </Heading>

              <HStack gap={4} mb={6}>
                {enemies.map((enemy, index) => (
                  <Box
                    key={index}
                    p={4}
                    border="1px"
                    borderColor="red.500"
                    borderRadius="md"
                  >
                    <Text fontWeight="bold">{enemy.name}</Text>
                    <Text>HP: {enemy.hp}</Text>

                    {selectedCard &&
                      (selectedCard.name === "Attack" ||
                        selectedCard.name === "Strong Attack") && (
                        <Button
                          size="sm"
                          mt={2}
                          onClick={() => handleCombatRound(index)}
                        >
                          Target
                        </Button>
                      )}
                  </Box>
                ))}
              </HStack>

              <Heading size="md" mb={2}>
                Your Hand
              </Heading>

              <HStack gap={2} mb={4}>
                {hand.map((card, index) => (
                  <Button
                    key={index}
                    onClick={() => {
                      setSelectedCard(card);

                      if (card.name === "Retreat" || card.name === "Defend") {
                        handleCombatRound();
                      }
                    }}
                  >
                    {card.name}
                  </Button>
                ))}
              </HStack>

              {selectedCard && (
                <Text mb={4}>Selected: {selectedCard.name}</Text>
              )}

              <Box mt={6}>
                <Heading size="sm" mb={2}>
                  Combat Log
                </Heading>

                {combatLog.map((entry, index) => (
                  <Text key={index}>{entry}</Text>
                ))}
              </Box>
            </Box>
          ),
          dead: (
            <Box padding="4">
              <Heading mb="4">☠️ Ye Are Dead!</Heading>
              <Button
                onClick={() => {
                  setLocation("ship");
                  setCurrentIsland(null);
                  setGameState("lobby");
                  setDay(1);
                }}
              >
                Quit
              </Button>
            </Box>
          ),
          rest: (
            <Box padding="4">
              <Heading mb="4">💤 Ye Be Resting</Heading>
              <Button onClick={() => setGameState("home")}>Wake Up</Button>
            </Box>
          ),
          sail: (
            <Box padding="4">
              <Heading mb="4">🌊 Ye Be Sailing</Heading>
              <HStack gap={2}>
                <Button onClick={() => setGameState("battle")}>Fight</Button>
                <Button onClick={() => setGameState("event")}>Event</Button>
                <Button
                  onClick={() => {
                    setLocation("island");
                    setCurrentIsland(() => generateIsland());
                    setGameState("home");
                  }}
                >
                  Island
                </Button>
                <Button
                  onClick={() => {
                    setGameState("home");
                    setLocation("ship");
                  }}
                >
                  Ship
                </Button>
              </HStack>
            </Box>
          ),
        };

        return (
          views[gameState] || (
            <Box padding="4">
              <Heading mb="4">Ye Be Lost at sea</Heading>
              <Button onClick={() => setGameState("lobby")}>Return Home</Button>
            </Box>
          )
        );
      })()}
    </Box>
  );
};
export default ShantiesHome;
