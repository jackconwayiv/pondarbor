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

import {
  ecologyTooltipRootBaseProps,
  ecologyTooltipSurfaceProps,
} from "./ecologyUi.constants.ts";
import { EcologyBlurbText } from "./ecologyUi.tsx";
import {
  CATALOG_UPGRADES,
  getOwnedCount,
  getUpgradeDef,
  type UpgradeDef,
} from "./catalog";
import PondRimDecal from "./PondRimDecal";
import {
  POND_MILESTONE_EMOJI_UPGRADES,
  stageEmojiForUpgrade,
} from "./upgradeEmojis";
import { scatterNonOverlapping, type Anchor } from "./pondStageLayout";
import {
  pondFireflyLayerVisible,
  pondMidgeLayerVisible,
  pondRimLayersOwned,
  pondWaterFleaLayerVisible,
} from "./pondStageRim";

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

/** FNV-1a 32-bit — stable layout/motion from upgrade id (order of unlock must not reflow the pond). */
function hash32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Percent anchors inside the clipped pond; spread from catalog order + hash so neighbors rarely overlap. */
function denizenStageAnchor(upgradeId: string): { left: number; top: number } {
  const h = hash32(upgradeId);
  const left = 18 + (h % 64);
  const top = 28 + ((h >>> 9) % 50);
  return { left, top };
}

function denizenFloatTiming(upgradeId: string): { dur: string; delay: string } {
  const h = hash32(upgradeId);
  const durSec = 4.55 + (h % 37) / 10;
  const delaySec = ((h >>> 18) % 50) / 10;
  return { dur: `${durSec.toFixed(2)}s`, delay: `${delaySec.toFixed(2)}s` };
}

const TURTLE_DENIZEN_IDS = new Set([
  "painted_turtles",
  "softshell_turtle",
  "snapping_turtle",
]);

type DenizenMotion = "fish" | "turtle" | "herp" | "float" | "still";

function denizenMotionFor(def: UpgradeDef): DenizenMotion {
  if (def.id === "tadpoles") return "still";
  if (def.family === "Fish") return "fish";
  if (TURTLE_DENIZEN_IDS.has(def.id)) return "turtle";
  if (def.family === "Herptiles") return "herp";
  return "float";
}

/** Top-right quadrant of the bowl (visually sparse); jitter stays off the far corner (sunken 🪵). */
/** Same gentle vertical bob as floating denizens (`pondDenizen` / `pondFloatDenizen`). */
const BOBBING_MILESTONE_UPGRADE_IDS = new Set([
  "pond_algae",
  "calm_eddies",
  "decomposer_fungi",
]);

function milestoneEmojisFromOwned(
  ownedUpgrades: Record<string, number>,
): ReadonlyArray<{ upgradeId: string; emoji: string; left: number; top: number }> {
  const ownedMilestones: Array<{ upgradeId: string; emoji: string }> = [];
  const out: {
    upgradeId: string;
    emoji: string;
    left: number;
    top: number;
  }[] = [];

  for (const { upgradeId, emoji } of POND_MILESTONE_EMOJI_UPGRADES) {
    if (getOwnedCount(ownedUpgrades, upgradeId) < 1) continue;
    ownedMilestones.push({ upgradeId, emoji });
  }

  // Fixed emoji anchors that milestones should never touch.
  const fixed: Array<{ id: string; anchor: Anchor }> = [];
  if (getOwnedCount(ownedUpgrades, "sunken_log") >= 1) {
    fixed.push({ id: "static_sunken_log", anchor: { left: 86, top: 12 } });
  }
  if (getOwnedCount(ownedUpgrades, "fallen_branch") >= 1) {
    const a = denizenStageAnchor("fallen_branch");
    fixed.push({
      id: "static_fallen_branch",
      anchor: { left: Math.min(a.left, 22), top: Math.max(a.top, 62) },
    });
  }
  if (getOwnedCount(ownedUpgrades, "tangled_roots") >= 1) {
    fixed.push({ id: "static_tangled_roots", anchor: { left: 12, top: 14 } });
  }
  if (getOwnedCount(ownedUpgrades, "reed_fringe") >= 1) {
    const a = denizenStageAnchor("reed_fringe");
    fixed.push({
      id: "static_reed_fringe",
      anchor: { left: Math.max(a.left, 76), top: Math.min(Math.max(a.top, 36), 58) },
    });
  }
  if (getOwnedCount(ownedUpgrades, "cattail_stand") >= 1) {
    const h = hash32("cattail_stand");
    fixed.push({
      id: "static_cattail_stand",
      anchor: { left: 44 + (h % 13), top: 9 + ((h >>> 8) % 7) },
    });
  }

  const milestoneIds = ownedMilestones.map((m) => m.upgradeId);
  const preferred: Record<string, Anchor> = {};
  for (const m of ownedMilestones) {
    // Keep historical haphazardness: seed from the same id shape as before.
    preferred[m.upgradeId] = denizenStageAnchor(`milestone_${m.upgradeId}`);
  }

  const anchors = scatterNonOverlapping(
    milestoneIds,
    { leftMin: 10, leftMax: 94, topMin: 8, topMax: 90 },
    { minDistance: 6.2, maxAttempts: 60 },
    fixed,
    preferred,
  );

  for (const m of ownedMilestones) {
    const a = anchors[m.upgradeId];
    out.push({ upgradeId: m.upgradeId, emoji: m.emoji, left: a.left, top: a.top });
  }
  return out;
}

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

