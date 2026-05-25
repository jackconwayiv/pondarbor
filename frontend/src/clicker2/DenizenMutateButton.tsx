import PondButton from "../PondButton";
import { DESIGN } from "../theme/tokens";

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
}: {
  def: DenizenDef;
  owned: number;
  mutationLevel: number;
  mutagensBank: number;
  mutagenUnlocked: boolean;
  onMutate: (def: DenizenDef) => void;
  className?: string;
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

  return (
    <PondButton
      type="button"
      size="xs"
      className={className}
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
      aria-label={`Mutate ${def.name}, costs ${mutateCost} mutagen${mutateCost === 1 ? "" : "s"}`}
      onClick={(e) => {
        e.stopPropagation();
        if (canMutate) onMutate(def);
      }}
    >
      {MUTAGEN_EMOJI} {mutateCost}
    </PondButton>
  );
}
