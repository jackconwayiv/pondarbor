import {
  PEOPLE_TREE_DOT,
  PEOPLE_TREE_DOT_PET,
  PEOPLE_TREE_LINE,
  PEOPLE_TREE_LINE_GUARDIAN,
  PEOPLE_TREE_LINE_PET,
} from "./peopleTreeColors";
import {
  elbowPoint,
  parentChildPath,
  partnerPath,
  petLeashPaths,
  type Point,
} from "./peopleTreeLayout";
import type { TreeEdge } from "./peopleTreeEdges";
import type { PeopleTreeLayout } from "./usePeopleTreeAnchors";

type Props = {
  layout: PeopleTreeLayout;
  edges: TreeEdge[];
};

function dot(cx: number, cy: number, r: number, fill: string, key: string) {
  return <circle key={key} cx={cx} cy={cy} r={r} fill={fill} />;
}

function collectEdgeDots(
  edges: TreeEdge[],
  anchors: Map<string, import("./peopleTreeLayout").PersonAnchor>,
): { x: number; y: number; key: string }[] {
  const dots: { x: number; y: number; key: string }[] = [];

  for (const edge of edges) {
    if (edge.kind === "parent" || edge.kind === "stepParent") {
      const par = anchors.get(edge.parentId);
      const ch = anchors.get(edge.childId);
      if (!par || !ch) continue;
      const elbow = elbowPoint(par.bottom, ch.top);
      const prefix = edge.kind === "stepParent" ? "s" : "p";
      dots.push({ x: elbow.x, y: elbow.y, key: `${prefix}-${edge.parentId}-${edge.childId}` });
    } else if (edge.kind === "partner") {
      const a = anchors.get(edge.aId);
      const b = anchors.get(edge.bId);
      if (!a || !b) continue;
      const left = a.center.x <= b.center.x ? a : b;
      const right = a.center.x <= b.center.x ? b : a;
      const y = (left.center.y + right.center.y) / 2;
      dots.push(
        { x: left.right.x, y, key: `r-${edge.aId}-${edge.bId}-l` },
        { x: right.left.x, y, key: `r-${edge.aId}-${edge.bId}-r` },
      );
    } else if (edge.kind === "guardian") {
      const g = anchors.get(edge.guardianId);
      const ch = anchors.get(edge.childId);
      if (!g || !ch) continue;
      const elbow = elbowPoint(g.bottom, ch.top);
      dots.push({ x: elbow.x, y: elbow.y, key: `g-${edge.guardianId}-${edge.childId}` });
    }
  }

  return dots;
}

export default function PeopleTreeConnectors({ layout, edges }: Props) {
  const paths: {
    d: string;
    stroke: string;
    dash?: string;
    opacity?: number;
    strokeWidth?: number;
    key: string;
  }[] = [];
  const { anchors } = layout;

  for (const edge of edges) {
    if (edge.kind === "parent") {
      const par = anchors.get(edge.parentId);
      const ch = anchors.get(edge.childId);
      if (!par || !ch) continue;
      paths.push({
        d: parentChildPath(par.bottom, ch.top),
        stroke: PEOPLE_TREE_LINE,
        key: `parent-${edge.parentId}-${edge.childId}`,
      });
    } else if (edge.kind === "stepParent") {
      const par = anchors.get(edge.parentId);
      const ch = anchors.get(edge.childId);
      if (!par || !ch) continue;
      paths.push({
        d: parentChildPath(par.bottom, ch.top),
        stroke: PEOPLE_TREE_LINE,
        dash: "6 4",
        opacity: 0.85,
        key: `step-${edge.parentId}-${edge.childId}`,
      });
    } else if (edge.kind === "partner") {
      const a = anchors.get(edge.aId);
      const b = anchors.get(edge.bId);
      if (!a || !b) continue;
      const left = a.center.x <= b.center.x ? a : b;
      const right = a.center.x <= b.center.x ? b : a;
      const from: Point = { x: left.right.x, y: (left.center.y + right.center.y) / 2 };
      const to: Point = { x: right.left.x, y: from.y };
      paths.push({
        d: partnerPath(from, to),
        stroke: PEOPLE_TREE_LINE,
        dash: edge.former ? "6 4" : undefined,
        opacity: edge.former ? 0.55 : 1,
        key: `partner-${edge.aId}-${edge.bId}`,
      });
    } else if (edge.kind === "guardian") {
      const g = anchors.get(edge.guardianId);
      const ch = anchors.get(edge.childId);
      if (!g || !ch) continue;
      paths.push({
        d: parentChildPath(g.bottom, ch.top),
        stroke: PEOPLE_TREE_LINE_GUARDIAN,
        dash: "4 3",
        opacity: 0.85,
        key: `guardian-${edge.guardianId}-${edge.childId}`,
      });
    } else if (edge.kind === "petLeash") {
      const owner = anchors.get(edge.ownerId);
      const pet = anchors.get(edge.petId);
      if (!owner || !pet) continue;
      const leash = petLeashPaths(owner.bottom, pet.top);
      const base = {
        stroke: PEOPLE_TREE_LINE_PET,
        strokeWidth: 2,
        opacity: 1,
      };
      paths.push({
        ...base,
        d: leash.handle,
        key: `pet-handle-${edge.ownerId}-${edge.petId}`,
      });
      paths.push({
        ...base,
        d: leash.drop,
        key: `pet-drop-${edge.ownerId}-${edge.petId}`,
      });
      paths.push({
        ...base,
        d: leash.collar,
        key: `pet-collar-${edge.ownerId}-${edge.petId}`,
      });
    }
  }

  const connectionDots = collectEdgeDots(edges, anchors);

  return (
    <svg
      aria-hidden
      width={layout.width}
      height={layout.height}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        pointerEvents: "none",
        zIndex: 2,
        overflow: "visible",
      }}
    >
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          fill="none"
          stroke={p.stroke}
          strokeWidth={p.strokeWidth ?? 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={p.dash}
          opacity={p.opacity ?? 1}
        />
      ))}
      {connectionDots.map((d) =>
        dot(
          d.x,
          d.y,
          5,
          d.key.startsWith("pet-") ? PEOPLE_TREE_DOT_PET : PEOPLE_TREE_DOT,
          d.key,
        ),
      )}
    </svg>
  );
}