type PondDenizen = {
  id: string;
  emoji: string;
  left: number;
  top: number;
  motion: DenizenMotion;
  dur?: string;
  delay?: string;
};

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

/** Stable % anchor for `fallen_branch` wood emoji — hash-based, biased toward littoral edge. */
const FALLEN_BRANCH_WOOD_ANCHOR = (() => {
  const a = denizenStageAnchor("fallen_branch");
  return { left: Math.min(a.left, 22), top: Math.max(a.top, 62) };
})();

/** `reed_fringe` sheaf — hash-based, biased toward the right littoral. */
function reedFringeSheafAnchor(): { left: number; top: number } {
  const a = denizenStageAnchor("reed_fringe");
  return { left: Math.max(a.left, 76), top: Math.min(Math.max(a.top, 36), 58) };
}

const REED_FRINGE_SHEAF_ANCHOR = reedFringeSheafAnchor();

/** `cattail_stand` — sheaf of rice (🌾), stable anchor near top center of the bowl. */
const CATTAIL_STAND_SHEAF_ANCHOR = (() => {
  const h = hash32("cattail_stand");
  return {
    left: 44 + (h % 13),
    top: 9 + ((h >>> 8) % 7),
  };
})();

/** When reeds are owned, park tadpoles just left of the sheaf; otherwise default anchor. */
function tadpolesStageAnchor(
  ownedUpgrades: Record<string, number>,
): { left: number; top: number } {
  const base = denizenStageAnchor("tadpoles");
  if (getOwnedCount(ownedUpgrades, "reed_fringe") < 1) return base;
  const reed = reedFringeSheafAnchor();
  const h = hash32("tadpoles_near_reed");
  return {
    left: Math.max(32, reed.left - 9 - (h % 4)),
    top: Math.min(72, Math.max(34, reed.top + (h % 7) - 3)),
  };
}

/**
 * Upper-left of the *visible* water (inside clip path). Values ~8%/8% sit outside the bowl and vanish.
 * Stable hash; does not depend on other unlocks.
 */
function minnowsStageAnchor(): { left: number; top: number } {
  const h = hash32("minnows_stage_anchor");
  return {
    left: 20 + (h % 14),
    top: 24 + ((h >>> 9) % 16),
  };
}

/** Fixed % anchors for midge hatch swarm (upper bowl; does not shift with unlocks). */

const MIDGE_FLURRY_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [17, 16],
  [24, 22],
  [31, 14],
  [39, 20],
  [47, 15],
  [55, 23],
  [63, 17],
  [71, 21],
  [78, 18],
  [21, 28],
  [36, 30],
  [52, 27],
  [68, 29],
  [44, 33],
  [58, 31],
];

/** Mid-bowl glow dots when `fireflies` is owned; avoids midge upper cluster and flea lower cluster. */
const FIREFLY_DOT_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [14, 42],
  [22, 50],
  [31, 44],
  [40, 58],
  [48, 46],
  [57, 54],
  [66, 48],
  [74, 56],
  [82, 44],
  [18, 62],
  [35, 68],
  [52, 72],
  [69, 66],
  [78, 70],
  [26, 76],
  [44, 80],
  [61, 78],
];

/** Bottom-half bowl — midge-like micro-dots when `water_fleas` is owned (upper midge hatch unchanged). */
const WATER_FLEA_DOT_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [20, 54],
  [28, 62],
  [36, 58],
  [44, 72],
  [52, 66],
  [60, 78],
  [68, 62],
  [76, 70],
  [24, 82],
  [40, 88],
  [56, 84],
  [72, 86],
  [32, 74],
  [48, 78],
  [64, 90],
];

