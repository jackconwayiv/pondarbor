import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import type { PersonAnchor } from "./peopleTreeLayout";

const DRAG_THRESHOLD_PX = 4;

/** Furthest zoom out (+/− and pinch). */
export const PEOPLE_TREE_SCALE_MIN = 0.2;
export const PEOPLE_TREE_SCALE_MAX = 2.5;
export const PEOPLE_TREE_ZOOM_STEP = 1.15;

/** Previous default before lowering initial zoom (3 notches). */
const PEOPLE_TREE_SCALE_LEGACY_DEFAULT = 0.6;

/** Initial scale for View and Rearrange (3 zoom-out notches below legacy default). */
export const PEOPLE_TREE_SCALE_DEFAULT = clampPeopleTreeScale(
  PEOPLE_TREE_SCALE_LEGACY_DEFAULT / PEOPLE_TREE_ZOOM_STEP ** 3,
);

const WHEEL_ZOOM_STEP = 0.02;
const WHEEL_ZOOM_STEP_LINE = 0.012;

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  active: boolean;
};

export type PeopleTreePan = { x: number; y: number };

export type PeopleTreePanBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type PeopleTreePanMargins = {
  top?: number;
  side?: number;
  bottom?: number;
  bottomExtra?: number;
};

export type PeopleTreeInitialAlign = "center" | "top";

type MarginInput = number | PeopleTreePanMargins;

export type UsePeopleTreePanOptions = {
  viewportW: number;
  viewportH: number;
  contentW: number;
  contentH: number;
  panAreaRef: RefObject<HTMLElement | null>;
  /** Pinch and ctrl/meta wheel zoom; default true. */
  enablePinchZoom?: boolean;
  /** Per-edge pan insets; defaults to {@link PEOPLE_TREE_PAN_MARGIN} on all sides. */
  panMargins?: PeopleTreePanMargins;
  /** @deprecated Prefer `panMargins.bottomExtra`. Merged when `bottomExtra` is omitted from `panMargins`. */
  panBottomExtra?: number;
  /** Initial vertical framing; view mode uses `"top"`. */
  initialAlign?: PeopleTreeInitialAlign;
};

/** Keep at least `margin` px of padding between graph edges and the viewport. */
export const PEOPLE_TREE_PAN_MARGIN = 40;

/** Extra scroll range below measured content (≈ one generation row on mobile). */
export const PEOPLE_TREE_PAN_BOTTOM_EXTRA = 160;

export function normalizePanMargins(
  marginOrMargins: MarginInput = PEOPLE_TREE_PAN_MARGIN,
  bottomExtra?: number,
): PeopleTreePanMargins {
  if (typeof marginOrMargins === "number") {
    return {
      top: marginOrMargins,
      side: marginOrMargins,
      bottom: marginOrMargins,
      bottomExtra: bottomExtra ?? 0,
    };
  }
  return {
    ...marginOrMargins,
    bottomExtra: bottomExtra ?? marginOrMargins.bottomExtra,
  };
}

export function resolvePanMargins(m?: PeopleTreePanMargins): {
  top: number;
  side: number;
  bottom: number;
  bottomExtra: number;
} {
  return {
    top: m?.top ?? PEOPLE_TREE_PAN_MARGIN,
    side: m?.side ?? PEOPLE_TREE_PAN_MARGIN,
    bottom: m?.bottom ?? PEOPLE_TREE_PAN_MARGIN,
    bottomExtra: m?.bottomExtra ?? 0,
  };
}

export function clampPeopleTreeScale(scale: number): number {
  return Math.min(PEOPLE_TREE_SCALE_MAX, Math.max(PEOPLE_TREE_SCALE_MIN, scale));
}

export function computePeopleTreePanBounds(
  viewportW: number,
  viewportH: number,
  contentW: number,
  contentH: number,
  marginOrMargins: MarginInput = PEOPLE_TREE_PAN_MARGIN,
  bottomExtra?: number,
): PeopleTreePanBounds {
  const { top, side, bottom, bottomExtra: extra } = resolvePanMargins(
    normalizePanMargins(marginOrMargins, bottomExtra),
  );
  const axisX = (viewport: number, content: number) => {
    if (content <= viewport) {
      const centered = (viewport - content) / 2;
      return { min: centered, max: centered };
    }
    return {
      min: viewport - content - side,
      max: side,
    };
  };
  const x = axisX(viewportW, contentW);
  let yMin: number;
  let yMax: number;
  if (contentH <= viewportH) {
    const centered = (viewportH - contentH) / 2;
    yMin = centered;
    yMax = centered;
  } else {
    yMin = viewportH - contentH - bottom - extra;
    yMax = top;
  }
  return { minX: x.min, maxX: x.max, minY: yMin, maxY: yMax };
}

export function clampPeopleTreePan(
  pan: PeopleTreePan,
  bounds: PeopleTreePanBounds,
): PeopleTreePan {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, pan.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, pan.y)),
  };
}

