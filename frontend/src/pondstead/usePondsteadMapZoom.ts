import { useEffect, useRef, useState } from "react";

import { PONDSTEAD_VIEW_VISIBLE_COLUMNS, type PondsteadViewMode } from "./viewModes";

const PINCH_MIN = 0.45;
const PINCH_MAX = 2.6;
/** Ctrl/cmd + wheel (incl. many trackpad “pinch” gestures). */
const WHEEL_ZOOM_STEP = 0.02;
/** Classic mouse wheel (line steps); also used when we avoid hijacking smooth trackpad scroll. */
const WHEEL_ZOOM_STEP_LINE = 0.012;

function clampPinch(n: number): number {
  return Math.min(PINCH_MAX, Math.max(PINCH_MIN, n));
}

function isZoomWheelEvent(e: WheelEvent): "pinch" | "line" | null {
  if (e.ctrlKey || e.metaKey || e.altKey) {
    return "pinch";
  }
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return "line";
  }
  if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return "line";
  }
  return null;
}

function touchDistance(t: TouchList): number {
  if (t.length < 2) return 0;
  const a = t[0]!;
  const b = t[1]!;
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

export type UsePondsteadMapZoom = {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  mapViewportWidthPx: number;
  pinchScale: number;
  setPinchScale: React.Dispatch<React.SetStateAction<number>>;
  cellSizePx: number;
};

const MIN_TILE_PX = 28;

/**
 * Measures the map viewport, computes tile size for the selected field-of-view
 * (3 / 6 / 9 columns) times {@link pinchScale}, and attaches pinch (two-finger)
 * and wheel zoom: Ctrl or ⌘ + wheel, line-based mouse wheel, or two-finger pinch
 * (often reported as Ctrl+wheel). Smooth pixel-delta wheels keep default scroll
 * (trackpad pan); use Ctrl/⌘ + scroll to zoom in that case.
 */
export function usePondsteadMapZoom(
  viewMode: PondsteadViewMode,
  pinchScale: number,
  setPinchScale: React.Dispatch<React.SetStateAction<number>>,
): UsePondsteadMapZoom {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [mapViewportWidthPx, setMapViewportWidthPx] = useState(0);
  const pinchStateRef = useRef<{
    startDistance: number;
    startScale: number;
  } | null>(null);
  const pinchScaleRef = useRef(pinchScale);
  pinchScaleRef.current = pinchScale;
  const setPinchScaleRef = useRef(setPinchScale);
  setPinchScaleRef.current = setPinchScale;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setMapViewportWidthPx(w);
    };
    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(el);
    measure();
    return () => {
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      const mode = isZoomWheelEvent(e);
      if (mode == null) return;
      e.preventDefault();
      const step = mode === "pinch" ? WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP_LINE;
      setPinchScaleRef.current((s) => clampPinch(s * (1 - e.deltaY * step)));
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const d = touchDistance(e.touches);
        if (d > 0) {
          pinchStateRef.current = { startDistance: d, startScale: pinchScaleRef.current };
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStateRef.current) {
        e.preventDefault();
        const d = touchDistance(e.touches);
        if (d > 0) {
          const { startDistance, startScale } = pinchStateRef.current;
          const ratio = d / startDistance;
          setPinchScaleRef.current(clampPinch(startScale * ratio));
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchStateRef.current = null;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const visible = PONDSTEAD_VIEW_VISIBLE_COLUMNS[viewMode];
  const baseCell =
    mapViewportWidthPx > 0
      ? (mapViewportWidthPx / Math.max(1, visible)) * pinchScale
      : 0;
  const cellSizePx =
    mapViewportWidthPx > 0 ? Math.max(MIN_TILE_PX, baseCell) : 0;

  return {
    viewportRef,
    mapViewportWidthPx,
    pinchScale,
    setPinchScale,
    cellSizePx,
  };
}
