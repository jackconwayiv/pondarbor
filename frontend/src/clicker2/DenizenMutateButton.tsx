import { type MouseEvent } from "react";
import { Box, TooltipContent, TooltipPositioner, TooltipRoot, TooltipTrigger } from "@chakra-ui/react";

import {
  ecologyTooltipRootBaseProps,
  ecologyTooltipSurfaceProps,
} from "../clicker/ecologyUi.constants";
import { mutagenLevelUpTooltip } from "./clicker2Copy";
import type { DenizenDef } from "./denizens";
import {
  canMutateDenizen,
  isDenizenMutable,
  mutagenCostForNextLevel,
} from "./mutagens";

export function shouldShowDenizenDepthChartLevel(
  def: DenizenDef,
  mutagenUnlocked: boolean,
): boolean {
  return mutagenUnlocked && isDenizenMutable(def.id);
}

export default function DenizenMutateButton({
  def,
  owned,
  mutationLevel,
  mutagensBank,
  mutagenUnlocked,
  onMutate,
  className,
  labelOnDark = false,
  canHoverFinePointer = true,
}: {
  def: DenizenDef;
  owned: number;
  mutationLevel: number;
  mutagensBank: number;
  mutagenUnlocked: boolean;
  onMutate: (def: DenizenDef) => void;
  className?: string;
  labelOnDark?: boolean;
  canHoverFinePointer?: boolean;
}) {
  if (!shouldShowDenizenDepthChartLevel(def, mutagenUnlocked)) {
    return null;
  }

  const canAfford = canMutateDenizen(def, owned, mutationLevel, mutagensBank);
  const mutateCost = mutagenCostForNextLevel(mutationLevel);
  const nextLevel = mutationLevel + 1;
  const tooltipLabel = mutagenLevelUpTooltip(
    def.namePlural,
    mutateCost,
    nextLevel,
  );
  const levelClassName = [
    "pondDepthChartLevel",
    labelOnDark ? "pondDepthChartLevel--onDark" : "",
    canAfford
      ? "pondDepthChartLevel--affordable"
      : "pondDepthChartLevel--unaffordable",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const levelText = `Level: ${mutationLevel}`;
  const levelContent = canAfford ? (
    <span className="pondDepthChartLevelGradient">{levelText}</span>
  ) : (
    levelText
  );

  if (!canAfford || !canHoverFinePointer) {
    return (
      <Box as="span" className={levelClassName}>
        {levelContent}
      </Box>
    );
  }

  const levelButton = (
    <Box
      as="button"
      className={levelClassName}
      aria-label={tooltipLabel}
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        onMutate(def);
      }}
    >
      {levelContent}
    </Box>
  );

  return (
    <TooltipRoot
      {...ecologyTooltipRootBaseProps}
      openDelay={400}
      positioning={{ placement: "top" }}
    >
      <TooltipTrigger asChild>
        <Box as="span" display="inline-flex" alignSelf="flex-start">
          {levelButton}
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
