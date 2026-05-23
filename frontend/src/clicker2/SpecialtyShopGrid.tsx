import {
  Box,
  Button,
  Flex,
  IconButton,
  PopoverBody,
  PopoverContent,
  PopoverPositioner,
  PopoverRoot,
  PopoverTrigger,
  Text,
  TooltipContent,
  TooltipPositioner,
  TooltipRoot,
  TooltipTrigger,
} from "@chakra-ui/react";
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import {
  ecologyPopoverContentProps,
  ecologyTooltipRootBaseProps,
  ecologyTooltipSurfaceProps,
} from "../clicker/ecologyUi.constants";
import { CLICKER_SURFACES } from "../clicker/clickerTheme";

import { EVOLUTION_LABEL, EVOLUTIONS_LABEL } from "./clicker2Copy";
import { CLICKER2_SHOP_SECTION_HEADING_PROPS } from "./clicker2ShopUi";
import { getDenizenDef } from "./denizens";
import { formatShopCost } from "./formatEnergy";
import { specialtyTierGradient } from "./specialtyTierColors";
import { EvolutionTooltipContent } from "./EvolutionTooltipContent";
import {
  SHOW_SPECIALTY_SHOP_CARD_LABELS,
  SpecialtyShopCardLabel,
} from "./specialtyShopCardLabel";
import { useShopTooltipSnapshot } from "./useShopTooltipSnapshot";
import {
  POND_SPECIALTY_DENIZEN_ID,
  specialtyTierIndex,
  type SpecialtyDef,
} from "./specialties";

function SpecialtyHelpMobileButton({ def }: { def: SpecialtyDef }) {
  return (
    <PopoverRoot positioning={{ placement: "bottom-end" }}>
      <PopoverTrigger asChild>
        <IconButton
          variant="plain"
          borderRadius="full"
          bg={CLICKER_SURFACES.active}
          color="black"
          borderWidth="1px"
          borderStyle="solid"
          borderColor="black"
          minW="1rem"
          w="1rem"
          h="1rem"
          minH="1rem"
          fontSize="8px"
          fontWeight="extrabold"
          lineHeight="1"
          p="0"
          flexShrink={0}
          aria-label={`${EVOLUTION_LABEL} details: ${def.name}`}
          _hover={{ bg: "gray.100" }}
          _active={{ bg: CLICKER_SURFACES.inactive }}
          onClick={(e) => e.stopPropagation()}
        >
          ?
        </IconButton>
      </PopoverTrigger>
      <PopoverPositioner>
        <PopoverContent
          {...ecologyPopoverContentProps}
          w={{ base: "calc(100vw - 2rem)", md: "auto" }}
        >
          <PopoverBody bg={CLICKER_SURFACES.active} color="black" p="3" border="none">
            <EvolutionTooltipContent def={def} />
          </PopoverBody>
        </PopoverContent>
      </PopoverPositioner>
    </PopoverRoot>
  );
}

