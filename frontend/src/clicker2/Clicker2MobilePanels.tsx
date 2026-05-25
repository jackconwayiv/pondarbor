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

import { useClicker2MotionPaused } from "./useClicker2MotionPaused";

const PANEL_IDS = ["pond", "shop", "depth"] as const;
export type Clicker2MobilePanelId = (typeof PANEL_IDS)[number];

const PANEL_LABELS: Record<Clicker2MobilePanelId, string> = {
  pond: "Pond",
  shop: "Shop",
  depth: "Depth",
};

const SWIPE_THRESHOLD_PX = 48;
const PANEL_COUNT = PANEL_IDS.length;

function panelIndex(id: Clicker2MobilePanelId): number {
  return PANEL_IDS.indexOf(id);
}

export default function Clicker2MobilePanels({
  pondPanel,
  shopPanel,
  depthPanel,
  initialPanel = "pond",
}: {
  pondPanel: ReactNode;
  shopPanel: ReactNode;
  depthPanel: ReactNode;
  initialPanel?: Clicker2MobilePanelId;
}) {
  const motionPaused = useClicker2MotionPaused();
  const [activeIndex, setActiveIndex] = useState(() =>
    panelIndex(initialPanel),
  );
  const [animate, setAnimate] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const goToIndex = useCallback(
    (next: number) => {
      const clamped =
        ((next % PANEL_IDS.length) + PANEL_IDS.length) % PANEL_IDS.length;
      setActiveIndex((prev) => {
        if (prev === clamped) return prev;
        if (!motionPaused) setAnimate(true);
        return clamped;
      });
    },
    [motionPaused],
  );

  const goToPanel = useCallback(
    (id: Clicker2MobilePanelId) => {
      const next = panelIndex(id);
      setActiveIndex((prev) => {
        if (prev === next) return prev;
        if (!motionPaused) setAnimate(true);
        return next;
      });
    },
    [motionPaused],
  );

  const goNext = useCallback(() => {
    goToIndex(activeIndex + 1);
  }, [activeIndex, goToIndex]);

  const goPrev = useCallback(() => {
    goToIndex(activeIndex - 1);
  }, [activeIndex, goToIndex]);

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
      if (dx < 0) goNext();
      else goPrev();
    },
    [goNext, goPrev],
  );

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
          "--click2-mobile-panel-count": PANEL_COUNT,
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
        {PANEL_IDS.map((id) => {
          const selected = panelIndex(id) === activeIndex;
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
        aria-label={PANEL_LABELS[PANEL_IDS[activeIndex]!]}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <Flex
          className={
            animate && !motionPaused
              ? "click2MobilePanelsTrack click2MobilePanelsTrack--animate"
              : "click2MobilePanelsTrack"
          }
          style={{
            transform: `translateX(-${(activeIndex * 100) / PANEL_COUNT}%)`,
          }}
          onTransitionEnd={() => setAnimate(false)}
        >
          {PANEL_IDS.map((id) => (
            <Box key={id} className="click2MobilePanelsPanel">
              {panels[id]}
            </Box>
          ))}
        </Flex>
      </Box>
    </Box>
  );
}
