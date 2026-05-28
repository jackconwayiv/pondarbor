import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";

type GameStateTypes =
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

type GameLocationTypes = "ship" | "island";

type IslandType = {
  name: string;
  size: "Small" | "Large" | null;
  vibe: "Inviting" | "Foreboding" | null;
};

type HeroType = {
  name: string;
  class: string;
  current_hp: number;
  max_hp: number;
  gold: number;
  deck: {
    name: string;
    minDamage: number;
    maxDamage: number;
  }[];
};

type WorldPanelProps = {
  gameState: GameStateTypes;
  setGameState: React.Dispatch<React.SetStateAction<GameStateTypes>>;

  location: GameLocationTypes;
  setLocation: React.Dispatch<React.SetStateAction<GameLocationTypes>>;

  currentIsland: IslandType | null;
  setCurrentIsland: React.Dispatch<React.SetStateAction<IslandType | null>>;

  generateIsland: () => IslandType;
  renderIslandName: (island: IslandType) => string;
};

export const WorldPanel = ({
  gameState,
  setGameState,
  location,
  setLocation,
  currentIsland,
  setCurrentIsland,
  generateIsland,
  renderIslandName,
}: WorldPanelProps) => {
  switch (gameState) {
    case "lobby":
      return (
        <VStack align="start" gap={4}>
          <Heading>🏴‍☠️ Shanties & Squalls</Heading>

          <Text>
            Welcome to the voyage. Gather your crew, brave the storms, and chase
            fortune across dangerous seas.
          </Text>

          <Button onClick={() => setGameState("home")}>Begin Adventure</Button>
        </VStack>
      );

    case "home":
      return (
        <VStack align="start" gap={4}>
          <Heading size="lg">
            {location === "ship"
              ? "🚢 Your Ship"
              : `🏝️ ${
                  currentIsland
                    ? renderIslandName(currentIsland)
                    : "Unknown Island"
                }`}
          </Heading>

          <HStack wrap="wrap" gap={3}>
            {location === "ship" && (
              <>
                <Button onClick={() => setGameState("shop")}>Shop</Button>

                <Button onClick={() => setGameState("rest")}>Rest</Button>

                <Button
                  colorScheme="blue"
                  onClick={() => {
                    setGameState("sail");
                    setCurrentIsland(null);
                  }}
                >
                  Sail
                </Button>
              </>
            )}

            {location === "island" && (
              <>
                <Button onClick={() => setGameState("explore")}>Explore</Button>

                <Button
                  onClick={() => {
                    setLocation("ship");
                    setGameState("home");
                  }}
                >
                  Return to Ship
                </Button>
              </>
            )}

            {location === "ship" && currentIsland && (
              <Button
                onClick={() => {
                  setLocation("island");
                  setGameState("home");
                }}
              >
                Visit Island
              </Button>
            )}

            <Button variant="outline" onClick={() => setGameState("lobby")}>
              Quit
            </Button>
          </HStack>
        </VStack>
      );

    case "sail":
      return (
        <VStack align="start" gap={4}>
          <Heading>🌊 Sailing the Open Sea</Heading>

          <Text>
            The horizon stretches endlessly. Danger and discovery await.
          </Text>

          <HStack wrap="wrap" gap={3}>
            <Button onClick={() => setGameState("battle")}>Fight</Button>

            <Button onClick={() => setGameState("event")}>Event</Button>

            <Button
              onClick={() => {
                setCurrentIsland(generateIsland());
                setLocation("island");
                setGameState("home");
              }}
            >
              Discover Island
            </Button>

            <Button onClick={() => setGameState("home")}>Return</Button>
          </HStack>
        </VStack>
      );

    case "battle":
      return (
        <VStack align="start" gap={4}>
          <Heading>⚔️ Battle!</Heading>

          <HStack>
            <Button onClick={() => setGameState("win")}>Win</Button>

            <Button onClick={() => setGameState("dead")}>Die</Button>

            <Button onClick={() => setGameState("home")}>Retreat</Button>
          </HStack>
        </VStack>
      );

    case "event":
      return (
        <VStack align="start" gap={4}>
          <Heading>⛈️ Random Event</Heading>

          <Text>Something unexpected happens on your journey.</Text>

          <Button onClick={() => setGameState("home")}>Resolve</Button>
        </VStack>
      );

    case "shop":
      return (
        <VStack align="start" gap={4}>
          <Heading>💰 Shop</Heading>

          <Button onClick={() => setGameState("home")}>Back</Button>
        </VStack>
      );

    case "rest":
      return (
        <VStack align="start" gap={4}>
          <Heading>💤 Resting</Heading>

          <Button onClick={() => setGameState("home")}>Wake Up</Button>
        </VStack>
      );

    case "explore":
      return (
        <VStack align="start" gap={4}>
          <Heading>🗺️ Exploring the Island</Heading>

          <HStack>
            <Button onClick={() => setGameState("battle")}>Fight</Button>

            <Button onClick={() => setGameState("event")}>Event</Button>

            <Button onClick={() => setGameState("home")}>Return</Button>
          </HStack>
        </VStack>
      );

    case "win":
      return (
        <VStack align="start" gap={4}>
          <Heading>🏆 Victory!</Heading>

          <Button onClick={() => setGameState("home")}>Continue</Button>
        </VStack>
      );

    case "dead":
      return (
        <VStack align="start" gap={4}>
          <Heading>☠️ You Died</Heading>

          <Button
            onClick={() => {
              setLocation("ship");
              setCurrentIsland(null);
              setGameState("lobby");
            }}
          >
            Return to Lobby
          </Button>
        </VStack>
      );

    default:
      return (
        <Box>
          <Heading>Lost at Sea</Heading>

          <Button mt={4} onClick={() => setGameState("lobby")}>
            Return Home
          </Button>
        </Box>
      );
  }
};

type PlayerPanelProps = {
  hero: HeroType;
  gameState: GameStateTypes;
  location: GameLocationTypes;
};

export const PlayerPanel = ({
  hero,
  gameState,
  location,
}: PlayerPanelProps) => {
  return (
    <VStack align="start" gap={4}>
      <Box>
        <Heading size="md">
          {hero.name} — {hero.class}
        </Heading>

        <Text fontSize="sm">Captain of the current expedition</Text>
      </Box>

      <HStack wrap="wrap" gap={3}>
        <Badge p={2}>
          ❤️ HP: {hero.current_hp}/{hero.max_hp}
        </Badge>

        <Badge p={2}>💰 Gold: {hero.gold}</Badge>

        <Badge p={2}>🃏 Deck: {hero.deck.length}</Badge>

        <Badge p={2}>📍 {location}</Badge>
      </HStack>

      <Box w="100%">
        <Text fontWeight="bold" mb={2}>
          Current State
        </Text>

        <Badge colorScheme="purple" p={2}>
          {gameState}
        </Badge>
      </Box>
    </VStack>
  );
};
