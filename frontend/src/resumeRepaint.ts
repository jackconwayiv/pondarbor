import { DESKTOP_MIN_WIDTH_PX } from "./responsive";

/**
 * Mobile Safari/WebKit sometimes fails to repaint after resume until the user scrolls or taps.
 * A cheap layout read after `pageshow` / `visibilitychange` coaxes a repaint without navigation.
 */
export function installResumeRepaintNudge(): void {
  if (typeof window === "undefined") return;

  const shouldNudge = (): boolean => {
    const coarse =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
    const narrow = window.innerWidth < DESKTOP_MIN_WIDTH_PX;
    return coarse || narrow;
  };

  const nudge = (): void => {
    requestAnimationFrame(() => {
      void document.documentElement.offsetHeight;
      void document.body.offsetHeight;
      requestAnimationFrame(() => {
        void document.documentElement.offsetHeight;
      });
    });
  };

  const onPageshow = (ev: PageTransitionEvent): void => {
    if (!shouldNudge()) return;
    if (ev.persisted) nudge();
  };

  const onVisibilityChange = (): void => {
    if (!shouldNudge()) return;
    if (document.visibilityState === "visible") nudge();
  };

  window.addEventListener("pageshow", onPageshow);
  document.addEventListener("visibilitychange", onVisibilityChange);
}
