import { Box, Button, Grid, HStack, Text, VStack, Wrap, WrapItem } from "@chakra-ui/react";
import { FaMagnifyingGlassMinus, FaMagnifyingGlassPlus } from "react-icons/fa6";

import type { LocalConstructionHud, QueuedRecruitHud } from "./pondsteadHudQueue";
import { RESOURCE_EMOJI } from "./terrain";
import type { PondsteadViewMode } from "./viewModes";

const ZOOM_SPECTRUM: readonly PondsteadViewMode[] = ["wide", "medium", "narrow"] as const;

type Props = {
  viewMode: PondsteadViewMode;
  onViewModeChange: (vm: PondsteadViewMode) => void;
  day: number;
  /** True after “End day” until “Start new day” or “Resume day”. */
  awaitingNewDayConfirm: boolean;
  onEndDayOrResume: () => void;
  /** Dev/testing: commits calendar advance (constructions, recruits, fog, next day). */
  onStartNewDay: () => void;
  onUndo: () => void;
  canUndo: boolean;
  undoCount: number;
  /** Scoring: Granary, Sawmill, and Mason’s Yard each +1. */
  points: number;
  pointsToWin: number;
  gameWon: boolean;
  totalPopulation: number;
  populationCap: number;
  currentFood: number;
  foodPerDay: number;
  currentWood: number;
  woodPerDay: number;
  currentStone: number;
  stonePerDay: number;
  queuedRecruits: QueuedRecruitHud[];
  localConstructions: LocalConstructionHud[];
};

function sep() {
  return (
    <Text as="span" color="border" aria-hidden flexShrink={0}>
      ·
    </Text>
  );
}

