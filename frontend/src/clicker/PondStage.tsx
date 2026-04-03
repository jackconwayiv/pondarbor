import {
  Box,
  TooltipContent,
  TooltipPositioner,
  TooltipRoot,
  TooltipTrigger,
  useMediaQuery,
} from "@chakra-ui/react";
import {
  type CSSProperties,
  type MouseEvent,
  useId,
  useState,
  useSyncExternalStore,
} from "react";

import { BRAND_COLORS } from "../theme/tokens";

import { CATALOG_UPGRADES, effectiveOwnedStacks, getOwnedCount, getUpgradeDef } from "./catalog";
import { EcologyBlurbText, ecologyTooltipSurfaceProps } from "./ecologyUi";

import "./PondStage.css";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION).matches;
}

function getReducedMotionServer(): boolean {
  return false;
}

/** Stable pond emoji by upgrade id (Tier 1 + a few plants). */
const STAGE_EMOJI_BY_UPGRADE_ID: Record<string, string> = {
  pond_snails: "🐌",
  tadpoles: "🐸",
  water_fleas: "🦐",
  pond_algae: "🌿",
  pondweed: "🌿",
  pond_detritus: "🍂",
};

export type PondStageProps = {
  hasBasin: boolean;
  ownedUpgrades: Record<string, number>;
  /** Shown on hover (desktop / fine pointer only); real-world ecology, not mechanics. */
  ecologyHoverNote?: string;
  clickDisabled?: boolean;
  onClickPond: () => void;
};

type Ripple = { id: number; x: number; y: number };

const SKY = BRAND_COLORS.skyBlue;
const DEEP = "#3d7aa3";

/** Filled-basin look once Still Water is owned. */
const WATER_STAGE_BACKGROUND = `
  radial-gradient(ellipse 120% 80% at 50% 0%, ${SKY}cc 0%, transparent 55%),
  radial-gradient(ellipse 90% 70% at 70% 100%, ${DEEP} 0%, ${SKY}99 45%, ${DEEP} 100%),
  linear-gradient(180deg, ${SKY} 0%, ${DEEP} 100%)
`;

/** Dry dug basin: brown soil before water. */
const DRY_BASIN_BACKGROUND = `
  radial-gradient(ellipse 95% 70% at 50% 92%, #1e1814 0%, #3d2f26 42%, #5a4638 78%, #6e5645 100%),
  radial-gradient(ellipse 55% 40% at 50% 28%, #8a7260 0%, transparent 72%),
  linear-gradient(185deg, #7a6554 0%, #4d3d32 38%, #352a22 72%, #2a221c 100%)
`;

type FloatingDenizen = {
  id: string;
  emoji: string;
  left: number;
  top: number;
  kind: "float";
  dur: string;
  delay: string;
};

type FishDenizen = { id: string; emoji: string; left: number; top: number; kind: "fish" };

/**
 * One entry per sunlight stack (max 5). Percent of pond box (clipped pond shape).
 * Hand-placed irregular scatter (not a grid). Index 0 stays in the upper sunlit bowl so a single
 * stack still reads; avoid extreme top-left where the clip often hides sparkles.
 */
const SUN_TWINKLE_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [49, 19],
  [31, 41],
  [73, 33],
  [22, 71],
  [81, 66],
];

function denizensFromOwned(ownedUpgrades: Record<string, number>): (FloatingDenizen | FishDenizen)[] {
  const out: (FloatingDenizen | FishDenizen)[] = [];
  let i = 0;
  for (const def of CATALOG_UPGRADES) {
    if (getOwnedCount(ownedUpgrades, def.id) < 1) continue;
    const emoji = STAGE_EMOJI_BY_UPGRADE_ID[def.id];
    if (!emoji) continue;
    const left = 18 + ((i * 19) % 68);
    const top = 28 + ((i * 17) % 52);
    if (def.family === "fish") {
      out.push({ id: def.id, emoji, left, top, kind: "fish" });
    } else {
      const dur = `${4.8 + (i % 4) * 0.35}s`;
      const delay = `${(i % 5) * 0.4}s`;
      out.push({ id: def.id, emoji, left, top, kind: "float", dur, delay });
    }
    i += 1;
  }
  return out;
}

