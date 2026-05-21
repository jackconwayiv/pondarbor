import { Box, Button, HStack } from "@chakra-ui/react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FaMagnifyingGlassMinus, FaMagnifyingGlassPlus } from "react-icons/fa6";

import type { PeopleTreeLayout as AnchorLayout } from "./usePeopleTreeAnchors";
import { usePeopleTreeAnchors } from "./usePeopleTreeAnchors";
import {
  contentBottomFromAnchors,
  contentTopFromAnchors,
  PEOPLE_TREE_PAN_BOTTOM_EXTRA,
  usePeopleTreePan,
} from "./usePeopleTreePan";

const BOTTOM_CANVAS_PAD_PX = 32;
const GENERATION_ROW_PX = 172;
const RANK_GUTTER_PX = 44;
const GENERATIONS_VISIBLE_TARGET = 3;
const TARGET_PAN_AREA_PX =
  GENERATIONS_VISIBLE_TARGET * GENERATION_ROW_PX +
  (GENERATIONS_VISIBLE_TARGET - 1) * RANK_GUTTER_PX +
  24;
const VIEWPORT_TARGET_PX = TARGET_PAN_AREA_PX;
const VIEWPORT_MAX_HEIGHT = { base: "min(82vh, 48rem)", md: "min(86vh, 52rem)" } as const;
const VIEWPORT_MIN_HEIGHT = `${VIEWPORT_TARGET_PX}px`;

const VIEW_DISPLAY_GENERATIONS = 2;
const VIEW_DISPLAY_TARGET_PX =
  VIEW_DISPLAY_GENERATIONS * GENERATION_ROW_PX +
  (VIEW_DISPLAY_GENERATIONS - 1) * RANK_GUTTER_PX +
  24;
const VIEW_DISPLAY_MAX_HEIGHT = { base: "min(48dvh, 22rem)", md: "min(86vh, 52rem)" } as const;
const VIEW_DISPLAY_MIN_HEIGHT = {
  base: "min(240px, 38dvh)",
  md: `${VIEW_DISPLAY_TARGET_PX}px`,
} as const;

const VIEW_PAN_MARGINS = {
  top: 12,
  side: 12,
  bottom: 40,
  bottomExtra: PEOPLE_TREE_PAN_BOTTOM_EXTRA,
} as const;

export type FamilyTreeCanvasAnchorApi = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  registerAnchor: (personId: string, el: HTMLElement | null) => void;
  layout: AnchorLayout | null;
  bumpMeasure: () => void;
};

export type FamilyTreeCanvasProps = {
  personCount: number;
  /** Person id to center viewport on (typically self). */
  centerOnPersonId?: string | null;
  enablePinchZoom?: boolean;
  /**
   * View mode: pan/zoom cannot scroll past the trimmed grid (no extra bottom band or
   * connector overflow beyond measured grid size).
   */
  clampPanToGrid?: boolean;
  /** When provided, use parent-owned anchor measurement (for connectors in sibling). */
  anchorApi?: FamilyTreeCanvasAnchorApi;
  children: ReactNode;
};

