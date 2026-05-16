import { computePetLeashLinks } from "./petLinks";
import { allStepParentLinks } from "./stepParentLinks";
import type { PeopleGraphBundle } from "./types";

export type TreeEdge =
  | { kind: "parent"; parentId: string; childId: string }
  | { kind: "stepParent"; parentId: string; childId: string }
  | { kind: "petLeash"; ownerId: string; petId: string }
  | { kind: "partner"; aId: string; bId: string; former: boolean }
  | { kind: "guardian"; guardianId: string; childId: string };

export function computeTreeEdges(bundle: PeopleGraphBundle): TreeEdge[] {
  const edges: TreeEdge[] = [];
  const seenParent = new Set<string>();
  const seenStep = new Set<string>();

  for (const p of bundle.people) {
    for (const parId of [p.bio_mother_id, p.bio_father_id]) {
      if (!parId) continue;
      const key = `${parId}\0${p.id}`;
      if (seenParent.has(key)) continue;
      seenParent.add(key);
      edges.push({ kind: "parent", parentId: parId, childId: p.id });
    }
  }

  for (const link of allStepParentLinks(bundle.people)) {
    const key = `${link.parentId}\0${link.childId}`;
    if (seenStep.has(key) || seenParent.has(key)) continue;
    seenStep.add(key);
    edges.push({
      kind: "stepParent",
      parentId: link.parentId,
      childId: link.childId,
    });
  }

  for (const link of computePetLeashLinks(bundle.people)) {
    edges.push({ kind: "petLeash", ownerId: link.ownerId, petId: link.petId });
  }

  for (const row of bundle.partnerships) {
    edges.push({
      kind: "partner",
      aId: row.person_a_id,
      bId: row.person_b_id,
      former: row.status === "former",
    });
  }

  for (const row of bundle.guardian_links) {
    edges.push({
      kind: "guardian",
      guardianId: row.guardian_id,
      childId: row.child_id,
    });
  }

  return edges;
}
