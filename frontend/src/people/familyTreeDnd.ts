import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type Collision,
  type CollisionDetection,
} from "@dnd-kit/core";

import { parseCellDndId } from "./FamilyTreeGrid";
import type { PeopleTreeLayout } from "./types";

function isCellCollisionId(id: string | number): boolean {
  return parseCellDndId(String(id)) != null;
}

function filterCellCollisions<T extends { id: string | number }>(hits: T[]): T[] {
  return hits.filter((hit) => isCellCollisionId(hit.id));
}

/** Prefer grid cell droppables so occupied cells stay valid drop targets. */
export const familyTreeCellCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = filterCellCollisions(pointerWithin(args));
  if (pointerHits.length > 0) return pointerHits;

  const rectHits = filterCellCollisions(rectIntersection(args));
  if (rectHits.length > 0) return rectHits;

  return filterCellCollisions(closestCenter(args));
};

export function resolveRearrangeDropCell(
  overId: string | number | undefined,
  collisions: Collision[] | undefined,
  layout: PeopleTreeLayout,
): { col: number; row: number } | null {
  for (const hit of collisions ?? []) {
    const cell = parseCellDndId(String(hit.id));
    if (cell) return cell;
  }
  if (overId == null) return null;
  const fromOver = parseCellDndId(String(overId));
  if (fromOver) return fromOver;
  const pos = layout.positions[String(overId)];
  if (pos) return { col: pos.col, row: pos.row };
  return null;
}