function denizensFromOwned(
  ownedUpgrades: Record<string, number>,
): PondDenizen[] {
  const candidates: Array<{
    def: UpgradeDef;
    emoji: string;
    motion: DenizenMotion;
    preferred: Anchor;
  }> = [];
  for (const def of CATALOG_UPGRADES) {
    if (def.nodeType !== "Denizen") continue;
    if (getOwnedCount(ownedUpgrades, def.id) < 1) continue;
    const emoji = stageEmojiForUpgrade(def);
    if (!emoji) continue;
    const motion = denizenMotionFor(def);
    const preferred =
      def.id === "tadpoles"
        ? tadpolesStageAnchor(ownedUpgrades)
        : def.id === "minnows"
          ? minnowsStageAnchor()
          : denizenStageAnchor(def.id);
    candidates.push({ def, emoji, motion, preferred });
  }

  // Fixed anchors for prominent static pond emojis; denizens should not touch these.
  const fixed: Array<{ id: string; anchor: Anchor }> = [];
  if (getOwnedCount(ownedUpgrades, "sunken_log") >= 1) {
    fixed.push({ id: "static_sunken_log", anchor: { left: 86, top: 12 } });
  }
  if (getOwnedCount(ownedUpgrades, "fallen_branch") >= 1) {
    const a = denizenStageAnchor("fallen_branch");
    fixed.push({
      id: "static_fallen_branch",
      anchor: { left: Math.min(a.left, 22), top: Math.max(a.top, 62) },
    });
  }
  if (getOwnedCount(ownedUpgrades, "tangled_roots") >= 1) {
    fixed.push({ id: "static_tangled_roots", anchor: { left: 12, top: 14 } });
  }
  if (getOwnedCount(ownedUpgrades, "reed_fringe") >= 1) {
    const a = denizenStageAnchor("reed_fringe");
    fixed.push({
      id: "static_reed_fringe",
      anchor: { left: Math.max(a.left, 76), top: Math.min(Math.max(a.top, 36), 58) },
    });
  }
  if (getOwnedCount(ownedUpgrades, "cattail_stand") >= 1) {
    const h = hash32("cattail_stand");
    fixed.push({
      id: "static_cattail_stand",
      anchor: { left: 44 + (h % 13), top: 9 + ((h >>> 8) % 7) },
    });
  }

  const denizenIds = candidates.map((c) => c.def.id);
  const preferredById: Record<string, Anchor> = {};
  for (const c of candidates) preferredById[c.def.id] = c.preferred;
  // Hand nudge: bluegill tends to drift toward the right clip edge; bias it left.
  if (preferredById.bluegill) {
    preferredById.bluegill = {
      left: preferredById.bluegill.left - 18,
      top: preferredById.bluegill.top - 4,
    };
  }

  const anchors = scatterNonOverlapping(
    denizenIds,
    { leftMin: 14, leftMax: 86, topMin: 16, topMax: 86 },
    { minDistance: 7.0, maxAttempts: 80 },
    fixed,
    preferredById,
  );

  const out: PondDenizen[] = [];
  for (const c of candidates) {
    const a = anchors[c.def.id];
    if (c.motion === "fish" || c.motion === "still") {
      out.push({ id: c.def.id, emoji: c.emoji, left: a.left, top: a.top, motion: c.motion });
    } else {
      const { dur, delay } = denizenFloatTiming(c.def.id);
      out.push({
        id: c.def.id,
        emoji: c.emoji,
        left: a.left,
        top: a.top,
        motion: c.motion,
        dur,
        delay,
      });
    }
  }

  return out;
}

/**
 * Main pond: layered water, click target, optional ripples, sunlight twinkles, gated denizens.
 */
const POND_CLIP_PATH_D =
  "M0.52,0.05 C0.78,0.03,0.95,0.2,0.96,0.42 C0.98,0.58,0.92,0.76,0.74,0.88 C0.58,0.97,0.32,0.98,0.16,0.86 C0.04,0.72,0.02,0.48,0.12,0.3 C0.2,0.14,0.36,0.06,0.52,0.05 Z";

function sunlightTwinkleCount(ownedUpgrades: Record<string, number>): number {
  const def = getUpgradeDef("filtered_sunlight");
  if (!def?.pondVisual || def.pondVisual.type !== "sunlight_twinkle") return 0;
  if (getOwnedCount(ownedUpgrades, "filtered_sunlight") < 1) return 0;
  return SUN_TWINKLE_POSITIONS.length;
}

