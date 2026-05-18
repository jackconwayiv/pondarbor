import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import "./playCanvas.css";

/** Fixed design width on desktop — does not widen to fill the viewport. */
const LANDSCAPE_W = 1100;
const LANDSCAPE_H = 900;
const LANDSCAPE_OVERHANG_Y = 80;

const PORTRAIT_W = 800;
const PORTRAIT_H = 1000;
const PORTRAIT_MAX_VIEWPORT_W = 768;

export type PlayCanvasProps = {
  children: ReactNode;
};

function detectMode(): "landscape" | "portrait" {
  if (typeof window === "undefined") return "landscape";
  const portraitOrientation = window.matchMedia("(orientation: portrait)").matches;
  const narrowViewport = window.innerWidth < PORTRAIT_MAX_VIEWPORT_W;
  return portraitOrientation && narrowViewport ? "portrait" : "landscape";
}

function measureStageHeight(stage: HTMLElement, baseH: number): number {
  return Math.max(Math.ceil(stage.scrollHeight), Math.ceil(stage.getBoundingClientRect().height), baseH);
}

/** Portrait: fit width and height. Landscape: fixed design width, scale to fit available height (centered). */
export function PlayCanvas({ children }: PlayCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<"landscape" | "portrait">(() => detectMode());

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const stage = stageRef.current;
    if (!wrapper || !stage) return;

    const apply = () => {
      const currentMode = detectMode();
      setMode((prev) => (prev === currentMode ? prev : currentMode));

      const rect = wrapper.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      let designW = currentMode === "portrait" ? PORTRAIT_W : LANDSCAPE_W;
      const baseH = currentMode === "portrait" ? PORTRAIT_H : LANDSCAPE_H;

      if (currentMode === "portrait") {
        const containerAspect = rect.width / rect.height;
        const baseAspect = designW / baseH;
        if (containerAspect > baseAspect) {
          designW = Math.ceil(baseH * containerAspect);
        }
      }

      stage.style.setProperty("--canvas-w", String(designW));
      stage.style.height = "auto";
      void stage.offsetHeight;

      const measuredH = measureStageHeight(stage, baseH);
      stage.style.setProperty("--canvas-h", String(measuredH));

      let scale: number;
      if (currentMode === "landscape") {
        const heightForScale = measuredH + LANDSCAPE_OVERHANG_Y;
        scale = rect.height / heightForScale;
        const scaledW = designW * scale;
        if (scaledW > rect.width) {
          scale = rect.width / designW;
        }
      } else {
        scale = Math.min(rect.width / designW, rect.height / measuredH);
      }

      if (!Number.isFinite(scale) || scale <= 0) scale = 0.01;
      stage.style.setProperty("--canvas-scale", String(scale));
      document.documentElement.style.setProperty("--estates-canvas-scale", String(scale));
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(wrapper);
    window.addEventListener("orientationchange", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", apply);
      document.documentElement.style.removeProperty("--estates-canvas-scale");
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const onChange = () => setMode(detectMode());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div ref={wrapperRef} className="estates-canvas-root">
      <div ref={stageRef} className="estates-canvas-stage" data-canvas-mode={mode}>
        {children}
      </div>
    </div>
  );
}
