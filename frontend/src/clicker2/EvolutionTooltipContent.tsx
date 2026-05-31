import { Stack } from "@chakra-ui/react";

import { formatShopCost } from "./formatEnergy";
import {
  ShopEffectText,
  ShopFlavorText,
  ShopPriceText,
  ShopTooltipHeader,
} from "./shopTooltipText";
import type { SpecialtyDef } from "./specialties";

/** Shop and stats modal — full evolution/evolution card details. */
export function EvolutionTooltipContent({
  def,
  owned = false,
  canAfford = true,
}: {
  def: SpecialtyDef;
  owned?: boolean;
  canAfford?: boolean;
}) {
  return (
    <Stack gap="1.5">
      <ShopTooltipHeader
        price={
          owned ? undefined : (
            <ShopPriceText color={canAfford ? "black" : "nautical.solid"}>
              {formatShopCost(def.price)}
            </ShopPriceText>
          )
        }
      >
        {def.name}
      </ShopTooltipHeader>
      <ShopEffectText>{def.effectText}</ShopEffectText>
      <ShopFlavorText>{def.ecologyNote}</ShopFlavorText>
    </Stack>
  );
}
