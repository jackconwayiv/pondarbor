import { Box, Collapsible, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";

import { useIsMobile } from "../responsive";

import { FOSSIL_SHOP_LABEL } from "./clicker2Copy";
import { FOSSIL_SHOP_SECTION_HEADING_PROPS } from "./clicker2ShopUi";
import { EvolutionShopCard, EvolutionShopCardGrid } from "./EvolutionShopCard";
import {
  compareFossilShopByFossilPrice,
  FOSSIL_EMOJI,
  FOSSIL_SHOP_SPECIALTY_IDS,
  isFossilShopItemForSale,
} from "./fossilShop";
import { getSpecialtyDef, type SpecialtyDef } from "./specialties";
import {
  FOSSIL_SHOP_CARD_BORDER_WIDTH,
  FOSSIL_SHOP_CARD_GRADIENT,
} from "./specialtyTierColors";

const GRID_COLUMNS_DESKTOP = 4;
const GRID_COLUMNS_MOBILE = 3;

export function formatFossilCost(amount: number): string {
  return `${Math.max(0, Math.floor(amount)).toLocaleString()} ${FOSSIL_EMOJI}`;
}

export default function FossilShopSection({
  fossils,
  ownedSpecialties,
  canHoverFinePointer,
  onBuy,
}: {
  fossils: number;
  ownedSpecialties: Record<number, boolean>;
  canHoverFinePointer: boolean;
  onBuy: (def: SpecialtyDef) => void;
}) {
  const isMobile = useIsMobile();
  const gridColumns = isMobile ? GRID_COLUMNS_MOBILE : GRID_COLUMNS_DESKTOP;
  const [open, setOpen] = useState(true);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [rowHeightPx, setRowHeightPx] = useState(0);
  const [fullHeightPx, setFullHeightPx] = useState(0);

  const forSale = FOSSIL_SHOP_SPECIALTY_IDS.map((id) => getSpecialtyDef(id))
    .filter(
      (def): def is NonNullable<typeof def> =>
        def != null && isFossilShopItemForSale(def, ownedSpecialties),
    )
    .sort(compareFossilShopByFossilPrice);

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
  }, [forSale.length, gridColumns, open]);

  if (forSale.length === 0) {
    return null;
  }

  const gridExpanded = !canHoverFinePointer || hoverExpanded;
  const showGridCollapse =
    canHoverFinePointer && forSale.length > gridColumns;
  const clipHeightPx =
    gridExpanded || !showGridCollapse ? fullHeightPx : rowHeightPx;

  return (
    <Collapsible.Root open={open} onOpenChange={(d) => setOpen(d.open)}>
      <Collapsible.Trigger asChild>
        <button
          type="button"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            width: "100%",
            textAlign: "left",
            cursor: "pointer",
            background: "transparent",
            border: "none",
            padding: 0,
            margin: 0,
            marginBottom: open ? "0.5rem" : 0,
            color: "var(--chakra-colors-nautical-solid)",
          }}
        >
          <Text
            as="span"
            aria-hidden
            transform={open ? "rotate(90deg)" : "rotate(0deg)"}
            transition="transform 0.15s ease"
            lineHeight="1"
            flexShrink={0}
            fontSize="sm"
          >
            ›
          </Text>
          <Text {...FOSSIL_SHOP_SECTION_HEADING_PROPS} as="span" mb="0">
            {FOSSIL_SHOP_LABEL}
          </Text>
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <Box
          onMouseEnter={() => {
            if (canHoverFinePointer) setHoverExpanded(true);
          }}
          onMouseLeave={() => {
            if (canHoverFinePointer) setHoverExpanded(false);
          }}
        >
          <Box
            w="full"
            overflow="hidden"
            transition="max-height 0.22s ease-out"
            maxH={clipHeightPx > 0 ? `${clipHeightPx}px` : undefined}
          >
            <Box ref={gridRef}>
              <EvolutionShopCardGrid gap="1" columns={gridColumns}>
                {forSale.map((def) => {
                  const fossilCost = def.priceFossils ?? 1;
                  const canAfford = fossils >= fossilCost;
                  return (
                    <EvolutionShopCard
                      key={def.id}
                      def={def}
                      canHoverFinePointer={canHoverFinePointer}
                      canAfford={canAfford}
                      backgroundGradient={FOSSIL_SHOP_CARD_GRADIENT}
                      borderWidth={FOSSIL_SHOP_CARD_BORDER_WIDTH}
                      costLabel={formatFossilCost(fossilCost)}
                      onBuy={() => onBuy(def)}
                    />
                  );
                })}
              </EvolutionShopCardGrid>
            </Box>
          </Box>
        </Box>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
