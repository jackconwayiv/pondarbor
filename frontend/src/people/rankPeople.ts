import { orderPeopleInRow } from "./orderRowPeople";
import type { PeoplePartnershipRow, PeoplePerson } from "./types";

export type TreeRowsLayout = {
  rowsByRank: { rank: number; people: PeoplePerson[] }[];
  friendRow: PeoplePerson[];
};

/** Non-family contacts listed as relation_core friend (not the self row). */
export function isTreeFriend(person: PeoplePerson): boolean {
  return person.relation_core === "friend" && !person.is_self;
}

/** Same generation as self when relation_core says so (bio links may be missing). */
const SELF_PEER_RELATION_CORES = new Set(["brother", "sister"]);

function sharedBioParentIds(a: PeoplePerson, b: PeoplePerson): string[] {
  const bParents = new Set(
    [b.bio_mother_id, b.bio_father_id].filter((id): id is string => Boolean(id)),
  );
  return [a.bio_mother_id, a.bio_father_id].filter(
    (id): id is string => id != null && id !== "" && bParents.has(id),
  );
}

/** Approximate generation rank: lower = older (drawn higher on page). */
export function computePersonRanks(
  people: PeoplePerson[],
  partnerships: PeoplePartnershipRow[],
): Map<string, number> {
  const byId = new Map(people.map((p) => [p.id, p]));
  const self = people.find((p) => p.is_self);
  const ranks = new Map<string, number | null>();
  for (const p of people) {
    ranks.set(p.id, null);
  }
  if (self) {
    ranks.set(self.id, 0);
  }

  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  for (const p of people) {
    const pid = p.id;
    const pars: string[] = [];
    if (p.bio_mother_id) pars.push(p.bio_mother_id);
    if (p.bio_father_id) pars.push(p.bio_father_id);
    if (p.step_mother_id) pars.push(p.step_mother_id);
    if (p.step_father_id) pars.push(p.step_father_id);
    parentsOf.set(pid, pars);
    for (const par of pars) {
      if (!childrenOf.has(par)) childrenOf.set(par, []);
      childrenOf.get(par)!.push(pid);
    }
  }

  const partnerPairs: [string, string][] = partnerships.map((row) => [
    row.person_a_id,
    row.person_b_id,
  ]);

  let changed = true;
  let guard = 0;
  while (changed && guard < people.length + partnerships.length + 8) {
    guard += 1;
    changed = false;
    for (const p of people) {
      const r = ranks.get(p.id);
      if (r == null) continue;
      for (const par of parentsOf.get(p.id) ?? []) {
        const nr = r - 1;
        const cur = ranks.get(par);
        if (cur == null || cur > nr) {
          ranks.set(par, nr);
          changed = true;
        }
      }
      for (const ch of childrenOf.get(p.id) ?? []) {
        const nr = r + 1;
        const cur = ranks.get(ch);
        if (cur == null || cur < nr) {
          ranks.set(ch, nr);
          changed = true;
        }
      }
    }
    for (const [a, b] of partnerPairs) {
      if (!byId.has(a) || !byId.has(b)) continue;
      const ra = ranks.get(a);
      const rb = ranks.get(b);
      if (ra == null && rb == null) continue;
      const base = ra == null ? (rb as number) : rb == null ? ra : Math.min(ra, rb);
      if (ranks.get(a) !== base || ranks.get(b) !== base) {
        ranks.set(a, base);
        ranks.set(b, base);
        changed = true;
      }
    }
  }

  // Siblings (shared bio parent) and brother/sister labels share self's generation.
  if (self) {
    const selfRank = ranks.get(self.id);
    if (selfRank != null) {
      let peerChanged = true;
      let peerGuard = 0;
      while (peerChanged && peerGuard < people.length + 4) {
        peerGuard += 1;
        peerChanged = false;
        for (const p of people) {
          if (p.id === self.id) continue;
          const isPeer =
            SELF_PEER_RELATION_CORES.has(p.relation_core) ||
            sharedBioParentIds(p, self).length > 0;
          if (!isPeer) continue;
          const cur = ranks.get(p.id);
          if (cur !== selfRank) {
            ranks.set(p.id, selfRank);
            peerChanged = true;
          }
        }
        for (const p of people) {
          const r = ranks.get(p.id);
          if (r == null) continue;
          for (const other of people) {
            if (other.id === p.id) continue;
            if (sharedBioParentIds(p, other).length === 0) continue;
            const ro = ranks.get(other.id);
            const align = ro == null ? r : Math.min(r, ro);
            if (ranks.get(p.id) !== align) {
              ranks.set(p.id, align);
              peerChanged = true;
            }
            if (ro != null && ranks.get(other.id) !== align) {
              ranks.set(other.id, align);
              peerChanged = true;
            }
          }
        }
      }
    }
  }

  // Pets sit one generation below the tree owner (same row as children).
  if (self) {
    const selfRank = ranks.get(self.id);
    if (selfRank != null) {
      for (const p of people) {
        if (p.relation_core === "pet") {
          ranks.set(p.id, selfRank + 1);
        }
      }
    }
  }

  const assigned = people.map((p) => ranks.get(p.id)).filter((x): x is number => x != null);
  const fallback = assigned.length ? Math.min(...assigned) : 0;
  const out = new Map<string, number>();
  for (const p of people) {
    const r = ranks.get(p.id);
    out.set(p.id, r == null ? fallback : r);
  }
  return out;
}

/** Family ranks plus a separated bottom row for relation_core friend. */
export function buildTreeRows(
  people: PeoplePerson[],
  partnerships: PeoplePartnershipRow[] = [],
): TreeRowsLayout {
  const family = people.filter((p) => !isTreeFriend(p));
  const friends = people.filter(isTreeFriend);
  const self = people.find((p) => p.is_self);
  const ranks = computePersonRanks(family, partnerships);
  const byRank = groupPeopleByRank(family, ranks, partnerships);
  const rowsByRank = [...byRank.keys()]
    .sort((a, b) => a - b)
    .map((rank) => ({ rank, people: byRank.get(rank)! }));
  const friendRow =
    friends.length > 0 ? orderPeopleInRow(friends, partnerships, self) : [];
  return { rowsByRank, friendRow };
}

export function groupPeopleByRank(
  people: PeoplePerson[],
  ranks: Map<string, number>,
  partnerships: PeoplePartnershipRow[] = [],
): Map<number, PeoplePerson[]> {
  const self = people.find((p) => p.is_self);
  const byRank = new Map<number, PeoplePerson[]>();
  for (const p of people) {
    const r = ranks.get(p.id) ?? 0;
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r)!.push(p);
  }
  const rankKeys = [...byRank.keys()].sort((a, b) => a - b);
  for (let i = 0; i < rankKeys.length; i++) {
    const rank = rankKeys[i]!;
    const row = byRank.get(rank)!;
    const prevRow = i > 0 ? byRank.get(rankKeys[i - 1]!) : undefined;
    byRank.set(rank, orderPeopleInRow(row, partnerships, self, { prevRow }));
  }
  return byRank;
}
