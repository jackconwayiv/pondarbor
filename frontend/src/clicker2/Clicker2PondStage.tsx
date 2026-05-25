import { Box, Text } from "@chakra-ui/react";
import {
  type CSSProperties,
  type MouseEvent,
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { BRAND_COLORS } from "../theme/tokens";
import { scatterNonOverlapping } from "../clicker/pondStageLayout";

import "../clicker/PondStage.css";
import "./Clicker2PondStage.css";

import {
  capClickFxList,
  MAX_POND_CLICK_POPS,
  MAX_POND_CLICK_POPS_LIGHT,
  MAX_POND_RIPPLES,
} from "./clicker2PondClickFx";
import { formatEnergyAmount, formatEnergyAmountCompact } from "./formatEnergy";
import {
  blossomRingPlacements,
  type BlossomRingPlacement,
} from "./blossoms";

function hash32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const POND_CLIP_PATH_D =
  "M0.52,0.05 C0.78,0.03,0.95,0.2,0.96,0.42 C0.98,0.58,0.92,0.76,0.74,0.88 C0.58,0.97,0.32,0.98,0.16,0.86 C0.04,0.72,0.02,0.48,0.12,0.3 C0.2,0.14,0.36,0.06,0.52,0.05 Z";

const SKY = BRAND_COLORS.skyBlue;
const DEEP = "#3d7aa3";

const WATER_STAGE_BACKGROUND = `
  radial-gradient(ellipse 120% 80% at 50% 0%, ${SKY}cc 0%, transparent 55%),
  radial-gradient(ellipse 90% 70% at 70% 100%, ${DEEP} 0%, ${SKY}99 45%, ${DEEP} 100%),
  linear-gradient(180deg, ${SKY} 0%, ${DEEP} 100%)
`;

type Ripple = { id: number; x: number; y: number };

type ClickPop = {
  id: number;
  x: number;
  y: number;
  amount: number;
  /** Abbreviated label during rainstorm click bursts (e.g. `12 mil`). */
  compact?: boolean;
};

export type PondDenizenVisual = {
  id: string;
  emoji: string;
};

const POND_CORE_WIDTH_PCT = 76;
/** Push pond below vertical center so blossom halo has room above/below. */
const POND_CORE_TOP_OFFSET_PCT = 6;

function blossomGlyphScale(ringIndex: number): number {
  return ringIndex <= 0
    ? 0.82
    : ringIndex === 1
      ? 0.88
      : ringIndex === 2
        ? 0.94
        : 1;
}

function BlossomRingGlyph({ placement }: { placement: BlossomRingPlacement }) {
  const scale = blossomGlyphScale(placement.ringIndex);
  return (
    <Text
      as="span"
      className="pond2BlossomRingGlyph"
      position="absolute"
      left={`${placement.left}%`}
      top={`${placement.top}%`}
      transform={`translate(-50%, -50%) scale(${scale})`}
    >
      {placement.emoji}
    </Text>
  );
}

function Clicker2PondStage({
  denizens,
  blossomCount = 0,
  clickValue,
  motionPaused = false,
  lightClickFx = false,
  onClickPond,
}: {
  denizens: PondDenizenVisual[];
  /** Milestone-earned blossoms to draw (0–100); only earned blossoms render. */
  blossomCount?: number;
  clickValue: number;
  /** When true (hidden tab or prefers-reduced-motion), skip or pause decorative motion. */
  motionPaused?: boolean;
  /** Fewer FX nodes and no ripples during rainstorm-scale click rates. */
  lightClickFx?: boolean;
  onClickPond: () => void;
}) {
  const clipIdRaw = useId();
  const clipId = `pond2-clip-${clipIdRaw.replace(/:/g, "")}`;
  const showMotion = !motionPaused;
  const maxClickPops = lightClickFx ? MAX_POND_CLICK_POPS_LIGHT : MAX_POND_CLICK_POPS;
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [clickPops, setClickPops] = useState<ClickPop[]>([]);
  const pendingPopsRef = useRef<ClickPop[]>([]);
  const pendingRipplesRef = useRef<Ripple[]>([]);
  const clickFxRafRef = useRef(0);
  const lightPopClearTimeoutRef = useRef(0);
  const popClearTimeoutsRef = useRef(new Set<number>());

  const denizenIdsKey = useMemo(
    () => denizens.map((d) => d.id).join("\0"),
    [denizens],
  );
  const anchors = useMemo(() => {
    const denizenIds = denizens.map((d) => d.id);
    return scatterNonOverlapping(
      denizenIds,
      { leftMin: 14, leftMax: 86, topMin: 16, topMax: 86 },
      { minDistance: 7.0, maxAttempts: 80 },
      [],
      Object.fromEntries(
        denizenIds.map((id) => {
          const h = hash32(id);
          return [id, { left: 18 + (h % 64), top: 28 + ((h >>> 9) % 50) }];
        }),
      ),
    );
  }, [denizenIdsKey, denizens]);

  useEffect(() => {
    return () => {
      if (clickFxRafRef.current) {
        cancelAnimationFrame(clickFxRafRef.current);
      }
      window.clearTimeout(lightPopClearTimeoutRef.current);
      for (const id of popClearTimeoutsRef.current) {
        window.clearTimeout(id);
      }
      popClearTimeoutsRef.current.clear();
    };
  }, []);

  const scheduleClickFxFlush = () => {
    if (clickFxRafRef.current) return;
    clickFxRafRef.current = requestAnimationFrame(() => {
      clickFxRafRef.current = 0;
      const pops = pendingPopsRef.current;
      pendingPopsRef.current = [];
      const rippleBatch = pendingRipplesRef.current;
      pendingRipplesRef.current = [];

      if (pops.length > 0) {
        setClickPops((p) => capClickFxList([...p, ...pops], maxClickPops));
        if (lightClickFx) {
          window.clearTimeout(lightPopClearTimeoutRef.current);
          lightPopClearTimeoutRef.current = window.setTimeout(() => {
            lightPopClearTimeoutRef.current = 0;
            setClickPops([]);
          }, 450);
        } else {
          for (const pop of pops) {
            const timeoutId = window.setTimeout(() => {
              popClearTimeoutsRef.current.delete(timeoutId);
              setClickPops((p) => p.filter((item) => item.id !== pop.id));
            }, 500);
            popClearTimeoutsRef.current.add(timeoutId);
          }
        }
      }

      if (rippleBatch.length > 0 && showMotion && !lightClickFx) {
        setRipples((r) => capClickFxList([...r, ...rippleBatch], MAX_POND_RIPPLES));
        for (const ripple of rippleBatch) {
          window.setTimeout(() => {
            setRipples((r) => r.filter((item) => item.id !== ripple.id));
          }, 700);
        }
      }
    });
  };

  const handleClick = (e: MouseEvent<HTMLElement>) => {
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

    const id = performance.now() + Math.random();
    const jitterX = (Math.random() - 0.5) * 12;
    const jitterY = (Math.random() - 0.5) * 8;
    const pop: ClickPop = {
      id,
      x: x + jitterX,
      y: y + jitterY,
      amount: clickValue,
      compact: lightClickFx,
    };
    const ripple = { id, x, y };

    pendingPopsRef.current.push(pop);
    if (showMotion && !lightClickFx) {
      pendingRipplesRef.current.push(ripple);
    }
    scheduleClickFxFlush();

    onClickPond();
  };

  const pondStageMinH = { base: "38vh", md: "min(360px, 46vh)" } as const;

  const blossomPlacements = useMemo(
    () => blossomRingPlacements(blossomCount),
    [blossomCount],
  );

  return (
    <Box
      className="pond2StageRoot"
      position="relative"
      w="full"
      maxW="full"
      minH={pondStageMinH}
    >
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <path d={POND_CLIP_PATH_D} />
          </clipPath>
        </defs>
      </svg>
      <Box
        className="pond2PondCore"
        position="relative"
        w={`${POND_CORE_WIDTH_PCT}%`}
        maxW="full"
        minH={pondStageMinH}
        mx="auto"
        mt={`${POND_CORE_TOP_OFFSET_PCT}%`}
        zIndex={1}
        overflow="hidden"
        style={{
          clipPath: `url(#${clipId})`,
          WebkitClipPath: `url(#${clipId})`,
          background: WATER_STAGE_BACKGROUND,
          filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.22))",
        }}
      >
        <Box
          position="absolute"
          inset="0"
          zIndex={1}
          pointerEvents="none"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.18), transparent)",
          }}
        />

        <Text
          as="span"
          className={
            showMotion
              ? motionPaused
                ? "pond2TitleReflection pond2TitleReflection--paused"
                : "pond2TitleReflection"
              : "pond2TitleReflectionStatic"
          }
          aria-hidden
        >
          PondClicker
        </Text>

        {denizens.map((d) => {
          const a = anchors[d.id];
          if (!a) return null;
          const h = hash32(d.id);
          const durSec = 4.55 + (h % 37) / 10;
          const delaySec = ((h >>> 18) % 50) / 10;
          return (
            <Box
              key={d.id}
              className={
                showMotion
                  ? motionPaused
                    ? "pondDenizen pondDenizen--paused"
                    : "pondDenizen"
                  : undefined
              }
              position="absolute"
              left={`${a.left}%`}
              top={`${a.top}%`}
              zIndex={5}
              fontSize="clamp(1.25rem, 4.5vw, 2.25rem)"
              lineHeight={1}
              transform="translate(-50%, -50%)"
              style={
                showMotion
                  ? ({
                      ["--pond-denizen-dur" as string]: `${durSec.toFixed(2)}s`,
                      ["--pond-denizen-delay" as string]: `${delaySec.toFixed(2)}s`,
                    } as CSSProperties)
                  : undefined
              }
              aria-hidden
            >
              {d.emoji}
            </Box>
          );
        })}

        {clickPops.map((pop) => (
          <Text
            key={pop.id}
            className="pond2ClickGainPop"
            position="absolute"
            left={`${pop.x}px`}
            top={`${pop.y}px`}
            zIndex={9}
            aria-hidden
          >
            {pop.compact
              ? `+${formatEnergyAmountCompact(Math.max(0, pop.amount))} ⚡`
              : `+${formatEnergyAmount(Math.max(0, pop.amount))} ⚡`}
          </Text>
        ))}

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
            border="2px solid rgba(255,255,255,0.45)"
            pointerEvents="none"
          />
        ))}

        <button
          type="button"
          aria-label="Click the pond to gain energy"
          onClick={handleClick}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 8,
            margin: 0,
            padding: 0,
            border: "none",
            borderRadius: 0,
            cursor: "pointer",
            background: "transparent",
          }}
        />
      </Box>
      {blossomPlacements.length > 0 ? (
        <Box
          className="pond2BlossomHalo"
          position="absolute"
          inset="0"
          zIndex={3}
          pointerEvents="none"
          aria-hidden
        >
          {blossomPlacements.map((placement, i) => (
            <BlossomRingGlyph key={`blossom-${i}`} placement={placement} />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

export default memo(Clicker2PondStage);
