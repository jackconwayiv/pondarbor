export type PondCycleFlowPhase =
  | "idle"
  | "savingBeforeInterstitial"
  | "fadeToInterstitialIn"
  | "fadeToInterstitialOut"
  | "interstitial"
  | "fadeToApplyIn"
  | "fadeToPondOut";

export function isPondCycleGameplayPaused(phase: PondCycleFlowPhase): boolean {
  return phase !== "idle";
}

export function canBuyFossilShopDuringFlow(phase: PondCycleFlowPhase): boolean {
  return phase === "interstitial";
}

/** Fossil shop overlay visible (cycle interstitial and its fade legs). */
export function isFossilShopInterstitialUiPhase(phase: PondCycleFlowPhase): boolean {
  return (
    phase === "interstitial" ||
    phase === "fadeToInterstitialOut" ||
    phase === "fadeToApplyIn"
  );
}
