import { Stack } from "@chakra-ui/react";

import { formatShopCost } from "./formatEnergy";
import {
  ShopEffectText,
  ShopFlavorText,
  ShopTooltipHeader,
} from "./shopTooltipText";
import type { SpecialtyDef } from "./specialties";

/** Shop and stats modal — full evolution/evolution card details. */
export function EvolutionTooltipContent({
  def,
  owned = false,
}: {
  def: SpecialtyDef;
  owned?: boolean;
}) {
  return (
    <Stack gap="1.5">
      <ShopTooltipHeader
        price={owned ? undefined : formatShopCost(def.price)}
      >
        {def.name}
      </ShopTooltipHeader>
      <ShopEffectText>{def.effectText}</ShopEffectText>
      <ShopFlavorText>{def.ecologyNote}</ShopFlavorText>
    </Stack>
  );
}
