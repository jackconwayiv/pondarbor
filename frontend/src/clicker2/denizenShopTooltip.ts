export type DenizenShopTooltipSnapshot = {
  owned: number;
  eps: number;
  perCopyEps: number;
  totalEpS: number;
  energyProduced: number;
  cost: number | null;
  maxed: boolean;
  /** Next-purchase energy per 1 EpS when optics fossil shop items apply. */
  costPerEps: number | null;
  mutationLevel?: number;
};

export type GetDenizenShopTooltipSnapshot = (
  defId: string,
  owned: number,
  cost: number | null,
  maxed: boolean,
) => DenizenShopTooltipSnapshot;