export default function FamilyTreeCanvas({
  personCount,
  centerOnPersonId = null,
  enablePinchZoom = true,
  clampPanToGrid = false,
  anchorApi: anchorApiProp,
  children,
}: FamilyTreeCanvasProps) {
  const internalAnchors = usePeopleTreeAnchors(personCount);
  const { containerRef, layout, bumpMeasure } = anchorApiProp ?? internalAnchors;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panAreaRef = useRef<HTMLDivElement | null>(null);
  const [panAreaSize, setPanAreaSize] = useState({ w: 0, h: 0 });

  const contentW = layout?.width ?? 0;

  const effectiveContentH = useMemo(() => {
    if (!layout) return 0;
    if (clampPanToGrid) return layout.height;
    const anchorBottom = contentBottomFromAnchors(layout.anchors);
    return Math.max(layout.height, anchorBottom + BOTTOM_CANVAS_PAD_PX);
  }, [layout, clampPanToGrid]);

  const viewportHeight = useMemo(() => {
    if (clampPanToGrid) {
      const floorPx = VIEW_DISPLAY_TARGET_PX;
      return {
        base: `min(${VIEW_DISPLAY_MAX_HEIGHT.base}, max(${VIEW_DISPLAY_MIN_HEIGHT.base}, ${floorPx}px))`,
        md: `min(${VIEW_DISPLAY_MAX_HEIGHT.md}, max(${VIEW_DISPLAY_MIN_HEIGHT.md}, ${floorPx}px))`,
      };
    }
    const floorPx = personCount > 0 ? VIEWPORT_TARGET_PX : TARGET_PAN_AREA_PX;
    const fromContent = layout?.height ? layout.height + 8 : 0;
    const needed = Math.max(floorPx, fromContent);
    return `max(${VIEWPORT_MIN_HEIGHT}, min(${VIEWPORT_MAX_HEIGHT}, ${Math.round(needed)}px))`;
  }, [clampPanToGrid, layout?.height, personCount]);

  const {
    pan,
    scale,
    dragging,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    centerOn,
  } = usePeopleTreePan({
    viewportW: panAreaSize.w,
    viewportH: panAreaSize.h,
    contentW,
    contentH: effectiveContentH,
    panAreaRef,
    enablePinchZoom,
    panMargins: clampPanToGrid ? VIEW_PAN_MARGINS : undefined,
    initialAlign: clampPanToGrid ? "top" : "center",
  });

  const didCenterRef = useRef(false);

  useLayoutEffect(() => {
    const panArea = panAreaRef.current;
    if (!panArea) return;
    const measurePanArea = () => {
      setPanAreaSize({ w: panArea.clientWidth, h: panArea.clientHeight });
    };
    measurePanArea();
    const ro = new ResizeObserver(measurePanArea);
    ro.observe(panArea);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    bumpMeasure();
  }, [personCount, bumpMeasure]);

  useEffect(() => {
    didCenterRef.current = false;
  }, [personCount, centerOnPersonId]);

  useEffect(() => {
    if (!layout || layout.width <= 0 || layout.height <= 0) return;
    if (panAreaSize.w <= 0 || panAreaSize.h <= 0) return;
    if (didCenterRef.current) return;
    const anchor = centerOnPersonId ? layout.anchors.get(centerOnPersonId) : null;
    const focusX = anchor?.center.x ?? layout.width / 2;
    const focusY = anchor?.center.y ?? layout.height / 2;
    const contentTopY = clampPanToGrid ? contentTopFromAnchors(layout.anchors) : 0;
    centerOn(
      panAreaSize.w,
      panAreaSize.h,
      contentW,
      effectiveContentH,
      focusX,
      focusY,
      contentTopY,
    );
    didCenterRef.current = true;
  }, [
    clampPanToGrid,
    layout,
    centerOnPersonId,
    centerOn,
    contentW,
    effectiveContentH,
    panAreaSize.h,
    panAreaSize.w,
  ]);

  return (
    <Box
      ref={viewportRef}
      w="100%"
      borderWidth="1px"
      borderColor="border"
      borderRadius="lg"
      overflow="hidden"
      bg="bg.subtle"
      display="flex"
      flexDirection="column"
      h={viewportHeight}
      minH={clampPanToGrid ? VIEW_DISPLAY_MIN_HEIGHT : VIEWPORT_MIN_HEIGHT}
    >
      <Box
        ref={panAreaRef}
        role="region"
        aria-label="Family tree canvas"
        position="relative"
        flex="1"
        minH={0}
        overflow="hidden"
        cursor={dragging ? "grabbing" : "grab"}
        touchAction="none"
        userSelect={dragging ? "none" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {personCount > 0 ? (
          <HStack
            data-people-tree-zoom=""
            position="absolute"
            top="2"
            right="2"
            zIndex={4}
            gap="1"
            pointerEvents="auto"
          >
            <Button
              type="button"
              size="sm"
              variant="outline"
              colorPalette="gray"
              aria-label="Zoom out"
              disabled={!canZoomOut}
              px="2"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                zoomOut();
              }}
            >
              <Box as="span" display="block" lineHeight="0" color="fg" aria-hidden>
                <FaMagnifyingGlassMinus size={16} />
              </Box>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              colorPalette="gray"
              aria-label="Zoom in"
              disabled={!canZoomIn}
              px="2"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                zoomIn();
              }}
            >
              <Box as="span" display="block" lineHeight="0" color="fg" aria-hidden>
                <FaMagnifyingGlassPlus size={16} />
              </Box>
            </Button>
          </HStack>
        ) : null}
        <Box
          ref={containerRef}
          position="absolute"
          left={0}
          top={0}
          w="max-content"
          pt={clampPanToGrid ? "1" : { base: 4, md: 5 }}
          pb={clampPanToGrid ? "5" : { base: 4, md: 5 }}
          px={clampPanToGrid ? "1" : "3"}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            willChange: dragging ? "transform" : undefined,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
