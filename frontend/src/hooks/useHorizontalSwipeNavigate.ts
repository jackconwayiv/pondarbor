import { useCallback, useRef, type TouchEventHandler } from "react";

const SWIPE_THRESHOLD_PX = 48;

type Options = {
  enabled?: boolean;
  /** Finger moves left (content moves right) — e.g. next page. */
  onSwipeLeft?: () => void;
  /** Finger moves right — e.g. previous page. */
  onSwipeRight?: () => void;
};

/**
 * Touch swipe left/right for pagers. Ignores mostly-vertical gestures so nested scroll still works.
 */
export function useHorizontalSwipeNavigate({
  enabled = true,
  onSwipeLeft,
  onSwipeRight,
}: Options): {
  onTouchStart: TouchEventHandler;
  onTouchEnd: TouchEventHandler;
} {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback<TouchEventHandler>((e) => {
    if (!enabled) return;
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, [enabled]);

  const onTouchEnd = useCallback<TouchEventHandler>(
    (e) => {
      if (!enabled) return;
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
      if (Math.abs(dx) <= Math.abs(dy)) return;
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    },
    [enabled, onSwipeLeft, onSwipeRight],
  );

  return { onTouchStart, onTouchEnd };
}