/** Adjust pan so content point under focal stays fixed when scale changes. */
export function panForScaleChange(
  pan: PeopleTreePan,
  oldScale: number,
  newScale: number,
  focalX: number,
  focalY: number,
): PeopleTreePan {
  const contentX = (focalX - pan.x) / oldScale;
  const contentY = (focalY - pan.y) / oldScale;
  return {
    x: focalX - contentX * newScale,
    y: focalY - contentY * newScale,
  };
}

/** Initial pan: center focus horizontally; contentW/H should already include scale. */
export function computePeopleTreeInitialPan(
  viewportW: number,
  viewportH: number,
  contentW: number,
  contentH: number,
  focusX: number,
  focusY: number,
  scale: number,
  marginOrMargins: MarginInput = PEOPLE_TREE_PAN_MARGIN,
  bottomExtra?: number,
  align: PeopleTreeInitialAlign = "center",
  contentTopY = 0,
): PeopleTreePan {
  const margins = normalizePanMargins(marginOrMargins, bottomExtra);
  const bounds = computePeopleTreePanBounds(
    viewportW,
    viewportH,
    contentW,
    contentH,
    margins,
  );
  const { top } = resolvePanMargins(margins);
  const x = viewportW / 2 - focusX * scale;
  let y: number;
  if (align === "top") {
    y = top - contentTopY * scale;
  } else if (contentH > viewportH) {
    y = viewportH / 2 - focusY * scale;
  } else {
    y = viewportH / 2 - contentH / 2;
  }
  return clampPeopleTreePan({ x, y }, bounds);
}

export function contentTopFromAnchors(anchors: Map<string, PersonAnchor>): number {
  let minY = 0;
  let found = false;
  for (const anchor of anchors.values()) {
    if (!found || anchor.top.y < minY) {
      minY = anchor.top.y;
      found = true;
    }
  }
  return minY;
}

export function contentBottomFromAnchors(anchors: Map<string, PersonAnchor>): number {
  let maxY = 0;
  for (const anchor of anchors.values()) {
    if (anchor.bottom.y > maxY) maxY = anchor.bottom.y;
  }
  return maxY;
}

function isPanBlockedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target.closest("[data-people-tree-zoom]") ||
    target.closest("[data-person-card]") ||
    target.closest("[data-tree-draggable]") ||
    target.closest("button") ||
    target.closest("a") ||
    target.closest("input") ||
    target.closest("select") ||
    target.closest("textarea")
  ) {
    return true;
  }
  // Occupied grid cells: pan on empty cells only (rearrange view).
  const cell = target.closest("[data-tree-cell-droppable]");
  if (cell?.querySelector("[data-person-card], [data-tree-draggable]")) {
    return true;
  }
  return false;
}

function isZoomWheelEvent(e: WheelEvent): "pinch" | "line" | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return "pinch";
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) return "line";
  if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) return "line";
  return null;
}

function touchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const a = touches[0]!;
  const b = touches[1]!;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function touchCentroid(touches: TouchList, rect: DOMRect): { x: number; y: number } {
  if (touches.length < 2) return { x: rect.width / 2, y: rect.height / 2 };
  const a = touches[0]!;
  const b = touches[1]!;
  return {
    x: (a.clientX + b.clientX) / 2 - rect.left,
    y: (a.clientY + b.clientY) / 2 - rect.top,
  };
}

function panMarginsForHook(
  panMargins?: PeopleTreePanMargins,
  panBottomExtra?: number,
): PeopleTreePanMargins {
  const base = panMargins ?? {};
  if (panBottomExtra !== undefined && base.bottomExtra === undefined) {
    return { ...base, bottomExtra: panBottomExtra };
  }
  if (panMargins == null && panBottomExtra === undefined) {
    return { bottomExtra: PEOPLE_TREE_PAN_BOTTOM_EXTRA };
  }
  return base;
}

