import { Box, TooltipContent, TooltipPositioner, TooltipRoot, TooltipTrigger } from "@chakra-ui/react";

import {
  ecologyTooltipRootBaseProps,
  ecologyTooltipSurfaceProps,
} from "../clicker/ecologyUi.constants";
import PondButton from "../PondButton";
import { DESIGN } from "../theme/tokens";

import { mutagenLevelUpTooltip } from "./clicker2Copy";
import { MUTAGEN_WARM_GRADIENT } from "./clicker2ShopUi";
import type { DenizenDef } from "./denizens";
import {
  canMutateDenizen,
  isDenizenMutable,
  mutagenCostForNextLevel,
  MUTAGEN_EMOJI,
  MUTAGEN_MAX_LEVEL,
} from "./mutagens";

export function shouldShowDenizenMutateButton(
  def: DenizenDef,
  owned: number,
  mutationLevel: number,
  mutagensBank: number,
  mutagenUnlocked: boolean,
): boolean {
  return (
    mutagenUnlocked &&
    mutagensBank >= 1 &&
    isDenizenMutable(def.id) &&
    owned > 0 &&
    mutationLevel < MUTAGEN_MAX_LEVEL
  );
}

export default function DenizenMutateButton({
  def,
  owned,
  mutationLevel,
  mutagensBank,
  mutagenUnlocked,
  onMutate,
  className,
  compact = false,
  canHoverFinePointer = true,
}: {
  def: DenizenDef;
  owned: number;
  mutationLevel: number;
  mutagensBank: number;
  mutagenUnlocked: boolean;
  onMutate: (def: DenizenDef) => void;
  className?: string;
  /** Tighter vertical padding (depth chart rows). */
  compact?: boolean;
  canHoverFinePointer?: boolean;
}) {
  if (
    !shouldShowDenizenMutateButton(
      def,
      owned,
      mutationLevel,
      mutagensBank,
      mutagenUnlocked,
    )
  ) {
    return null;
  }

  const canMutate = canMutateDenizen(def, owned, mutationLevel, mutagensBank);
  const mutateCost = mutagenCostForNextLevel(mutationLevel);
  const nextLevel = mutationLevel + 1;
  const tooltipLabel = mutagenLevelUpTooltip(
    def.namePlural,
    mutateCost,
    nextLevel,
  );

  const button = (
    <PondButton
      type="button"
      size="xs"
      className={className}
      py={compact ? "0" : undefined}
      minH={compact ? "1.05rem" : undefined}
      h={compact ? "auto" : undefined}
      lineHeight={compact ? "1" : undefined}
      variant={canMutate ? "outline" : "solid"}
      colorPalette={canMutate ? undefined : "gray"}
      disabled={!canMutate}
      background={canMutate ? MUTAGEN_WARM_GRADIENT : undefined}
      color={canMutate ? DESIGN.textPrimary : undefined}
      borderWidth="1px"
      borderColor={canMutate ? "border" : undefined}
      _hover={
        canMutate
          ? {
              background: MUTAGEN_WARM_GRADIENT,
              bg: "transparent",
              borderColor: "lilypad.emphasized",
              color: DESIGN.textPrimary,
            }
          : undefined
      }
      aria-label={tooltipLabel}
      onClick={(e) => {
        e.stopPropagation();
        if (canMutate) onMutate(def);
      }}
    >
      {MUTAGEN_EMOJI} {mutateCost}
    </PondButton>
  );

  if (!canHoverFinePointer) {
    return button;
  }

  return (
    <TooltipRoot
      {...ecologyTooltipRootBaseProps}
      openDelay={400}
      positioning={{ placement: "top" }}
    >
      <TooltipTrigger asChild>
        <Box as="span" display="inline-flex" alignSelf="flex-start">
          {button}
        </Box>
      </TooltipTrigger>
      <TooltipPositioner>
        <TooltipContent {...ecologyTooltipSurfaceProps} maxW="280px">
          {tooltipLabel}
        </TooltipContent>
      </TooltipPositioner>
    </TooltipRoot>
  );
}
