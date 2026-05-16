import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { PersonAnchor } from "./peopleTreeLayout";

const DRAG_THRESHOLD_PX = 4;

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

/** Keep at least `margin` px of padding between graph edges and the viewport. */
export const PEOPLE_TREE_PAN_MARGIN = 40;

export function computePeopleTreePanBounds(
  viewportW: number,
  viewportH: number,
  contentW: number,
  contentH: number,
  margin = PEOPLE_TREE_PAN_MARGIN,
): PeopleTreePanBounds {
  const axis = (viewport: number, content: number) => {
    if (content <= viewport) {
      const centered = (viewport - content) / 2;
      return { min: centered, max: centered };
    }
    return {
      min: viewport - content - margin,
      max: margin,
    };
  };
  const x = axis(viewportW, contentW);
  const y = axis(viewportH, contentH);
  return { minX: x.min, maxX: x.max, minY: y.min, maxY: y.max };
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

/** Initial pan: center focus horizontally; align graph top when content is scrollable. */
export function computePeopleTreeInitialPan(
  viewportW: number,
  viewportH: number,
  contentW: number,
  contentH: number,
  focusX: number,
  contentTopY: number,
  margin = PEOPLE_TREE_PAN_MARGIN,
): PeopleTreePan {
  const bounds = computePeopleTreePanBounds(viewportW, viewportH, contentW, contentH, margin);
  const x = viewportW / 2 - focusX;
  const y = contentH > viewportH ? margin - contentTopY : viewportH / 2 - contentH / 2;
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

function isPanBlockedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("[data-person-card]") ||
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("textarea"),
  );
}

export function usePeopleTreePan(bounds: PeopleTreePanBounds | null) {
  const [pan, setPan] = useState<PeopleTreePan>({ x: 0, y: 0 });
  const panRef = useRef(pan);
  panRef.current = pan;
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);

  const applyBounds = useCallback((next: PeopleTreePan) => {
    const b = boundsRef.current;
    return b ? clampPeopleTreePan(next, b) : next;
  }, []);

  const setPanBounded = useCallback(
    (next: PeopleTreePan) => {
      setPan(applyBounds(next));
    },
    [applyBounds],
  );

  useEffect(() => {
    if (!bounds) return;
    setPan((current) => {
      const clamped = applyBounds(current);
      if (clamped.x === current.x && clamped.y === current.y) return current;
      return clamped;
    });
  }, [bounds?.minX, bounds?.maxX, bounds?.minY, bounds?.maxY, applyBounds]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
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

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
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
  }, [setPanBounded]);

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
      viewportW: number,
      viewportH: number,
      contentW: number,
      contentH: number,
      focusX: number,
      contentTopY: number,
    ) => {
      setPanBounded(
        computePeopleTreeInitialPan(
          viewportW,
          viewportH,
          contentW,
          contentH,
          focusX,
          contentTopY,
        ),
      );
    },
    [setPanBounded],
  );

  return {
    pan,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    centerOn,
    setPanBounded,
    applyBounds,
  };
}
