import { useLayoutEffect, useRef, useState } from "react";

import type { GameLocationTypes, GameStateTypes } from "./shantiesTypes";

export function getSceneKey(
  gameState: GameStateTypes,
  location: GameLocationTypes,
): string {
  return `${gameState}:${location}`;
}

export function parseSceneKey(key: string): {
  gameState: GameStateTypes;
  location: GameLocationTypes;
} {
  const [gameState, location] = key.split(":") as [
    GameStateTypes,
    GameLocationTypes,
  ];
  return { gameState, location };
}

/** Total fade duration (fade out + fade in) for a scene change. */
export function getSceneTransitionMs(
  previousKey: string | null,
  nextKey: string,
): number {
  if (previousKey === null || previousKey === nextKey) return 0;

  const enteringCombat =
    nextKey.startsWith("battle:") && !previousKey.startsWith("battle:");
  if (enteringCombat) return 1000;

  return 500;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useSquallsSceneFade(sceneKey: string) {
  const [displayKey, setDisplayKey] = useState(sceneKey);
  const [opacity, setOpacity] = useState(1);
  const [fadeMs, setFadeMs] = useState(0);
  const previousKeyRef = useRef(sceneKey);
  const skipInitialFadeRef = useRef(true);
  const timeoutRef = useRef<number | null>(null);

  const clearTransitionTimeout = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useLayoutEffect(() => {
    if (skipInitialFadeRef.current) {
      skipInitialFadeRef.current = false;
      previousKeyRef.current = sceneKey;
      return;
    }

    if (sceneKey === previousKeyRef.current) return;

    const previousKey = previousKeyRef.current;
    previousKeyRef.current = sceneKey;

    clearTransitionTimeout();

    let duration = getSceneTransitionMs(previousKey, sceneKey);
    if (prefersReducedMotion()) duration = 0;

    if (duration === 0) {
      setDisplayKey(sceneKey);
      setOpacity(1);
      setFadeMs(0);
      return;
    }

    const half = duration / 2;
    setFadeMs(half);
    setOpacity(0);

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setDisplayKey(sceneKey);
      requestAnimationFrame(() => setOpacity(1));
    }, half);

    return clearTransitionTimeout;
  }, [sceneKey]);

  const { gameState, location } = parseSceneKey(displayKey);
  const scenePending = sceneKey !== displayKey;
  const isTransitioning = scenePending || (opacity < 1 && fadeMs > 0);

  return {
    gameState,
    location,
    displayKey,
    opacity,
    fadeMs,
    isTransitioning,
    scenePending,
  };
}
