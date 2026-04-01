import { Box } from "@chakra-ui/react";
import {
  type CSSProperties,
  type MouseEvent,
  useId,
  useState,
  useSyncExternalStore,
} from "react";

import { BRAND_COLORS } from "../theme/tokens";

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

export type PondStageProps = {
  energy: number;
  onClickPond: () => void;
};

type Ripple = { id: number; x: number; y: number };

const SKY = BRAND_COLORS.skyBlue;
const PAD = BRAND_COLORS.lilypad;
const DEEP = "#3d7aa3";

type FloatingDenizen = {
  emoji: string;
  left: number;
  top: number;
  kind: "float";
  dur: string;
  delay: string;
};

type FishDenizen = { emoji: string; left: number; top: number; kind: "fish" };

/** Decorative pond creatures; positions in % of pond box (stable, non-random). */
const POND_DENIZENS: readonly (FloatingDenizen | FishDenizen)[] = [
  { emoji: "🐸", left: 24, top: 64, kind: "float", dur: "5.2s", delay: "0s" },
  { emoji: "🐢", left: 72, top: 56, kind: "float", dur: "6s", delay: "0.9s" },
  { emoji: "🐟", left: 46, top: 36, kind: "fish" },
];

/**
 * Main pond: layered water, lily accents, click target, optional ripples.
 * (Avoid Chakra `css` + emotion keyframes on `Box` — Chakra walks style trees and calls `.startsWith` on values.)
 */
/** Smooth organic pond outline (objectBoundingBox coords) — slightly irregular, rounded. */
const POND_CLIP_PATH_D =
  "M0.52,0.05 C0.78,0.03,0.95,0.2,0.96,0.42 C0.98,0.58,0.92,0.76,0.74,0.88 C0.58,0.97,0.32,0.98,0.16,0.86 C0.04,0.72,0.02,0.48,0.12,0.3 C0.2,0.14,0.36,0.06,0.52,0.05 Z";

export default function PondStage({ energy, onClickPond }: PondStageProps) {
  const clipIdRaw = useId();
  const clipId = `pond-clip-${clipIdRaw.replace(/:/g, "")}`;

  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getReducedMotionServer,
  );
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const liveliness = Math.min(energy / 400, 1);
  const padOpacity = 0.28 + liveliness * 0.45;
  const padCount = 2 + Math.floor(liveliness * 4);

  const handleClick = (e: MouseEvent<HTMLElement>) => {
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

  return (
    <Box position="relative" w="full" maxW="full">
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
          filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.18))",
          background: `
          radial-gradient(ellipse 120% 80% at 50% 0%, ${SKY}cc 0%, transparent 55%),
          radial-gradient(ellipse 90% 70% at 70% 100%, ${DEEP} 0%, ${SKY}99 45%, ${DEEP} 100%),
          linear-gradient(180deg, ${SKY} 0%, ${DEEP} 100%)
        `,
        }}
      >
      {Array.from({ length: padCount }, (_, i) => {
        const left = 12 + ((i * 17) % 76);
        const top = 18 + ((i * 23) % 58);
        return (
          <Box
            key={`pad-${i}`}
            className={prefersReducedMotion ? undefined : "pondPad"}
            position="absolute"
            left={`${left}%`}
            top={`${top}%`}
            w={{ base: "48px", md: "56px" }}
            h={{ base: "36px", md: "42px" }}
            borderRadius="full"
            bg={PAD}
            boxShadow="inset 0 -4px 0 rgba(0,0,0,0.08)"
            pointerEvents="none"
            transform="translate(-50%, -50%)"
            style={
              prefersReducedMotion
                ? { opacity: padOpacity }
                : ({
                    opacity: padOpacity,
                    "--pond-pad-dur": `${4 + i * 0.4}s`,
                    "--pond-pad-delay": `${i * 0.35}s`,
                  } as CSSProperties)
            }
          />
        );
      })}

      <Box
        position="absolute"
        inset="0"
        pointerEvents="none"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.18), transparent)",
        }}
      />

      {POND_DENIZENS.map((d) => {
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
            key={d.emoji}
            className={motionClass}
            position="absolute"
            left={`${d.left}%`}
            top={`${d.top}%`}
            zIndex={2}
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
          zIndex="3"
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
          zIndex: 4,
          margin: 0,
          padding: 0,
          border: "none",
          borderRadius: 0,
          cursor: "pointer",
          background: "transparent",
        }}
      />
      </Box>
    </Box>
  );
}
