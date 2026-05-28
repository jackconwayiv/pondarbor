import { Box, Button, Heading, HStack, VStack } from "@chakra-ui/react";
import type { WorldPanelProps } from "./shantiesTypes";

export default function WorldPanel({
  gameState,
  setGameState,
  location,
  setLocation,
  currentIsland,
  setCurrentIsland,
  generateIsland,
  renderIslandName,
}: WorldPanelProps) {
  switch (gameState) {
    case "lobby":
      return (
        <VStack align="start" gap={4}>
          <Heading>🏴‍☠️ Shanties & Squalls</Heading>

          <Button onClick={() => setGameState("home")}>Begin Adventure</Button>
        </VStack>
      );

    case "home":
      return (
        <VStack align="start" gap={4}>
          <Heading>
            {location === "ship"
              ? "🚢 Ship"
              : currentIsland
                ? renderIslandName(currentIsland)
                : "Island"}
          </Heading>

          <HStack gap={3} wrap="wrap">
            {location === "ship" && (
              <>
                <Button onClick={() => setGameState("shop")}>Shop</Button>

                <Button onClick={() => setGameState("rest")}>Rest</Button>

                <Button colorScheme="blue" onClick={() => setGameState("sail")}>
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
          </HStack>
        </VStack>
      );

    case "sail":
      return (
        <VStack align="start" gap={4}>
          <Heading>🌊 Sailing the Open Sea</Heading>

          <HStack gap={3}>
            <Button onClick={() => setGameState("battle")}>Fight</Button>

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
          <Heading>⚔️ Battle</Heading>

          <HStack>
            <Button onClick={() => setGameState("win")}>Win</Button>

            <Button onClick={() => setGameState("dead")}>Die</Button>

            <Button onClick={() => setGameState("home")}>Retreat</Button>
          </HStack>
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
          <Heading>🗺️ Explore</Heading>

          <HStack>
            <Button onClick={() => setGameState("battle")}>Fight</Button>

            <Button onClick={() => setGameState("event")}>Event</Button>

            <Button onClick={() => setGameState("home")}>Return</Button>
          </HStack>
        </VStack>
      );

    case "event":
      return (
        <VStack align="start" gap={4}>
          <Heading>⛈️ Event</Heading>

          <Button onClick={() => setGameState("home")}>Resolve</Button>
        </VStack>
      );

    case "win":
      return (
        <VStack align="start" gap={4}>
          <Heading>🏆 Victory</Heading>

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
          <Heading>State: {gameState}</Heading>
        </Box>
      );
  }
}
