import { useEffect, useMemo } from "react";

import FamilyTreeCanvas from "./FamilyTreeCanvas";
import FamilyTreeGrid from "./FamilyTreeGrid";
import PeopleTreeConnectors from "./PeopleTreeConnectors";
import PersonCard from "./PersonCard";
import { computeTreeEdges } from "./peopleTreeEdges";
import { resolveDisplayLayout, trimGridAroundOccupied } from "./treeLayout";
import type { PeopleGraphBundle } from "./types";
import { usePeopleTreeAnchors } from "./usePeopleTreeAnchors";

export type FamilyTreeDisplayViewProps = {
  bundle: PeopleGraphBundle;
};

export default function FamilyTreeDisplayView({
  bundle,
}: FamilyTreeDisplayViewProps) {
  const personCount = bundle.people.length;
  const anchorApi = usePeopleTreeAnchors(personCount);
  const { registerAnchor, layout: anchorLayout, bumpMeasure } = anchorApi;

  const gridLayout = useMemo(() => {
    const resolved = resolveDisplayLayout(bundle.layout, bundle.people, bundle.partnerships);
    return trimGridAroundOccupied(resolved);
  }, [bundle.layout, bundle.people, bundle.partnerships]);

  const edges = useMemo(() => computeTreeEdges(bundle), [bundle]);
  const selfId = bundle.people.find((p) => p.is_self)?.id ?? null;
  const byId = useMemo(() => new Map(bundle.people.map((p) => [p.id, p])), [bundle.people]);

  useEffect(() => {
    bumpMeasure();
  }, [gridLayout, bumpMeasure]);

  return (
    <FamilyTreeCanvas
      personCount={personCount}
      centerOnPersonId={selfId}
      enablePinchZoom
      clampPanToGrid
      anchorApi={anchorApi}
    >
      <FamilyTreeGrid
        layout={gridLayout}
        registerAnchor={registerAnchor}
        renderOverlay={
          anchorLayout &&
          anchorLayout.width > 0 &&
          anchorLayout.height > 0 &&
          anchorLayout.anchors.size > 0 ? (
            <PeopleTreeConnectors layout={anchorLayout} edges={edges} />
          ) : null
        }
        renderCell={(_col, _row, occupantId) => {
          if (!occupantId) return null;
          const person = byId.get(occupantId);
          if (!person) return null;
          return (
            <PersonCard person={person} bundle={bundle} variant="squareCompact" />
          );
        }}
      />
    </FamilyTreeCanvas>
  );
}
