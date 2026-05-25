import { ENERGY_EMOJI } from "./formatEnergy";

const DEFAULT_BASE_TITLE = "Pond Arbor";

let baseTitle = DEFAULT_BASE_TITLE;
let lastSyncedTitle: string | null = null;

/** Remember the route title before PondClicker overwrites it. */
export function captureClicker2TabTitleBase(): void {
  if (typeof document === "undefined") return;
  baseTitle = document.title || DEFAULT_BASE_TITLE;
  lastSyncedTitle = null;
}

/**
 * Update the browser tab only when formatted HUD energy changes.
 * Call with the same string passed to the pond counter (`formatEnergyAmountHud`).
 */
export function syncClicker2TabTitle(hudEnergyText: string): void {
  if (typeof document === "undefined") return;
  const next = `${hudEnergyText} ${ENERGY_EMOJI}`;
  if (next === lastSyncedTitle) return;
  lastSyncedTitle = next;
  document.title = next;
}

export function restoreClicker2TabTitle(): void {
  if (typeof document === "undefined") return;
  lastSyncedTitle = null;
  document.title = baseTitle;
}
