import {
  DENIZENS,
  denizenFullRevealEnergyThreshold,
  denizenTeaseEnergyThreshold,
  getDenizenDef,
  getDenizenIndex,
  getOwnedDenizenCount,
} from "./denizens";
import type { SpecialtyDef } from "./specialties";

/** Previous denizen owned count before this card appears (silhouette + ???). */
export const DENIZEN_TEASE_PREV_OWNED = 1;
export const DENIZEN_FULL_REVEAL_PREV_OWNED = 25;

function previousDenizenId(denizenId: string): string | null {
  const index = getDenizenIndex(denizenId);
  if (index <= 0) return null;
  return DENIZENS[index - 1]!.id;
}

function previousDenizenOwned(
  denizenId: string,
  ownedDenizens: Record<string, number>,
): number {
  const prevId = previousDenizenId(denizenId);
  if (!prevId) return 0;
  return getOwnedDenizenCount(ownedDenizens, prevId);
}

/** Card appears in the shop (silhouette + ??? until identity reveal triggers). */
export function denizenTeaseEligible(
  denizenId: string,
  energy: number,
  ownedDenizens: Record<string, number>,
): boolean {
  const index = getDenizenIndex(denizenId);
  if (index < 0) return false;
  if (index === 0) return true;

  const def = getDenizenDef(denizenId);
  if (!def) return false;

  if (previousDenizenOwned(denizenId, ownedDenizens) >= DENIZEN_TEASE_PREV_OWNED) {
    return true;
  }

  return energy >= denizenTeaseEnergyThreshold(def);
}

/** Real emoji and name shown on the card. */
export function denizenFullRevealEligible(
  denizenId: string,
  energy: number,
  ownedDenizens: Record<string, number>,
): boolean {
  const index = getDenizenIndex(denizenId);
  if (index < 0) return false;
  if (index === 0) return true;

  const def = getDenizenDef(denizenId);
  if (!def) return false;

  if (
    previousDenizenOwned(denizenId, ownedDenizens) >=
    DENIZEN_FULL_REVEAL_PREV_OWNED
  ) {
    return true;
  }

  return energy >= denizenFullRevealEnergyThreshold(def);
}

export function isDenizenTeased(
  denizenId: string,
  energy: number,
  ownedDenizens: Record<string, number>,
  revealedDenizens: Record<string, boolean>,
): boolean {
  if (revealedDenizens[denizenId]) return true;
  const prevId = previousDenizenId(denizenId);
  if (
    prevId &&
    isDenizenIdentityRevealed(prevId, energy, ownedDenizens, revealedDenizens)
  ) {
    return true;
  }
  return denizenTeaseEligible(denizenId, energy, ownedDenizens);
}

export function isDenizenIdentityRevealed(
  denizenId: string,
  energy: number,
  ownedDenizens: Record<string, number>,
  revealedDenizens: Record<string, boolean>,
): boolean {
  if (getOwnedDenizenCount(ownedDenizens, denizenId) > 0) return true;
  if (revealedDenizens[denizenId]) return true;
  return denizenFullRevealEligible(denizenId, energy, ownedDenizens);
}

/** @deprecated Use isDenizenTeased for shop visibility. */
export function isDenizenRevealed(
  denizenId: string,
  energy: number,
  ownedDenizens: Record<string, number>,
  revealedDenizens: Record<string, boolean>,
): boolean {
  return isDenizenTeased(denizenId, energy, ownedDenizens, revealedDenizens);
}

export function mergeNewlyRevealedDenizens(
  energy: number,
  ownedDenizens: Record<string, number>,
  revealedDenizens: Record<string, boolean>,
): Record<string, boolean> {
  let next: Record<string, boolean> | null = null;
  for (const def of DENIZENS) {
    if (revealedDenizens[def.id]) continue;
    if (!denizenFullRevealEligible(def.id, energy, ownedDenizens)) continue;
    if (!next) next = { ...revealedDenizens };
    next[def.id] = true;
  }
  return next ?? revealedDenizens;
}

export function isSpecialtyUnlocked(
  specialty: Pick<
    SpecialtyDef,
    | "unlockOwned"
    | "unlockAllTimeEnergy"
    | "unlockClickEnergy"
    | "denizenId"
    | "pairingUnlock"
  >,
  ownedDenizens: Record<string, number>,
  allTimeEnergyEarned: number,
  energyFromClicking = 0,
): boolean {
  if (specialty.pairingUnlock) {
    for (const [denizenId, required] of Object.entries(specialty.pairingUnlock)) {
      if (getOwnedDenizenCount(ownedDenizens, denizenId) < required) {
        return false;
      }
    }
    return true;
  }
  if (specialty.unlockClickEnergy != null) {
    return energyFromClicking >= specialty.unlockClickEnergy;
  }
  if (specialty.unlockAllTimeEnergy != null) {
    return allTimeEnergyEarned >= specialty.unlockAllTimeEnergy;
  }
  return (
    getOwnedDenizenCount(ownedDenizens, specialty.denizenId) >=
    specialty.unlockOwned
  );
}

/** Visible when unowned and its unlock threshold is met (not gated by prior tiers owned). */
export function isSpecialtyShopVisible(
  specialty: SpecialtyDef,
  ownedDenizens: Record<string, number>,
  ownedSpecialties: Record<number, boolean>,
  allTimeEnergyEarned: number,
  energyFromClicking = 0,
): boolean {
  if (ownedSpecialties[specialty.id]) return false;
  return isSpecialtyUnlocked(
    specialty,
    ownedDenizens,
    allTimeEnergyEarned,
    energyFromClicking,
  );
}
