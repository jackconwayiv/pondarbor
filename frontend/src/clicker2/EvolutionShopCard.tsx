import {
  Box,
  Button,
  Flex,
  Text,
  TooltipContent,
  TooltipPositioner,
  TooltipRoot,
  TooltipTrigger,
} from "@chakra-ui/react";
import { memo, useCallback, useState, type ReactNode } from "react";

import {
  ecologyTooltipRootBaseProps,
  ecologyTooltipSurfaceProps,
  SHOP_HELP_POPOVER_Z_INDEX,
} from "../clicker/ecologyUi.constants";

import { evolutionDisplayEmoji } from "./clicker2OwnedEvolutions";
import { EVOLUTION_LABEL } from "./clicker2Copy";
import { EvolutionTooltipContent } from "./EvolutionTooltipContent";
import {
  SHOW_SPECIALTY_SHOP_CARD_LABELS,
  SpecialtyShopCardLabel,
} from "./specialtyShopCardLabel";
import {
  FOSSIL_SHOP_TOOLTIP_SURFACE_PROPS,
  specialtyTierGradient,
} from "./specialtyTierColors";
import { useShopTooltipSnapshot } from "./useShopTooltipSnapshot";
import {
  PAIRING_SPECIALTY_DENIZEN_ID,
  pairingLowerDenizenTierIndex,
} from "./pairingEvolutions";
import { ShopHelpMobilePopover } from "./ShopHelpMobilePopover";
import { specialtyTierIndex, type SpecialtyDef } from "./specialties";

export type EvolutionShopCardProps = {
  def: SpecialtyDef;
  canHoverFinePointer: boolean;
  /** Owned display (stats): no buy affordance, full color. */
  owned?: boolean;
  canAfford?: boolean;
  onBuy?: (def: SpecialtyDef) => void;
  /** Overrides denizen tier gradient (e.g. Fossil Shop). */
  backgroundGradient?: string;
  /** Card outline width (e.g. Fossil Shop). */
  borderWidth?: string;
  /** Fossil or other non-energy cost in the buy tooltip. */
  costLabel?: string;
};

export const EvolutionShopCard = memo(function EvolutionShopCard({
  def,
  canHoverFinePointer,
  owned = false,
  canAfford = true,
  onBuy,
  backgroundGradient,
  borderWidth = "1px",
  costLabel,
}: EvolutionShopCardProps) {
  const captureSnapshot = useCallback(() => def, [def]);
  const { snapshot: tooltipDef, onOpenChange: onTooltipOpenChange } =
    useShopTooltipSnapshot(captureSnapshot);
  const [helpOpen, setHelpOpen] = useState(false);

  const emoji = evolutionDisplayEmoji(def);
  const tierBackground =
    backgroundGradient ??
    specialtyTierGradient(
      def.denizenId === PAIRING_SPECIALTY_DENIZEN_ID
        ? pairingLowerDenizenTierIndex(def)
        : specialtyTierIndex(def),
    );

  const interactive = !owned && onBuy != null;
  const showAfford = owned || canAfford;
  const fossilShopStyled = def.fossilShopOnly;
  const tooltipSurfaceProps = fossilShopStyled
    ? { ...ecologyTooltipSurfaceProps, ...FOSSIL_SHOP_TOOLTIP_SURFACE_PROPS }
    : ecologyTooltipSurfaceProps;

  const cardBody = (
    <>
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
        <SpecialtyShopCardLabel name={def.name} muted={!showAfford} />
      ) : null}
    </>
  );

  const cardChrome = {
    variant: "outline" as const,
    w: "full",
    aspectRatio: "1",
    h: "auto",
    minH: "0",
    p: SHOW_SPECIALTY_SHOP_CARD_LABELS ? "1" : "0",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: SHOW_SPECIALTY_SHOP_CARD_LABELS ? "space-between" : "center",
    gap: SHOW_SPECIALTY_SHOP_CARD_LABELS ? "0.5" : undefined,
    borderWidth,
    borderColor: showAfford ? "blackAlpha.200" : "border",
    borderRadius: "md",
    bg: tierBackground,
    opacity: showAfford ? 1 : 0.52,
    filter: showAfford ? undefined : "grayscale(0.35)",
    lineHeight: "1",
    overflow: "hidden",
  };

  const cell = (
    <Flex gap="0.25" align="stretch" minW="0" w="full">
      <Box
        position="relative"
        flex="1"
        minW="0"
        data-specialty-cell=""
        zIndex={helpOpen ? SHOP_HELP_POPOVER_Z_INDEX : undefined}
      >
        {interactive ? (
          <Button
            type="button"
            {...cardChrome}
            cursor={canAfford ? "pointer" : "not-allowed"}
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
            {cardBody}
          </Button>
        ) : (
          <Box {...cardChrome} cursor="default">
            {cardBody}
          </Box>
        )}
      </Box>
      {!canHoverFinePointer ? (
        <Flex align="flex-start" flexShrink={0} w="1rem" minW="1rem" pt="0.25rem">
          <ShopHelpMobilePopover
            ariaLabel={`${EVOLUTION_LABEL} details: ${def.name}`}
            bodyBg={
              fossilShopStyled ? FOSSIL_SHOP_TOOLTIP_SURFACE_PROPS.bg : undefined
            }
            onOpenChange={(e) => setHelpOpen(e.open)}
          >
            <EvolutionTooltipContent
              def={def}
              owned={owned}
              canAfford={canAfford}
              costLabel={costLabel}
            />
          </ShopHelpMobilePopover>
        </Flex>
      ) : null}
    </Flex>
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
        <TooltipContent {...tooltipSurfaceProps} maxW="300px">
          {tooltipDef ? (
            <EvolutionTooltipContent
              def={tooltipDef}
              owned={owned}
              canAfford={canAfford}
              costLabel={costLabel}
            />
          ) : null}
        </TooltipContent>
      </TooltipPositioner>
    </TooltipRoot>
  );
});

export function EvolutionShopCardGrid({
  children,
  gap = "1",
  columns = 4,
}: {
  children: ReactNode;
  gap?: string;
  columns?: number;
}) {
  return (
    <Box
      display="grid"
      gridTemplateColumns={`repeat(${columns}, minmax(0, 1fr))`}
      gap={gap}
    >
      {children}
    </Box>
  );
}
