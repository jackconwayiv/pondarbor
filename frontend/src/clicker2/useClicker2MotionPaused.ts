import { useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION).matches;
}

function subscribeDocumentHidden(cb: () => void) {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
}

function getDocumentHidden(): boolean {
  return document.hidden;
}

/** Pause decorative CSS animations when the tab is hidden or motion is reduced. */
export function useClicker2MotionPaused(): boolean {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );
  const documentHidden = useSyncExternalStore(
    subscribeDocumentHidden,
    getDocumentHidden,
    () => false,
  );
  return reducedMotion || documentHidden;
}