export default function PondsteadCommandBar({
  viewMode,
  onViewModeChange,
  day,
  awaitingNewDayConfirm,
  onEndDayOrResume,
  onStartNewDay,
  onUndo,
  canUndo,
  undoCount,
  points,
  pointsToWin,
  gameWon,
  totalPopulation,
  populationCap,
  currentFood,
  foodPerDay,
  currentWood,
  woodPerDay,
  currentStone,
  stonePerDay,
  queuedRecruits,
  localConstructions,
}: Props) {
  const zi = ZOOM_SPECTRUM.indexOf(viewMode);
  const canZoomIn = zi < ZOOM_SPECTRUM.length - 1;
  const canZoomOut = zi > 0;

  const zoomIn = () => {
    if (!canZoomIn) return;
    onViewModeChange(ZOOM_SPECTRUM[zi + 1]!);
  };
  const zoomOut = () => {
    if (!canZoomOut) return;
    onViewModeChange(ZOOM_SPECTRUM[zi - 1]!);
  };

  const statusHeadline = `Day ${day}, ${points} / ${pointsToWin} points`;

  return (
    <VStack
      align="stretch"
      gap="1.5"
      px={{ base: "2", md: "3" }}
      py="2.5"
      borderBottomWidth="1px"
      borderColor="border"
      bg="bg.subtle"
      w="100%"
    >
      <Grid w="100%" templateColumns="2fr 3fr" gap="3" alignItems="start">
        <VStack
          align="start"
          gap="0"
          minW="0"
          fontWeight="bold"
          fontSize={{ base: "md", md: "lg" }}
          lineHeight="short"
          color="fg"
          aria-label={statusHeadline}
        >
          <Text as="span">Day {day}</Text>
          <Text as="span">
            {points} / {pointsToWin} points
          </Text>
        </VStack>
        <VStack
          align="stretch"
          gap="2"
          minW="0"
          w="100%"
          role="group"
          aria-label="Zoom, end day, and undo"
        >
          <HStack gap="2" justify="flex-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              colorPalette="gray"
              onClick={zoomOut}
              disabled={!canZoomOut}
              title="Show more map (wide: 9 columns)"
              aria-label="Zoom out to see more of the map"
              px="2"
            >
              <Box as="span" display="block" lineHeight="0" color="fg" aria-hidden>
                <FaMagnifyingGlassMinus size={16} />
              </Box>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              colorPalette="gray"
              onClick={zoomIn}
              disabled={!canZoomIn}
              title="Enlarge map cells (narrow: 3 columns)"
              aria-label="Zoom in to show fewer, larger map tiles"
              px="2"
            >
              <Box as="span" display="block" lineHeight="0" color="fg" aria-hidden>
                <FaMagnifyingGlassPlus size={16} />
              </Box>
            </Button>
          </HStack>
          <HStack gap="2" w="100%" flexWrap="nowrap" align="stretch">
            <Button
              type="button"
              size="sm"
              variant="solid"
              colorPalette="lilypad"
              flex="1"
              minW="0"
              whiteSpace="nowrap"
              onClick={onEndDayOrResume}
              disabled={gameWon}
              title={
                gameWon
                  ? "You have won the game"
                  : awaitingNewDayConfirm
                    ? "Return to editing this day (new day not started yet)"
                    : "Lock in end of day; then use Start new day to advance the calendar"
              }
              aria-label={awaitingNewDayConfirm ? "Resume day" : "End day"}
            >
              {awaitingNewDayConfirm ? "Resume day" : "End day"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              colorPalette="gray"
              flex="1"
              minW="0"
              whiteSpace="nowrap"
              onClick={onUndo}
              disabled={!canUndo}
              title="Rewind the last action on this day (fog and resources rewind with it)"
              aria-label={`Undo last action, ${undoCount} available`}
            >
              Undo [{undoCount}]
            </Button>
          </HStack>
          {awaitingNewDayConfirm ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              colorPalette="orange"
              w="100%"
              onClick={onStartNewDay}
              disabled={gameWon}
              title="Testing: run the new-calendar-day pass (builds finish, recruits spawn, day increments)"
              aria-label="Start new day (testing)"
            >
              Start new day
            </Button>
          ) : null}
        </VStack>
      </Grid>

      <HStack
        flexWrap="wrap"
        alignItems="baseline"
        gapX="1.5"
        gapY="0.5"
        fontSize={{ base: "xs", md: "sm" }}
        color="fg"
        lineHeight="snug"
        role="status"
        aria-label="Population and resource income"
      >
        <Text as="span" fontWeight="semibold" color="fg.muted" flexShrink={0}>
          Pop
        </Text>
        <Text as="span" fontWeight="semibold">
          {totalPopulation}
        </Text>
        <Text as="span" color="fg.muted" flexShrink={0}>
          /
        </Text>
        <Text as="span" fontWeight="semibold">
          {populationCap}
        </Text>
        {sep()}
        <Text as="span" flexShrink={0}>
          {RESOURCE_EMOJI.food} {currentFood}
          <Text as="span" color="fg.muted">
            {" "}
            (+{foodPerDay}/d)
          </Text>
        </Text>
        {sep()}
        <Text as="span" flexShrink={0}>
          {RESOURCE_EMOJI.wood} {currentWood}
          <Text as="span" color="fg.muted">
            {" "}
            (+{woodPerDay}/d)
          </Text>
        </Text>
        {sep()}
        <Text as="span" flexShrink={0}>
          {RESOURCE_EMOJI.stone} {currentStone}
          <Text as="span" color="fg.muted">
            {" "}
            (+{stonePerDay}/d)
          </Text>
        </Text>
        <Text as="span" color="fg.muted" fontSize="10px" display={{ base: "none", lg: "inline" }} flex="1" minW="0">
          Orchard → food/d · camp → wood/d · stone tiles → stone/d · Granary / Sawmill / Mason’s Yard on
          empty grass (needs 2 of your orchards / camps / quarries first). Wall needs a completed barracks.
          End day locks the map; Start new day finishes builds and spawns queued recruits.
        </Text>
      </HStack>

      {queuedRecruits.length > 0 ? (
        <Box role="status" aria-label="Queued recruits">
          <Text as="p" fontSize={{ base: "xs", sm: "sm" }} fontWeight="semibold" color="fg.muted" lineHeight="short">
            Queued recruits
          </Text>
          <Wrap gap="1.5" mt="0.5">
            {queuedRecruits.map((q) => (
              <WrapItem key={q.cellKey}>
                <Text
                  as="span"
                  fontSize={{ base: "xs", sm: "sm" }}
                  lineHeight="short"
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="md"
                  px="1.5"
                  py="0.5"
                  bg="bg"
                >
                  {q.kindLabel} → {q.atBuildingLabel}
                </Text>
              </WrapItem>
            ))}
          </Wrap>
        </Box>
      ) : null}

      {localConstructions.length > 0 ? (
        <Box role="status" aria-label="Buildings under construction">
          <Text as="p" fontSize={{ base: "xs", sm: "sm" }} fontWeight="semibold" color="fg.muted" lineHeight="short">
            Under construction
          </Text>
          <Wrap gap="1.5" mt="0.5">
            {localConstructions.map((c) => (
              <WrapItem key={c.cellKey}>
                <Text
                  as="span"
                  fontSize={{ base: "xs", sm: "sm" }}
                  lineHeight="short"
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="md"
                  px="1.5"
                  py="0.5"
                  bg="bg"
                >
                  {c.targetLabel} ({c.daysRemaining}d)
                </Text>
              </WrapItem>
            ))}
          </Wrap>
        </Box>
      ) : null}
    </VStack>
  );
}
