import { Box, VStack } from "@chakra-ui/react";

import {
  getSceneTopColor,
  getShellAppearance,
} from "./gameShellAppearance";
import type { GameShellProps } from "./shantiesTypes";
import { SQUALLS_HUD_COLORS } from "./squallsTheme";

export default function GameShell({
  world,
  adventure,
  player,
  targetGameState,
  targetLocation,
  targetDungeonKind,
  displayGameState,
  displayLocation,
  displayDungeonKind,
  sceneOpacity,
  sceneFadeMs,
  isTransitioning,
}: GameShellProps) {
  const displayShell = getShellAppearance(
    displayGameState,
    displayLocation,
    displayDungeonKind,
  );
  const targetTopColor = getSceneTopColor(
    targetGameState,
    targetLocation,
    targetDungeonKind,
  );
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
            borderBottom="1px solid"
            borderColor={SQUALLS_HUD_COLORS.panelBorder}
            bg={SQUALLS_HUD_COLORS.panelBg}
            color={SQUALLS_HUD_COLORS.panelText}
            backdropFilter="blur(12px)"
            boxShadow="inset 0 -1px 0 rgba(0,0,0,0.2)"
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
          p={inBattle ? 0 : { base: 2, md: 5 }}
          pt={inBattle ? 0 : { base: 2, md: 5 }}
          overflow={inBattle ? "hidden" : "auto"}
          position="relative"
        >
          {world}
        </Box>
      </VStack>
    </Box>
  );
}
