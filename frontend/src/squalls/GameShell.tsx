import { Box, VStack } from "@chakra-ui/react";
import type { GameShellProps } from "./shantiesTypes";

export default function GameShell({
  world,
  player,
  gameState,
  location,
}: GameShellProps) {
  return (
    <Box
      minH="100vh"
      bg={
        gameState === "battle"
          ? "red.900"
          : location === "island"
            ? "green.900"
            : "blue.900"
      }
      color="white"
    >
      <VStack h="100vh" gap={0}>
        {/* WORLD */}
        <Box
          flex={6}
          w="100%"
          p={5}
          borderBottom="1px solid rgba(255,255,255,0.1)"
          overflowY="auto"
        >
          {world}
        </Box>

        {/* PLAYER HUD */}
        <Box
          flex={4}
          w="100%"
          p={4}
          bg="blackAlpha.400"
          backdropFilter="blur(10px)"
          overflowY="auto"
        >
          {player}
        </Box>
      </VStack>
    </Box>
  );
}
