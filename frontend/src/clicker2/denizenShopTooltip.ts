export type DenizenShopTooltipSnapshot = {
  owned: number;
  eps: number;
  perCopyEps: number;
  totalEpS: number;
  energyProduced: number;
  cost: number | null;
  maxed: boolean;
  mutationLevel?: number;
};

export type GetDenizenShopTooltipSnapshot = (
  defId: string,
  owned: number,
  cost: number | null,
  maxed: boolean,
) => DenizenShopTooltipSnapshot;
