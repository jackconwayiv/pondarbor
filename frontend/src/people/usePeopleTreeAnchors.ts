import { useCallback, useLayoutEffect, useRef, useState } from "react";

import type { PersonAnchor, Point } from "./peopleTreeLayout";

export type PeopleTreeLayout = {
  width: number;
  height: number;
  anchors: Map<string, PersonAnchor>;
};

const LAYOUT_EPSILON = 0.5;

function pointsNear(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < LAYOUT_EPSILON && Math.abs(a.y - b.y) < LAYOUT_EPSILON;
}

function anchorsNear(
  prev: Map<string, PersonAnchor>,
  next: Map<string, PersonAnchor>,
): boolean {
  if (prev.size !== next.size) return false;
  for (const [id, pa] of prev) {
    const pb = next.get(id);
    if (!pb) return false;
    if (
      !pointsNear(pa.top, pb.top) ||
      !pointsNear(pa.bottom, pb.bottom) ||
      !pointsNear(pa.center, pb.center)
    ) {
      return false;
    }
  }
  return true;
}

export function usePeopleTreeAnchors(personCount: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const anchorElsRef = useRef(new Map<string, HTMLElement>());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [layout, setLayout] = useState<PeopleTreeLayout | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const anchors = new Map<string, PersonAnchor>();
    for (const [id, el] of anchorElsRef.current) {
      const r = el.getBoundingClientRect();
      const x = r.left - cr.left;
      const y = r.top - cr.top;
      const w = r.width;
      const h = r.height;
      anchors.set(id, {
        top: { x: x + w / 2, y },
        bottom: { x: x + w / 2, y: y + h },
        center: { x: x + w / 2, y: y + h / 2 },
        left: { x, y: y + h / 2 },
        right: { x: x + w, y: y + h / 2 },
      });
    }
    const width = Math.max(container.offsetWidth, cr.width);
    const height = Math.max(container.offsetHeight, cr.height);
    setLayout((prev) => {
      if (
        prev &&
        Math.abs(prev.width - width) < LAYOUT_EPSILON &&
        Math.abs(prev.height - height) < LAYOUT_EPSILON &&
        anchorsNear(prev.anchors, anchors)
      ) {
        return prev;
      }
      return { width, height, anchors };
    });
  }, []);

  const scheduleMeasure = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => measure());
    });
  }, [measure]);

  const registerAnchor = useCallback(
    (personId: string, el: HTMLElement | null) => {
      const ro = resizeObserverRef.current;
      const prev = anchorElsRef.current.get(personId);
      if (prev === el) return;

      if (el) {
        anchorElsRef.current.set(personId, el);
        ro?.observe(el);
      } else {
        if (prev) ro?.unobserve(prev);
        anchorElsRef.current.delete(personId);
      }
      scheduleMeasure();
    },
    [scheduleMeasure],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => measure());
    resizeObserverRef.current = ro;
    ro.observe(container);
    for (const el of anchorElsRef.current.values()) {
      ro.observe(el);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      resizeObserverRef.current = null;
      window.removeEventListener("resize", measure);
    };
  }, [measure, personCount]);

  return { containerRef, registerAnchor, layout, bumpMeasure: scheduleMeasure };
}
