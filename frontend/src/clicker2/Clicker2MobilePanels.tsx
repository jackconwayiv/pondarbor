import { Box, Flex } from "@chakra-ui/react";
import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type TouchEvent,
} from "react";

import "./Clicker2MobilePanels.css";

import Clicker2WeatherEvent from "./Clicker2WeatherEvent";
import { useClicker2MotionPaused } from "./useClicker2MotionPaused";
import type { ActiveWeatherEvent } from "./weatherEvents";

const TAB_PANEL_IDS = ["pond", "shop", "depth"] as const;
export type Clicker2MobilePanelId = (typeof TAB_PANEL_IDS)[number];

/**
 * Infinite-loop strip: (Depths) | Pond | Shop | Depths | (Pond)
 * Clones at the ends enable one-step wrap animations without crossing the full width.
 */
const LOOP_SLOTS: readonly Clicker2MobilePanelId[] = [
  "depth",
  "pond",
  "shop",
  "depth",
  "pond",
];

const CANONICAL_INDEX: Record<Clicker2MobilePanelId, number> = {
  pond: 1,
  shop: 2,
  depth: 3,
};

const PANEL_LABELS: Record<Clicker2MobilePanelId, string> = {
  pond: "Pond",
  shop: "Shop",
  depth: "Depths",
};

const LOOP_SLOT_COUNT = LOOP_SLOTS.length;
const SWIPE_THRESHOLD_PX = 48;

const RING_NEXT: Record<Clicker2MobilePanelId, Clicker2MobilePanelId> = {
  depth: "pond",
  pond: "shop",
  shop: "depth",
};

const RING_PREV: Record<Clicker2MobilePanelId, Clicker2MobilePanelId> = {
  depth: "shop",
  pond: "depth",
  shop: "pond",
};

function panelIdAtLoopIndex(index: number): Clicker2MobilePanelId {
  return LOOP_SLOTS[index]!;
}

function normalizeLoopIndex(index: number): number {
  if (index === 0) return CANONICAL_INDEX.depth;
  if (index === 4) return CANONICAL_INDEX.pond;
  return index;
}

/** One ring step toward `target`, or canonical index when already there on a clone. */
function nextLoopIndexToward(
  currentIndex: number,
  target: Clicker2MobilePanelId,
): number {
  const currentPanel = panelIdAtLoopIndex(currentIndex);
  if (currentPanel === target) {
    return normalizeLoopIndex(currentIndex);
  }
  if (RING_NEXT[currentPanel] === target) return currentIndex + 1;
  if (RING_PREV[currentPanel] === target) return currentIndex - 1;
  return currentIndex;
}

export default function Clicker2MobilePanels({
  pondPanel,
  shopPanel,
  depthPanel,
  initialPanel = "pond",
  activeWeather = null,
  onWeatherEventActivate,
}: {
  pondPanel: ReactNode;
  shopPanel: ReactNode;
  depthPanel: ReactNode;
  initialPanel?: Clicker2MobilePanelId;
  activeWeather?: ActiveWeatherEvent | null;
  onWeatherEventActivate?: () => void;
}) {
  const motionPaused = useClicker2MotionPaused();
  const [loopIndex, setLoopIndex] = useState(
    () => CANONICAL_INDEX[initialPanel],
  );
  const [animate, setAnimate] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const activePanelId = panelIdAtLoopIndex(normalizeLoopIndex(loopIndex));

  const stepLoop = useCallback(
    (delta: -1 | 1) => {
      setLoopIndex((prev) => {
        const next = prev + delta;
        if (next < 0 || next >= LOOP_SLOT_COUNT) return prev;
        setAnimate(!motionPaused);
        return next;
      });
    },
    [motionPaused],
  );

  const goToPanel = useCallback(
    (id: Clicker2MobilePanelId) => {
      setLoopIndex((prev) => {
        const next = nextLoopIndexToward(prev, id);
        if (next === prev) return prev;
        setAnimate(Math.abs(next - prev) === 1 && !motionPaused);
        return next;
      });
    },
    [motionPaused],
  );

  const onTouchStart = useCallback((e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
      if (Math.abs(dx) <= Math.abs(dy)) return;
      if (dx < 0) stepLoop(1);
      else stepLoop(-1);
    },
    [stepLoop],
  );

  const onTrackTransitionEnd = useCallback(() => {
    setAnimate(false);
    setLoopIndex((prev) => {
      if (prev === 0) return CANONICAL_INDEX.depth;
      if (prev === 4) return CANONICAL_INDEX.pond;
      return prev;
    });
  }, []);

  const panels: Record<Clicker2MobilePanelId, ReactNode> = {
    pond: pondPanel,
    shop: shopPanel,
    depth: depthPanel,
  };

  return (
    <Box
      className="click2MobilePanels"
      style={
        {
          "--click2-mobile-panel-count": LOOP_SLOT_COUNT,
        } as CSSProperties
      }
    >
      <Flex
        className="click2MobilePanelsTabBar"
        gap="1.5"
        px="3"
        py="1"
        bg="transparent"
        role="tablist"
        aria-label="PondClicker panels"
      >
        {TAB_PANEL_IDS.map((id) => {
          const selected = id === activePanelId;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={
                selected
                  ? "click2MobilePanelsTab click2MobilePanelsTab--active"
                  : "click2MobilePanelsTab"
              }
              onClick={() => goToPanel(id)}
            >
              {PANEL_LABELS[id]}
            </button>
          );
        })}
      </Flex>

      <Box
        className="click2MobilePanelsViewport"
        role="tabpanel"
        aria-label={PANEL_LABELS[activePanelId]}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {activeWeather && onWeatherEventActivate ? (
          <Box className="click2MobilePanelsWeatherOverlay">
            <Clicker2WeatherEvent
              variantId={activeWeather.variantId}
              leftPct={activeWeather.leftPct}
              topPct={activeWeather.topPct}
              motionPaused={motionPaused}
              onActivate={onWeatherEventActivate}
            />
          </Box>
        ) : null}
        <Flex
          className={
            animate && !motionPaused
              ? "click2MobilePanelsTrack click2MobilePanelsTrack--animate"
              : "click2MobilePanelsTrack"
          }
          style={{
            transform: `translateX(-${(loopIndex * 100) / LOOP_SLOT_COUNT}%)`,
          }}
          onTransitionEnd={onTrackTransitionEnd}
        >
          {LOOP_SLOTS.map((id, index) => (
            <Box key={`${id}-${index}`} className="click2MobilePanelsPanel">
              {panels[id]}
            </Box>
          ))}
        </Flex>
      </Box>
    </Box>
  );
}
