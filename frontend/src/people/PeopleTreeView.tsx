import { Box, Flex, Separator, Stack, Text } from "@chakra-ui/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { APP_TEXT_SIZES } from "../theme/typography";
import { PersonAnchorSlot } from "./PersonAnchorSlot";
import PersonCard from "./PersonCard";
import PeopleTreeConnectors from "./PeopleTreeConnectors";
import { computeTreeEdges } from "./peopleTreeEdges";
import type { PeopleGraphBundle, PeoplePerson } from "./types";
import { usePeopleTreeAnchors } from "./usePeopleTreeAnchors";
import {
  computePeopleTreePanBounds,
  contentTopFromAnchors,
  usePeopleTreePan,
} from "./usePeopleTreePan";

const RANK_GUTTER_MIN_H = { base: "2.25rem", md: "2.75rem" } as const;
const CARD_WIDTH = "11rem";
/** Legend strip + outer chrome above the pannable area. */
const LEGEND_BAND_PX = 36;
/** Collapsed card row + rank gutter — tuned so three generations fit without vertical scroll. */
const GENERATION_ROW_PX = 172;
const RANK_GUTTER_PX = 44;
const GENERATIONS_VISIBLE_TARGET = 3;
const TARGET_PAN_AREA_PX =
  GENERATIONS_VISIBLE_TARGET * GENERATION_ROW_PX +
  (GENERATIONS_VISIBLE_TARGET - 1) * RANK_GUTTER_PX +
  24;
const VIEWPORT_TARGET_PX = TARGET_PAN_AREA_PX + LEGEND_BAND_PX;
const VIEWPORT_MAX_HEIGHT = { base: "min(82vh, 48rem)", md: "min(86vh, 52rem)" } as const;
const VIEWPORT_MIN_HEIGHT = `${VIEWPORT_TARGET_PX}px`;

export function peopleTreeLegend(hasRelationshipEdges: boolean): string {
  return hasRelationshipEdges
    ? "Drag background to pan."
    : "Set parents or partners in Edit. Drag background to pan.";
}

export type PeopleTreeViewProps = {
  bundle: PeopleGraphBundle;
  rowsByRank: { rank: number; people: PeoplePerson[] }[];
  friendRow?: PeoplePerson[];
  expandedId: string | null;
  readOnly: boolean;
  onToggle: (personId: string) => void;
  onEdit: (person: PeoplePerson) => void;
};

function PersonRow({
  people,
  bundle,
  expandedId,
  readOnly,
  registerAnchor,
  onToggle,
  onEdit,
}: {
  people: PeoplePerson[];
  bundle: PeopleGraphBundle;
  expandedId: string | null;
  readOnly: boolean;
  registerAnchor: (personId: string, el: HTMLElement | null) => void;
  onToggle: (personId: string) => void;
  onEdit: (person: PeoplePerson) => void;
}) {
  return (
    <Flex gap="3" flexWrap="nowrap" align="flex-start" py="1">
      {people.map((p) => (
        <Box key={p.id} flexShrink={0} w={CARD_WIDTH} h="100%">
          <PersonAnchorSlot personId={p.id} registerAnchor={registerAnchor}>
            <PersonCard
              person={p}
              bundle={bundle}
              expanded={expandedId === p.id}
              readOnly={readOnly}
              onToggle={() => onToggle(p.id)}
              onEdit={() => onEdit(p)}
            />
          </PersonAnchorSlot>
        </Box>
      ))}
    </Flex>
  );
}