export function usePeopleTreePan({
  viewportW,
  viewportH,
  contentW,
  contentH,
  panAreaRef,
  enablePinchZoom = true,
  panMargins,
  panBottomExtra,
  initialAlign = "center",
}: UsePeopleTreePanOptions) {
  const resolvedMargins = useMemo(
    () => panMarginsForHook(panMargins, panBottomExtra),
    [panMargins, panBottomExtra],
  );
  const [pan, setPan] = useState<PeopleTreePan>({ x: 0, y: 0 });
  const [scale, setScale] = useState(PEOPLE_TREE_SCALE_DEFAULT);
  const panRef = useRef(pan);
  panRef.current = pan;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const dragRef = useRef<DragState | null>(null);
  const pinchingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const scaledContentW = contentW * scale;
  const scaledContentH = contentH * scale;

  const bounds = useMemo(() => {
    if (viewportW <= 0 || viewportH <= 0 || scaledContentW <= 0 || scaledContentH <= 0) {
      return null;
    }
    return computePeopleTreePanBounds(
      viewportW,
      viewportH,
      scaledContentW,
      scaledContentH,
      resolvedMargins,
    );
  }, [viewportW, viewportH, scaledContentW, scaledContentH, resolvedMargins]);

  const applyBounds = useCallback(
    (next: PeopleTreePan) => {
      return bounds ? clampPeopleTreePan(next, bounds) : next;
    },
    [bounds],
  );

  const setPanBounded = useCallback(
    (next: PeopleTreePan) => {
      setPan(applyBounds(next));
    },
    [applyBounds],
  );

  const applyScaleAtFocal = useCallback(
    (newScale: number, focalX: number, focalY: number) => {
      const clamped = clampPeopleTreeScale(newScale);
      const oldScale = scaleRef.current;
      if (Math.abs(clamped - oldScale) < 1e-6) return;
      const nextPan = panForScaleChange(panRef.current, oldScale, clamped, focalX, focalY);
      scaleRef.current = clamped;
      setScale(clamped);
      setPanBounded(nextPan);
    },
    [setPanBounded],
  );

  const viewportCenterFocal = useCallback(() => {
    return { x: viewportW / 2, y: viewportH / 2 };
  }, [viewportW, viewportH]);

  const zoomIn = useCallback(() => {
    const focal = viewportCenterFocal();
    applyScaleAtFocal(scaleRef.current * PEOPLE_TREE_ZOOM_STEP, focal.x, focal.y);
  }, [applyScaleAtFocal, viewportCenterFocal]);

  const zoomOut = useCallback(() => {
    const focal = viewportCenterFocal();
    applyScaleAtFocal(scaleRef.current / PEOPLE_TREE_ZOOM_STEP, focal.x, focal.y);
  }, [applyScaleAtFocal, viewportCenterFocal]);

  const canZoomIn = scale < PEOPLE_TREE_SCALE_MAX - 1e-6;
  const canZoomOut = scale > PEOPLE_TREE_SCALE_MIN + 1e-6;

  useEffect(() => {
    if (!bounds) return;
    setPan((current) => {
      const clamped = applyBounds(current);
      if (clamped.x === current.x && clamped.y === current.y) return current;
      return clamped;
    });
  }, [bounds?.minX, bounds?.maxX, bounds?.minY, bounds?.maxY, applyBounds]);

  useEffect(() => {
    const el = panAreaRef.current;
    if (!el || viewportW <= 0 || viewportH <= 0) return;
    if (!enablePinchZoom) return;

    const pinchStateRef = { startDistance: 0, startScale: 1, focalX: 0, focalY: 0 };

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      const mode = isZoomWheelEvent(e);
      if (mode == null) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const focalX = e.clientX - rect.left;
      const focalY = e.clientY - rect.top;
      const step = mode === "pinch" ? WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP_LINE;
      const next = clampPeopleTreeScale(scaleRef.current * (1 - e.deltaY * step));
      applyScaleAtFocal(next, focalX, focalY);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchingRef.current = true;
        dragRef.current = null;
        setDragging(false);
        const rect = el.getBoundingClientRect();
        const d = touchDistance(e.touches);
        const c = touchCentroid(e.touches, rect);
        if (d > 0) {
          pinchStateRef.startDistance = d;
          pinchStateRef.startScale = scaleRef.current;
          pinchStateRef.focalX = c.x;
          pinchStateRef.focalY = c.y;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchingRef.current) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const d = touchDistance(e.touches);
        const c = touchCentroid(e.touches, rect);
        if (d > 0 && pinchStateRef.startDistance > 0) {
          const ratio = d / pinchStateRef.startDistance;
          const next = clampPeopleTreeScale(pinchStateRef.startScale * ratio);
          applyScaleAtFocal(next, c.x, c.y);
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchingRef.current = false;
        pinchStateRef.startDistance = 0;
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
  }, [panAreaRef, viewportW, viewportH, applyScaleAtFocal, enablePinchZoom]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    if (pinchingRef.current) return;
    if (isPanBlockedTarget(e.target)) return;

    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: panRef.current.x,
      originY: panRef.current.y,
      active: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (pinchingRef.current) return;
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.active) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        drag.active = true;
        setDragging(true);
      }
      e.preventDefault();
      setPanBounded({ x: drag.originX + dx, y: drag.originY + dy });
    },
    [setPanBounded],
  );

  const endDrag = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const centerOn = useCallback(
    (
      vw: number,
      vh: number,
      cw: number,
      ch: number,
      focusX: number,
      focusY: number,
      contentTopY = 0,
    ) => {
      const nextScale = PEOPLE_TREE_SCALE_DEFAULT;
      scaleRef.current = nextScale;
      setScale(nextScale);
      const scaledW = cw * nextScale;
      const scaledH = ch * nextScale;
      setPan(
        computePeopleTreeInitialPan(
          vw,
          vh,
          scaledW,
          scaledH,
          focusX,
          focusY,
          nextScale,
          resolvedMargins,
          undefined,
          initialAlign,
          contentTopY,
        ),
      );
    },
    [resolvedMargins, initialAlign],
  );

  const resetScale = useCallback(() => {
    scaleRef.current = PEOPLE_TREE_SCALE_DEFAULT;
    setScale(PEOPLE_TREE_SCALE_DEFAULT);
  }, []);

  return {
    pan,
    scale,
    dragging,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    centerOn,
    resetScale,
    setPanBounded,
  };
}
