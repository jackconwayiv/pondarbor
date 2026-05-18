import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import "./playCanvas.css";

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

/** Portrait: virtual design canvas + transform scale. Landscape: responsive flex fill (CSS only). */
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

      if (currentMode === "landscape") {
        stage.style.removeProperty("--canvas-w");
        stage.style.removeProperty("--canvas-h");
        stage.style.removeProperty("--canvas-scale");
        document.documentElement.style.removeProperty("--estates-canvas-scale");
        return;
      }

      let designW = PORTRAIT_W;
      const baseH = PORTRAIT_H;
      const rect = wrapper.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const containerAspect = rect.width / rect.height;
      const baseAspect = designW / baseH;
      if (containerAspect > baseAspect) {
        designW = Math.ceil(baseH * containerAspect);
      }

      stage.style.setProperty("--canvas-w", String(designW));
      stage.style.height = "auto";
      void stage.offsetHeight;

      const measuredH = Math.ceil(stage.getBoundingClientRect().height) || baseH;
      stage.style.setProperty("--canvas-h", String(measuredH));

      const scale = Math.min(rect.width / designW, rect.height / measuredH);
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
