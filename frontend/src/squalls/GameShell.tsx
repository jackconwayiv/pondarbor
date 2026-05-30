import { Box, VStack } from "@chakra-ui/react";

import {
  getSceneTopColor,
  getShellAppearance,
} from "./gameShellAppearance";
import type { GameShellProps } from "./shantiesTypes";

export default function GameShell({
  world,
  adventure,
  player,
  targetGameState,
  targetLocation,
  displayGameState,
  displayLocation,
  sceneOpacity,
  sceneFadeMs,
  isTransitioning,
}: GameShellProps) {
  const displayShell = getShellAppearance(displayGameState, displayLocation);
  const targetTopColor = getSceneTopColor(targetGameState, targetLocation);
  const inBattle = displayGameState === "battle";

  return (
    <Box
      minH="100dvh"
      overflow="hidden"
      isolation="isolate"
      bg={isTransitioning ? targetTopColor : displayShell.background}
      color={displayShell.color}
    >
      <VStack
        h="100dvh"
        gap={0}
        align="stretch"
        opacity={isTransitioning ? sceneOpacity : 1}
        transition={
          isTransitioning && sceneFadeMs > 0
            ? `opacity ${sceneFadeMs}ms ease-in-out`
            : undefined
        }
        bg={isTransitioning ? displayShell.background : undefined}
        minH="100dvh"
        style={
          isTransitioning
            ? { pointerEvents: sceneOpacity < 1 ? "none" : undefined }
            : undefined
        }
      >
        {displayGameState !== "lobby" && !inBattle && (
          <Box
            flexShrink={0}
            w="100%"
            px={3}
            py={2}
            borderBottom="1px solid rgba(0,0,0,0.08)"
            bg="blackAlpha.200"
            backdropFilter="blur(10px)"
          >
            <VStack gap={1.5} align="stretch" w="100%">
              {player}
              {adventure}
            </VStack>
          </Box>
        )}

        <Box
          flex={inBattle ? "unset" : "1"}
          h={inBattle ? "100dvh" : undefined}
          minH={inBattle ? undefined : 0}
          w="100%"
          display="flex"
          flexDirection="column"
          p={inBattle ? 0 : 5}
          pt={inBattle ? 0 : 5}
          overflow={inBattle ? "hidden" : "auto"}
        >
          {world}
        </Box>
      </VStack>
    </Box>
  );
}
