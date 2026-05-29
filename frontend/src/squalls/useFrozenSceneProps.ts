import { useRef } from "react";

/**
 * While the displayed scene key lags the live scene key (fade out), keep the last
 * snapshot so WorldPanel does not flash unrelated UI from already-updated game state.
 * After the swap (fade in), refresh the snapshot when display matches live.
 *
 * All WorldPanel visual props must come from pickWorldPanelVisuals() in
 * worldPanelVisuals.ts — never pass live game state alongside the frozen spread.
 */
export function useFrozenSceneProps<T>({
  shouldFreeze,
  displayKey,
  sceneKey,
  props,
}: {
  shouldFreeze: boolean;
  displayKey: string;
  sceneKey: string;
  props: T;
}): T {
  const frozenRef = useRef(props);

  if (!shouldFreeze) {
    frozenRef.current = props;
  } else if (displayKey === sceneKey) {
    frozenRef.current = props;
  }

  return shouldFreeze ? frozenRef.current : props;
}
