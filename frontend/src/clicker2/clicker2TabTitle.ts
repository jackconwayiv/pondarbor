import { useEffect, useRef } from "react";

import { ENERGY_EMOJI } from "./formatEnergy";

/** Tab title refresh rate (independent of HUD counter animation). */
export const CLICKER2_TAB_TITLE_TICK_MS = 1000;

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
 * Update the browser tab only when the formatted label changes.
 * Fed by `useClicker2TabTitleInterval` (1 Hz, true spendable energy — not the lerped HUD).
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

/**
 * Poll effective energy for the tab label on a fixed interval (runs when the tab is hidden).
 * `resolveHudEnergyText` should use true spendable energy, not the lerped HUD display value.
 */
export function useClicker2TabTitleInterval(
  enabled: boolean,
  resolveHudEnergyText: () => string,
): void {
  const resolveRef = useRef(resolveHudEnergyText);
  resolveRef.current = resolveHudEnergyText;

  useEffect(() => {
    if (!enabled) return;
    const tick = () => syncClicker2TabTitle(resolveRef.current());
    tick();
    const id = window.setInterval(tick, CLICKER2_TAB_TITLE_TICK_MS);
    return () => window.clearInterval(id);
  }, [enabled]);
}
