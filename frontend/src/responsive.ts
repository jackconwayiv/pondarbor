import { useEffect, useState, useSyncExternalStore } from "react";

// Align with Chakra default `md` breakpoint (48em ~= 768px).
export const DESKTOP_MIN_WIDTH_PX = 768;

const POINTER_COARSE_QUERY = "(pointer: coarse)";

function subscribePointerCoarse(callback: () => void) {
  const mq = window.matchMedia(POINTER_COARSE_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getPointerCoarseSnapshot() {
  return window.matchMedia(POINTER_COARSE_QUERY).matches;
}

/** True for typical phones/tablets (touch primary). Use to avoid mouse-only UX like outside-click dismiss. */
export function usePrefersCoarsePointer() {
  return useSyncExternalStore(
    subscribePointerCoarse,
    getPointerCoarseSnapshot,
    () => false,
  );
}

/**
 * Main content is inset 2px from the viewport by `AppLayout` `main` padding; use `100%` width
 * within that area (do not `100vw` out of the content box here).
 */
export const fullBleedStackProps = {} as const;

/**
 * For site footer *bars* that should span the viewport while nested under the main inset
 * (e.g. home and games hub).
 */
export const viewPortWidthBarProps = {
  position: "relative" as const,
  left: "50%",
  w: "100vw",
  maxW: "100vw",
  transform: "translateX(-50%)",
} as const;

function getIsMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < DESKTOP_MIN_WIDTH_PX;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(getIsMobileViewport);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(getIsMobileViewport());
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return isMobile;
}
