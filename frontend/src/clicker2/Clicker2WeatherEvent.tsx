import "./Clicker2WeatherEvent.css";

import {
  weatherEventAriaLabel,
  weatherEventEmoji,
  weatherVariantDef,
  weatherVisibleFadeTier,
  type WeatherVariantId,
} from "./weatherEvents";

export default function Clicker2WeatherEvent({
  variantId,
  leftPct,
  topPct,
  motionPaused = false,
  onActivate,
}: {
  variantId: WeatherVariantId;
  leftPct: number;
  topPct: number;
  motionPaused?: boolean;
  onActivate: () => void;
}) {
  const def = weatherVariantDef(variantId);
  const fadeTier = weatherVisibleFadeTier(def.visibleMs);
  const tierClass =
    fadeTier === "20"
      ? "clicker2WeatherEvent--visible20"
      : fadeTier === "17"
        ? "clicker2WeatherEvent--visible17"
        : "";

  return (
    <button
      type="button"
      className={
        motionPaused
          ? `clicker2WeatherEvent clicker2WeatherEvent--paused ${tierClass}`.trim()
          : `clicker2WeatherEvent ${tierClass}`.trim()
      }
      aria-label={weatherEventAriaLabel(variantId)}
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        top: `${topPct}%`,
        zIndex: 100,
        fontSize: "clamp(3.5rem, 18vw, 7rem)",
        lineHeight: 1,
        cursor: "pointer",
        border: "none",
        background: "transparent",
        padding: 0,
        filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.35))",
        ["--weather-life-ms" as string]: `${def.visibleMs}ms`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onActivate();
      }}
    >
      {weatherEventEmoji(variantId)}
    </button>
  );
}
