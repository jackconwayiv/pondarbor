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
import {
  FOSSIL_SHOP_CARD_INNER_PADDING,
} from "./clicker2ShopUi";
import { EvolutionTooltipContent } from "./EvolutionTooltipContent";
import {
  SHOW_SPECIALTY_SHOP_CARD_LABELS,
  SpecialtyShopCardLabel,
} from "./specialtyShopCardLabel";
import {
  FOSSIL_SHOP_CARD_INSET_SHADOW,
  FOSSIL_SHOP_CARD_INSET_SHADOW_ACTIVE,
  FOSSIL_SHOP_CARD_INSET_SHADOW_HOVER,
  FOSSIL_SHOP_PETROGLYPH_INNER_BORDER_PROPS,
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
  /** Shown on the card face (e.g. fossil shop tree). */
  cardPriceLabel?: string;
  /** Full-color card (not faded). Defaults to owned || canAfford. */
  emphasized?: boolean;
  /** Overrides the caption under the emoji. */
  displayName?: string;
  /** Overrides the large emoji on the card face. */
  displayEmoji?: string;
  /** Small label above the emoji (e.g. etched petroglyph slot name). */
  cardHeaderLabel?: string;
  /** Owned-card action (e.g. petroglyph etch). */
  onActivate?: () => void;
  /** When true, owned activate cards are not clickable. */
  activateDisabled?: boolean;
  /** Accessible name when the owned card is an action button. */
  activateAriaLabel?: string;
  /** Hide the caption under the emoji (petroglyph blank stats display). */
  hideCardLabel?: boolean;
  borderStyle?: "solid" | "dashed";
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
  cardPriceLabel,
  emphasized,
  displayName,
  displayEmoji,
  cardHeaderLabel,
  onActivate,
  activateDisabled = false,
  activateAriaLabel,
  hideCardLabel = false,
  borderStyle = "solid",
}: EvolutionShopCardProps) {
  const captureSnapshot = useCallback(() => def, [def]);
  const { snapshot: tooltipDef, onOpenChange: onTooltipOpenChange } =
    useShopTooltipSnapshot(captureSnapshot);
  const [helpOpen, setHelpOpen] = useState(false);

  const emoji = displayEmoji ?? evolutionDisplayEmoji(def);
  const tierBackground =
    backgroundGradient ??
    specialtyTierGradient(
      def.denizenId === PAIRING_SPECIALTY_DENIZEN_ID
        ? pairingLowerDenizenTierIndex(def)
        : specialtyTierIndex(def),
    );

  const buyInteractive = !owned && onBuy != null;
  const activateInteractive = owned && onActivate != null;
  const interactive = buyInteractive || activateInteractive;
  const canActivate = activateInteractive && !activateDisabled;
  const showAfford = emphasized ?? (owned || canAfford);
  const cardLabel = displayName ?? def.name;
  const fossilShopStyled = def.fossilShopOnly;
  const isPetroglyphSlot = def.effect.type === "petroglyph_slot";
  const fossilShopCarved = fossilShopStyled && showAfford;
  const fossilShopPressFeedback =
    fossilShopCarved &&
    canHoverFinePointer &&
    ((buyInteractive && canAfford) || canActivate);
  const fossilShopPressHover = fossilShopPressFeedback
    ? {
        boxShadow: FOSSIL_SHOP_CARD_INSET_SHADOW_HOVER,
        transform: "translateY(1px)",
      }
    : undefined;
  const fossilShopPressActive = fossilShopPressFeedback
    ? {
        boxShadow: FOSSIL_SHOP_CARD_INSET_SHADOW_ACTIVE,
        transform: "translateY(2px)",
      }
    : undefined;
  const fossilShopHoverLocked =
    fossilShopCarved && interactive && !canAfford
      ? {
          boxShadow: FOSSIL_SHOP_CARD_INSET_SHADOW,
          transform: "none",
        }
      : undefined;
  const petroglyphInnerBorder = isPetroglyphSlot ? (
    <Box {...FOSSIL_SHOP_PETROGLYPH_INNER_BORDER_PROPS} />
  ) : null;
  const tooltipSurfaceProps = fossilShopStyled
    ? { ...ecologyTooltipSurfaceProps, ...FOSSIL_SHOP_TOOLTIP_SURFACE_PROPS }
    : ecologyTooltipSurfaceProps;

  const cardBody = (
    <>
      {cardHeaderLabel ? (
        <Text
          fontSize="2xs"
          lineHeight="1.1"
          textAlign="center"
          w="full"
          px="0.5"
          pt="0.5"
          flexShrink={0}
          fontWeight="semibold"
          color="gray.600"
          aria-hidden
        >
          {cardHeaderLabel}
        </Text>
      ) : null}
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
      {SHOW_SPECIALTY_SHOP_CARD_LABELS && !hideCardLabel ? (
        <SpecialtyShopCardLabel name={cardLabel} muted={!showAfford} />
      ) : null}
      {cardPriceLabel && !owned ? (
        <Text
          fontSize="2xs"
          lineHeight="1.1"
          textAlign="center"
          w="full"
          px="0.5"
          pb="0.5"
          flexShrink={0}
          fontWeight="bold"
          color={canAfford ? "gray.800" : "nautical.solid"}
          fontVariantNumeric="tabular-nums"
          aria-hidden
        >
          {cardPriceLabel}
        </Text>
      ) : null}
    </>
  );

  const renderedCardBody = isPetroglyphSlot ? (
    <Box
      position="relative"
      zIndex={1}
      flex="1"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent={
        SHOW_SPECIALTY_SHOP_CARD_LABELS ? "space-between" : "center"
      }
      gap={SHOW_SPECIALTY_SHOP_CARD_LABELS ? "0.5" : undefined}
      w="full"
      minH="0"
    >
      {cardBody}
    </Box>
  ) : (
    cardBody
  );

  const cardChrome = {
    variant: "outline" as const,
    w: "full",
    aspectRatio: "1",
    h: "auto",
    minH: "0",
    p: fossilShopStyled
      ? FOSSIL_SHOP_CARD_INNER_PADDING
      : SHOW_SPECIALTY_SHOP_CARD_LABELS
        ? "1"
        : "0",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: SHOW_SPECIALTY_SHOP_CARD_LABELS ? "space-between" : "center",
    gap: SHOW_SPECIALTY_SHOP_CARD_LABELS ? "0.5" : undefined,
    borderWidth,
    borderStyle,
    borderColor: showAfford ? "blackAlpha.200" : "border",
    borderRadius: "md",
    bg: tierBackground,
    opacity: showAfford ? 1 : 0.52,
    filter: showAfford ? undefined : "grayscale(0.35)",
    lineHeight: "1",
    overflow: "hidden",
    ...(isPetroglyphSlot ? { position: "relative" as const } : {}),
    ...(fossilShopCarved
      ? {
          boxShadow: FOSSIL_SHOP_CARD_INSET_SHADOW,
          transition:
            "box-shadow 0.15s ease, transform 0.15s ease, filter 0.15s ease, border-color 0.15s ease",
        }
      : {}),
  };

  const purchaseHoverProps =
    fossilShopHoverLocked ??
    (fossilShopCarved
      ? fossilShopPressHover
      : canAfford
        ? {
            filter: "brightness(1.05)",
            borderColor: "blackAlpha.400",
          }
        : {});

  const purchaseActiveProps =
    fossilShopHoverLocked ??
    (fossilShopCarved
      ? fossilShopPressActive
      : canAfford
        ? { filter: "brightness(0.96)" }
        : {});

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
            aria-label={canActivate ? activateAriaLabel : undefined}
            cursor={
              buyInteractive
                ? canAfford
                  ? "pointer"
                  : "not-allowed"
                : canActivate
                  ? "pointer"
                  : "default"
            }
            _hover={purchaseHoverProps}
            _active={purchaseActiveProps}
            onClick={() => {
              if (buyInteractive && canAfford) onBuy(def);
              else if (canActivate) onActivate();
            }}
          >
            {petroglyphInnerBorder}
            {renderedCardBody}
          </Button>
        ) : (
          <Box {...cardChrome} cursor="default" _hover={fossilShopPressHover}>
            {petroglyphInnerBorder}
            {renderedCardBody}
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

  if (!showAfford && !interactive) {
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
