import { Box, Flex, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useIsMobile } from "../responsive";

import { EvolutionShopCard, EvolutionShopCardGrid } from "./EvolutionShopCard";
import { EVOLUTIONS_LABEL } from "./clicker2Copy";
import { CLICKER2_SHOP_SECTION_HEADING_PROPS } from "./clicker2ShopUi";
import type { SpecialtyDef } from "./specialties";

const GRID_COLUMNS_DESKTOP = 4;
const GRID_COLUMNS_MOBILE = 3;

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
  const isMobile = useIsMobile();
  const gridColumns = isMobile ? GRID_COLUMNS_MOBILE : GRID_COLUMNS_DESKTOP;
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
  }, [specialties.length, gridColumns]);

  if (specialties.length === 0 && !headerTrailing) return null;

  const isExpanded = !canHoverFinePointer || hoverExpanded;
  const showCollapse =
    canHoverFinePointer && specialties.length > gridColumns;
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
          <Box ref={gridRef}>
            <EvolutionShopCardGrid gap="1" columns={gridColumns}>
              {specialties.map((def) => {
                const canAfford = spendableEnergy >= def.price;
                return (
                  <EvolutionShopCard
                    key={def.id}
                    def={def}
                    canHoverFinePointer={canHoverFinePointer}
                    canAfford={canAfford}
                    onBuy={onBuy}
                  />
                );
              })}
            </EvolutionShopCardGrid>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