/**
 * Main pond: layered water, click target, optional ripples, sunlight twinkles, gated denizens.
 */
const POND_CLIP_PATH_D =
  "M0.52,0.05 C0.78,0.03,0.95,0.2,0.96,0.42 C0.98,0.58,0.92,0.76,0.74,0.88 C0.58,0.97,0.32,0.98,0.16,0.86 C0.04,0.72,0.02,0.48,0.12,0.3 C0.2,0.14,0.36,0.06,0.52,0.05 Z";

function sunlightTwinkleCount(ownedUpgrades: Record<string, number>): number {
  const def = getUpgradeDef("sunlight");
  if (!def?.pondVisual || def.pondVisual.type !== "sunlight_twinkle") return 0;
  return effectiveOwnedStacks(def, ownedUpgrades);
}

export default function PondStage({
  hasBasin,
  ownedUpgrades,
  ecologyHoverNote,
  clickDisabled = false,
  onClickPond,
}: PondStageProps) {
  const [canHoverFinePointer] = useMediaQuery(["(hover: hover) and (pointer: fine)"], {
    ssr: false,
    fallback: [false],
  });
  const clipIdRaw = useId();
  const clipId = `pond-clip-${clipIdRaw.replace(/:/g, "")}`;

  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getReducedMotionServer,
  );
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const hasWater = getOwnedCount(ownedUpgrades, "still_water") >= 1;
  const displayDenizens = hasWater ? denizensFromOwned(ownedUpgrades) : [];
  const twinkleCount = hasWater ? sunlightTwinkleCount(ownedUpgrades) : 0;

  const handleClick = (e: MouseEvent<HTMLElement>) => {
    if (clickDisabled) return;
    onClickPond();
    if (prefersReducedMotion) return;
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    let x: number;
    let y: number;
    if (e.nativeEvent instanceof MouseEvent) {
      x = e.nativeEvent.offsetX;
      y = e.nativeEvent.offsetY;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    if ((x === 0 && y === 0) || (Number.isNaN(x) && Number.isNaN(y))) {
      x = rect.width / 2;
      y = rect.height / 2;
    }
    const id = performance.now();
    setRipples((r) => [...r, { id, x, y }]);
    window.setTimeout(() => {
      setRipples((r) => r.filter((rip) => rip.id !== id));
    }, 700);
  };

  if (!hasBasin) {
    return (
      <Box
        position="relative"
        w="full"
        maxW="full"
        minH={{ base: "36vh", md: "min(320px, 42vh)" }}
        aria-hidden
      />
    );
  }

  const pondClickButton = (
    <button
      type="button"
      aria-label={clickDisabled ? "Pond paused" : "Click the pond to gain energy"}
      onClick={handleClick}
      disabled={clickDisabled}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        margin: 0,
        padding: 0,
        border: "none",
        borderRadius: 0,
        cursor: clickDisabled ? "not-allowed" : "pointer",
        background: "transparent",
        opacity: clickDisabled ? 0.55 : 1,
      }}
    />
  );

  const pondClickLayer =
    ecologyHoverNote && canHoverFinePointer ? (
      <TooltipRoot openDelay={1000} closeDelay={150} interactive positioning={{ placement: "top" }}>
        <TooltipTrigger asChild>{pondClickButton}</TooltipTrigger>
        <TooltipPositioner>
          <TooltipContent {...ecologyTooltipSurfaceProps}>
            <EcologyBlurbText>{ecologyHoverNote}</EcologyBlurbText>
          </TooltipContent>
        </TooltipPositioner>
      </TooltipRoot>
    ) : (
      pondClickButton
    );

  return (
    <Box
      position="relative"
      w="full"
      maxW="full"
      /* Drop-shadow on a *wrapper* — Chrome often drops abs. children when filter + clip-path share one node. */
      style={{ filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.22))" }}
    >
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <path d={POND_CLIP_PATH_D} />
          </clipPath>
        </defs>
      </svg>
      <Box
        position="relative"
        w="full"
        minH={{ base: "36vh", md: "min(320px, 42vh)" }}
        overflow="hidden"
        style={{
          clipPath: `url(#${clipId})`,
          WebkitClipPath: `url(#${clipId})`,
          background: hasWater ? WATER_STAGE_BACKGROUND : DRY_BASIN_BACKGROUND,
        }}
      >
        <Box
          position="absolute"
          inset="0"
          zIndex={1}
          pointerEvents="none"
          style={{
            background: hasWater
              ? "linear-gradient(to top, rgba(0,0,0,0.18), transparent)"
              : "linear-gradient(to top, rgba(0,0,0,0.35), transparent 55%)",
          }}
        />

        {twinkleCount > 0 && hasWater ? (
          <Box
            position="absolute"
            inset="0"
            zIndex={2}
            pointerEvents="none"
            style={{ transform: "translateZ(0)", isolation: "isolate" }}
          >
            {Array.from({ length: twinkleCount }, (_, i) => {
              const pos = SUN_TWINKLE_POSITIONS[i];
              if (!pos) return null;
              const [left, top] = pos;
              const delay = `${i * 0.22}s`;
              const dur = `${2.4 + (i % 3) * 0.35}s`;
              const anchor = {
                position: "absolute" as const,
                left: `${left}%`,
                top: `${top}%`,
              };
              if (prefersReducedMotion) {
                return (
                  <Box
                    key={`tw-${i}`}
                    as="span"
                    className="pondSunTwinkleStatic"
                    style={{ ...anchor, transform: "translate(-50%, -50%)" }}
                  />
                );
              }
              return (
                <Box
                  key={`tw-${i}`}
                  as="span"
                  display="block"
                  className="pondSunTwinkle"
                  style={
                    {
                      ...anchor,
                      "--pond-twinkle-dur": dur,
                      "--pond-twinkle-delay": delay,
                    } as CSSProperties
                  }
                />
              );
            })}
          </Box>
        ) : null}

        {displayDenizens.map((d) => {
          const motionClass =
            prefersReducedMotion ? undefined : d.kind === "fish" ? "pondFish" : "pondDenizen";
          const floatVars =
            !prefersReducedMotion && d.kind === "float"
              ? ({
                  "--pond-denizen-dur": d.dur,
                  "--pond-denizen-delay": d.delay,
                } as CSSProperties)
              : {};
          return (
            <Box
              key={d.id}
              className={motionClass}
              position="absolute"
              left={`${d.left}%`}
              top={`${d.top}%`}
              zIndex={3}
              pointerEvents="none"
              userSelect="none"
              lineHeight={1}
              fontSize={{ base: "1.35rem", md: "1.6rem" }}
              transform="translate(-50%, -50%)"
              style={{
                textShadow: "0 1px 2px rgba(0,0,0,0.28)",
                ...floatVars,
              }}
              aria-hidden
            >
              {d.emoji}
            </Box>
          );
        })}

        {ripples.map((r) => (
          <Box
            key={r.id}
            className="pondRipple"
            position="absolute"
            left={`${r.x}px`}
            top={`${r.y}px`}
            zIndex={4}
            w="min(140%, 520px)"
            h="min(140%, 520px)"
            borderRadius="full"
            border={
              hasWater ? "2px solid rgba(255,255,255,0.45)" : "2px solid rgba(55,45,38,0.45)"
            }
            pointerEvents="none"
          />
        ))}

        {pondClickLayer}
      </Box>
    </Box>
  );
}