function motionClassForDenizen(
  motion: DenizenMotion,
  prefersReducedMotion: boolean,
): string | undefined {
  if (prefersReducedMotion) return undefined;
  switch (motion) {
    case "fish":
      return "pondFish";
    case "turtle":
      return "pondTurtle";
    case "herp":
      return "pondHerp";
    case "still":
      return undefined;
    default:
      return "pondDenizen";
  }
}

export default function PondStage({
  hasBasin,
  ownedUpgrades,
  ecologyHoverNote,
  clickDisabled = false,
  onClickPond,
}: PondStageProps) {
  const [canHoverFinePointer] = useMediaQuery(
    ["(hover: hover) and (pointer: fine)"],
    {
      ssr: false,
      fallback: [false],
    },
  );
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
  const rimLayers = hasWater ? pondRimLayersOwned(ownedUpgrades) : [];
  const showMidgeLayer = hasWater && pondMidgeLayerVisible(ownedUpgrades);
  const showWaterFleaDots =
    hasWater && pondWaterFleaLayerVisible(ownedUpgrades);
  const showFireflyLayer =
    hasWater && pondFireflyLayerVisible(ownedUpgrades);
  const showSunkenLogWood =
    hasWater && getOwnedCount(ownedUpgrades, "sunken_log") >= 1;
  const showFallenBranchWood =
    hasWater && getOwnedCount(ownedUpgrades, "fallen_branch") >= 1;
  const showReedFringeSheaf =
    hasWater && getOwnedCount(ownedUpgrades, "reed_fringe") >= 1;
  const showCattailStandSheaf =
    hasWater && getOwnedCount(ownedUpgrades, "cattail_stand") >= 1;
  const showTangledRootsHerb =
    hasWater && getOwnedCount(ownedUpgrades, "tangled_roots") >= 1;
  const milestoneEmojis = hasWater
    ? milestoneEmojisFromOwned(ownedUpgrades)
    : [];

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
      aria-label={
        clickDisabled ? "Pond paused" : "Click the pond to gain energy"
      }
      onClick={handleClick}
      disabled={clickDisabled}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 8,
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
      <TooltipRoot
        {...ecologyTooltipRootBaseProps}
        openDelay={1000}
        positioning={{ placement: "top" }}
      >
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

  const pondStageMinH = { base: "36vh", md: "min(320px, 42vh)" } as const;

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
        minH={pondStageMinH}
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

        {rimLayers.map(({ upgradeId, layerClass }) => (
          <Box
            key={upgradeId}
            position="absolute"
            inset="0"
            zIndex={2}
            pointerEvents="none"
            className="pondRimDecalWrap"
            aria-hidden
          >
            <PondRimDecal upgradeId={upgradeId} layerClass={layerClass} />
          </Box>
        ))}

        {showFallenBranchWood ? (
          <Box
            position="absolute"
            left={`${FALLEN_BRANCH_WOOD_ANCHOR.left}%`}
            top={`${FALLEN_BRANCH_WOOD_ANCHOR.top}%`}
            zIndex={3}
            pointerEvents="none"
            userSelect="none"
            lineHeight={1}
            fontSize={{ base: "1.15rem", md: "1.35rem" }}
            transform="translate(-50%, -50%) rotate(-18deg)"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
            aria-hidden
          >
            🪵
          </Box>
        ) : null}

        {showTangledRootsHerb ? (
          <Box
            position="absolute"
            left="12%"
            top="14%"
            zIndex={3}
            pointerEvents="none"
            userSelect="none"
            lineHeight={1}
            fontSize={{ base: "1.2rem", md: "1.4rem" }}
            transform="translate(-50%, -50%) rotate(-8deg)"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
            aria-hidden
          >
            🌿
          </Box>
        ) : null}

        {showReedFringeSheaf ? (
          <Box
            position="absolute"
            left={`${REED_FRINGE_SHEAF_ANCHOR.left}%`}
            top={`${REED_FRINGE_SHEAF_ANCHOR.top}%`}
            zIndex={3}
            pointerEvents="none"
            userSelect="none"
            lineHeight={1}
            fontSize={{ base: "1.2rem", md: "1.4rem" }}
            transform="translate(-50%, -50%) rotate(8deg)"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.28)" }}
            aria-hidden
          >
            🌾
          </Box>
        ) : null}

        {showCattailStandSheaf ? (
          <Box
            position="absolute"
            left={`${CATTAIL_STAND_SHEAF_ANCHOR.left}%`}
            top={`${CATTAIL_STAND_SHEAF_ANCHOR.top}%`}
            zIndex={3}
            pointerEvents="none"
            userSelect="none"
            lineHeight={1}
            fontSize={{ base: "1.2rem", md: "1.4rem" }}
            transform="translate(-50%, -50%) rotate(-4deg)"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.28)" }}
            aria-hidden
          >
            🌾
          </Box>
        ) : null}

        {milestoneEmojis.map((m) => {
          const bob =
            BOBBING_MILESTONE_UPGRADE_IDS.has(m.upgradeId) &&
            !prefersReducedMotion;
          let floatVars: CSSProperties = {};
          if (bob) {
            const { dur, delay } = denizenFloatTiming(`bob_ms_${m.upgradeId}`);
            floatVars = {
              "--pond-denizen-dur": dur,
              "--pond-denizen-delay": delay,
            } as CSSProperties;
          }
          return (
            <Box
              key={`milestone-${m.upgradeId}`}
              className={bob ? "pondDenizen" : undefined}
              position="absolute"
              left={`${m.left}%`}
              top={`${m.top}%`}
              zIndex={3}
              pointerEvents="none"
              userSelect="none"
              lineHeight={1}
              fontSize={{ base: "1rem", md: "1.15rem" }}
              transform="translate(-50%, -50%)"
              style={{
                textShadow: "0 1px 2px rgba(0,0,0,0.26)",
                ...floatVars,
              }}
              aria-hidden
            >
              {m.emoji}
            </Box>
          );
        })}

        {twinkleCount > 0 && hasWater ? (
          <Box
            position="absolute"
            inset="0"
            zIndex={4}
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

        {showMidgeLayer ? (
          <Box
            className="pondMidgeLayer"
            position="absolute"
            inset="0"
            zIndex={5}
            pointerEvents="none"
            aria-hidden
          >
            {MIDGE_FLURRY_POSITIONS.map(([left, top], i) => (
              <Box
                key={`midge-${i}`}
                as="span"
                className="pondMidgeDot"
                position="absolute"
                left={`${left}%`}
                top={`${top}%`}
              />
            ))}
          </Box>
        ) : null}

        {showWaterFleaDots ? (
          <Box
            className="pondMidgeLayer"
            position="absolute"
            inset="0"
            zIndex={5}
            pointerEvents="none"
            aria-hidden
          >
            {WATER_FLEA_DOT_POSITIONS.map(([left, top], i) => (
              <Box
                key={`water-flea-${i}`}
                as="span"
                className="pondMidgeDot"
                position="absolute"
                left={`${left}%`}
                top={`${top}%`}
              />
            ))}
          </Box>
        ) : null}

        {showFireflyLayer ? (
          <Box
            className="pondFireflyLayer"
            position="absolute"
            inset="0"
            zIndex={5}
            pointerEvents="none"
            aria-hidden
          >
            {FIREFLY_DOT_POSITIONS.map(([left, top], i) => (
              <Box
                key={`firefly-${i}`}
                as="span"
                className="pondFireflyDot"
                position="absolute"
                left={`${left}%`}
                top={`${top}%`}
              />
            ))}
          </Box>
        ) : null}

        {showSunkenLogWood ? (
          <Box
            position="absolute"
            left="86%"
            top="12%"
            zIndex={3}
            pointerEvents="none"
            userSelect="none"
            lineHeight={1}
            fontSize={{ base: "1.15rem", md: "1.35rem" }}
            transform="translate(-50%, -50%) rotate(12deg)"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
            aria-hidden
          >
            🪵
          </Box>
        ) : null}

        {displayDenizens.map((d) => {
          const motionClass = motionClassForDenizen(d.motion, prefersReducedMotion);
          const floatVars =
            !prefersReducedMotion &&
            (d.motion === "float" || d.motion === "herp" || d.motion === "turtle") &&
            d.dur &&
            d.delay
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
              zIndex={6}
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
            zIndex={7}
            w="min(140%, 520px)"
            h="min(140%, 520px)"
            borderRadius="full"
            border={
              hasWater
                ? "2px solid rgba(255,255,255,0.45)"
                : "2px solid rgba(55,45,38,0.45)"
            }
            pointerEvents="none"
          />
        ))}

        {pondClickLayer}
      </Box>
    </Box>
  );
}