const SpecialtyEmojiButton = memo(function SpecialtyEmojiButton({
  def,
  canAfford,
  canHoverFinePointer,
  onBuy,
}: {
  def: SpecialtyDef;
  canAfford: boolean;
  canHoverFinePointer: boolean;
  onBuy: (def: SpecialtyDef) => void;
}) {
  const captureSnapshot = useCallback(() => def, [def]);
  const { snapshot: tooltipDef, onOpenChange: onTooltipOpenChange } =
    useShopTooltipSnapshot(captureSnapshot);

  const emoji =
    def.denizenId === POND_SPECIALTY_DENIZEN_ID
      ? "⚡"
      : (getDenizenDef(def.denizenId)?.emoji ?? "✨");
  const tierBackground = specialtyTierGradient(specialtyTierIndex(def));

  const cell = (
    <Box position="relative" w="full" minW="0" data-specialty-cell="">
      <Button
        type="button"
        variant="outline"
        w="full"
        aspectRatio="1"
        h="auto"
        minH="0"
        p={SHOW_SPECIALTY_SHOP_CARD_LABELS ? "1" : "0"}
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent={SHOW_SPECIALTY_SHOP_CARD_LABELS ? "space-between" : "center"}
        gap={SHOW_SPECIALTY_SHOP_CARD_LABELS ? "0.5" : undefined}
        borderWidth="1px"
        borderColor={canAfford ? "blackAlpha.200" : "border"}
        borderRadius="md"
        bg={tierBackground}
        opacity={canAfford ? 1 : 0.52}
        filter={canAfford ? undefined : "grayscale(0.35)"}
        cursor={canAfford ? "pointer" : "not-allowed"}
        lineHeight="1"
        overflow="hidden"
        aria-label={`${def.name} — ${formatShopCost(def.price)}`}
        _hover={
          canAfford
            ? { filter: "brightness(1.05)", borderColor: "blackAlpha.400" }
            : undefined
        }
        _active={canAfford ? { filter: "brightness(0.96)" } : undefined}
        onClick={() => {
          if (canAfford) onBuy(def);
        }}
      >
        <Flex
          flex="1"
          align="center"
          justify="center"
          w="full"
          minH="0"
          pointerEvents="none"
        >
          <Text
            as="span"
            aria-hidden
            userSelect="none"
            fontSize={
              SHOW_SPECIALTY_SHOP_CARD_LABELS
                ? "clamp(1.25rem, 5vw, 1.85rem)"
                : "clamp(1.65rem, 7vw, 2.35rem)"
            }
            lineHeight="1"
            style={{ filter: "drop-shadow(0 1px 1px rgba(255,255,255,0.35))" }}
          >
            {emoji}
          </Text>
        </Flex>
        {SHOW_SPECIALTY_SHOP_CARD_LABELS ? (
          <SpecialtyShopCardLabel name={def.name} muted={!canAfford} />
        ) : null}
      </Button>
      {!canHoverFinePointer ? (
        <Box position="absolute" top="0.25rem" right="0.25rem" zIndex={1}>
          <SpecialtyHelpMobileButton def={def} />
        </Box>
      ) : null}
    </Box>
  );

  if (!canHoverFinePointer) {
    return cell;
  }

  return (
    <TooltipRoot
      {...ecologyTooltipRootBaseProps}
      openDelay={400}
      positioning={{ placement: "top" }}
      onOpenChange={onTooltipOpenChange}
    >
      <TooltipTrigger asChild>{cell}</TooltipTrigger>
      <TooltipPositioner>
        <TooltipContent {...ecologyTooltipSurfaceProps} maxW="300px">
          {tooltipDef ? <EvolutionTooltipContent def={tooltipDef} /> : null}
        </TooltipContent>
      </TooltipPositioner>
    </TooltipRoot>
  );
});

const GRID_COLUMNS = 4;

export default function SpecialtyShopGrid({
  specialties,
  spendableEnergy,
  canHoverFinePointer,
  onBuy,
  headerTrailing,
}: {
  specialties: readonly SpecialtyDef[];
  spendableEnergy: number;
  canHoverFinePointer: boolean;
  onBuy: (def: SpecialtyDef) => void;
  headerTrailing?: ReactNode;
}) {
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [rowHeightPx, setRowHeightPx] = useState(0);
  const [fullHeightPx, setFullHeightPx] = useState(0);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const measure = () => {
      const firstCell = grid.querySelector<HTMLElement>("[data-specialty-cell]");
      setRowHeightPx(firstCell?.offsetHeight ?? 0);
      setFullHeightPx(grid.scrollHeight);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    return () => ro.disconnect();
  }, [specialties.length]);

  if (specialties.length === 0 && !headerTrailing) return null;

  const isExpanded = !canHoverFinePointer || hoverExpanded;
  const showCollapse = canHoverFinePointer && specialties.length > GRID_COLUMNS;
  const clipHeightPx = isExpanded || !showCollapse ? fullHeightPx : rowHeightPx;

  return (
    <Box
      onMouseEnter={() => {
        if (canHoverFinePointer) setHoverExpanded(true);
      }}
      onMouseLeave={() => {
        if (canHoverFinePointer) setHoverExpanded(false);
      }}
    >
      <Flex justify="space-between" align="center" gap="2" mb="2">
        <Text {...CLICKER2_SHOP_SECTION_HEADING_PROPS}>{EVOLUTIONS_LABEL}</Text>
        {headerTrailing}
      </Flex>
      {specialties.length > 0 ? (
      <Box
        w="full"
        overflow="hidden"
        transition="max-height 0.22s ease-out"
        maxH={clipHeightPx > 0 ? `${clipHeightPx}px` : undefined}
      >
        <Box
          ref={gridRef}
          display="grid"
          gridTemplateColumns={`repeat(${GRID_COLUMNS}, minmax(0, 1fr))`}
          gap="1"
        >
          {specialties.map((def) => {
            const canAfford = spendableEnergy >= def.price;
            return (
              <SpecialtyEmojiButton
                key={def.id}
                def={def}
                canAfford={canAfford}
                canHoverFinePointer={canHoverFinePointer}
                onBuy={onBuy}
              />
            );
          })}
        </Box>
      </Box>
      ) : null}
    </Box>
  );
}