export default function PeopleTreeView({
  bundle,
  rowsByRank,
  friendRow = [],
  expandedId,
  readOnly,
  onToggle,
  onEdit,
}: PeopleTreeViewProps) {
  const personCount = bundle.people.length;
  const { containerRef, registerAnchor, layout, bumpMeasure } = usePeopleTreeAnchors(personCount);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panAreaRef = useRef<HTMLDivElement | null>(null);
  const [panAreaSize, setPanAreaSize] = useState({ w: 0, h: 0 });

  const panBounds = useMemo(() => {
    if (!layout || panAreaSize.w <= 0 || panAreaSize.h <= 0) return null;
    return computePeopleTreePanBounds(
      panAreaSize.w,
      panAreaSize.h,
      layout.width,
      layout.height,
    );
  }, [layout?.width, layout?.height, panAreaSize.h, panAreaSize.w]);

  const viewportHeight = useMemo(() => {
    const legendBand = personCount > 0 ? LEGEND_BAND_PX : 0;
    const floorPx = personCount > 0 ? VIEWPORT_TARGET_PX : TARGET_PAN_AREA_PX;
    const fromContent = layout?.height ? layout.height + legendBand + 8 : 0;
    const needed = Math.max(floorPx, fromContent);
    return `max(${VIEWPORT_MIN_HEIGHT}, min(${VIEWPORT_MAX_HEIGHT}, ${Math.round(needed)}px))`;
  }, [layout?.height, personCount]);
  const {
    pan,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    centerOn,
  } = usePeopleTreePan(panBounds);
  const didCenterRef = useRef(false);
  const edges = useMemo(() => computeTreeEdges(bundle), [bundle]);

  const hasRelationshipEdges = edges.length > 0;

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
  }, [bundle, expandedId, bumpMeasure]);

  useEffect(() => {
    didCenterRef.current = false;
  }, [bundle.people.length]);

  useEffect(() => {
    if (!layout || layout.width <= 0 || layout.height <= 0) return;
    const viewport = viewportRef.current;
    if (!viewport || didCenterRef.current) return;

    if (panAreaSize.w <= 0 || panAreaSize.h <= 0) return;

    const self = bundle.people.find((p) => p.is_self);
    const anchor = self ? layout.anchors.get(self.id) : null;
    const focusX = anchor?.center.x ?? layout.width / 2;
    const contentTopY = contentTopFromAnchors(layout.anchors);
    centerOn(
      panAreaSize.w,
      panAreaSize.h,
      layout.width,
      layout.height,
      focusX,
      contentTopY,
    );
    didCenterRef.current = true;
  }, [layout, bundle.people.length, centerOn, panAreaSize.h, panAreaSize.w]);

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
      minH={VIEWPORT_MIN_HEIGHT}
    >
      {personCount > 0 ? (
        <Text
          px="2"
          pt="1.5"
          pb="1"
          fontSize={APP_TEXT_SIZES.helper}
          lineHeight="short"
          color="fg.muted"
          flexShrink={0}
        >
          {peopleTreeLegend(hasRelationshipEdges)}
        </Text>
      ) : null}
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
        <Box
          ref={containerRef}
          position="absolute"
          left={0}
          top={0}
          w="max-content"
          py="2"
          px="3"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px)`,
              willChange: dragging ? "transform" : undefined,
            }}
          >
            {layout && layout.width > 0 && layout.height > 0 && layout.anchors.size > 0 ? (
              <PeopleTreeConnectors layout={layout} edges={edges} />
            ) : null}
            <Stack gap="0" position="relative" zIndex={1}>
              {rowsByRank.map(({ rank, people }, rowIndex) => (
                <Box key={rank}>
                  <PersonRow
                    people={people}
                    bundle={bundle}
                    expandedId={expandedId}
                    readOnly={readOnly}
                    registerAnchor={registerAnchor}
                    onToggle={onToggle}
                    onEdit={onEdit}
                  />
                  {rowIndex < rowsByRank.length - 1 ? (
                    <Box aria-hidden minH={RANK_GUTTER_MIN_H} w="100%" />
                  ) : null}
                </Box>
              ))}
              {friendRow.length > 0 ? (
                <Box pt={rowsByRank.length > 0 ? "2" : "0"}>
                  {rowsByRank.length > 0 ? (
                    <Stack gap="2" pb="2">
                      <Separator borderColor="border" />
                      <Text
                        fontSize={APP_TEXT_SIZES.helper}
                        fontWeight="semibold"
                        color="fg.muted"
                        px="0.5"
                      >
                        Friends
                      </Text>
                    </Stack>
                  ) : null}
                  <PersonRow
                    people={friendRow}
                    bundle={bundle}
                    expandedId={expandedId}
                    readOnly={readOnly}
                    registerAnchor={registerAnchor}
                    onToggle={onToggle}
                    onEdit={onEdit}
                  />
                </Box>
              ) : null}
            </Stack>
        </Box>
      </Box>
    </Box>
  );
}
