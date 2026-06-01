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
  canAfford = true,
  costLabel,
}: {
  def: SpecialtyDef;
  owned?: boolean;
  canAfford?: boolean;
  /** Overrides energy shop cost display (e.g. fossil price). */
  costLabel?: string;
}) {
  const priceText =
    costLabel ??
    (def.priceFossils != null && def.priceFossils > 0
      ? `${def.priceFossils} 🦴`
      : formatShopCost(def.price));

  return (
    <Stack gap="1.5">
      <ShopTooltipHeader
        price={owned ? undefined : priceText}
        priceColor={canAfford ? "black" : "nautical.solid"}
      >
        {def.name}
      </ShopTooltipHeader>
      <ShopEffectText>{def.effectText}</ShopEffectText>
      <ShopFlavorText>{def.ecologyNote}</ShopFlavorText>
    </Stack>
  );
}
