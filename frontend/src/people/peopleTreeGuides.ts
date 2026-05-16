import type { TreeEdge } from "./peopleTreeEdges";

export function rankIndexByPersonId(ranksOrdered: string[][]): Map<string, number> {
  const map = new Map<string, number>();
  ranksOrdered.forEach((ids, index) => {
    for (const id of ids) map.set(id, index);
  });
  return map;
}

/** People in rank i with a parent/guardian link to someone in rank i+1 (show stub down). */
export function parentIdsWithChildInNextRank(
  edges: TreeEdge[],
  ranksOrdered: string[][],
): Set<string> {
  const rankOf = rankIndexByPersonId(ranksOrdered);
  const ids = new Set<string>();
  for (let i = 0; i < ranksOrdered.length - 1; i++) {
    for (const edge of edges) {
      if (edge.kind === "parent" || edge.kind === "stepParent") {
        if (rankOf.get(edge.parentId) === i && rankOf.get(edge.childId) === i + 1) {
          ids.add(edge.parentId);
        }
      } else if (edge.kind === "guardian") {
        if (rankOf.get(edge.guardianId) === i && rankOf.get(edge.childId) === i + 1) {
          ids.add(edge.guardianId);
        }
      }
    }
  }
  return ids;
}

/** People in rank i+1 with a parent/guardian link from someone in rank i (show stub up). */
export function childIdsWithParentInPrevRank(
  edges: TreeEdge[],
  ranksOrdered: string[][],
): Set<string> {
  const rankOf = rankIndexByPersonId(ranksOrdered);
  const ids = new Set<string>();
  for (let i = 0; i < ranksOrdered.length - 1; i++) {
    for (const edge of edges) {
      if (edge.kind === "parent" || edge.kind === "stepParent") {
        if (rankOf.get(edge.parentId) === i && rankOf.get(edge.childId) === i + 1) {
          ids.add(edge.childId);
        }
      } else if (edge.kind === "guardian") {
        if (rankOf.get(edge.guardianId) === i && rankOf.get(edge.childId) === i + 1) {
          ids.add(edge.childId);
        }
      }
    }
  }
  return ids;
}
