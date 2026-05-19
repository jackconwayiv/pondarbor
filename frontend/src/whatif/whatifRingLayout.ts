/** Ring layout: interleaved players (join order) and NPCs (add order). Mirrors backend subject_board.build_ring_layout. */

export type RingSlotKind = "player" | "npc";

export type RingSlot = {
  kind: RingSlotKind;
  id: number;
};

export function buildRingLayout(playerIds: number[], npcIds: number[]): RingSlot[] {
  const p = playerIds.length;
  const n = npcIds.length;
  if (n === 0) {
    return playerIds.map((id) => ({ kind: "player" as const, id }));
  }
  if (p === 0) return [];
  const gapCounts = new Array<number>(p).fill(0);
  if (n <= p) {
    for (let k = 0; k < n; k += 1) {
      const gapIdx = Math.min(p - 1, Math.floor((k + 0.5) * p / n));
      gapCounts[gapIdx]! += 1;
    }
  } else {
    for (let i = 0; i < p; i += 1) {
      gapCounts[i] = Math.floor((n * (i + 1)) / p) - Math.floor((n * i) / p);
    }
  }
  const layout: RingSlot[] = [];
  let npcI = 0;
  for (let i = 0; i < p; i += 1) {
    layout.push({ kind: "player", id: playerIds[i]! });
    for (let g = 0; g < gapCounts[i]!; g += 1) {
      layout.push({ kind: "npc", id: npcIds[npcI]! });
      npcI += 1;
    }
  }
  return layout;
}

export function ringEntityCount(numPlayers: number, numNpcs: number): number {
  return numPlayers + numNpcs;
}

/** L = E, or E+1 when P>=3 (Challenge at L-1). */
export function subjectBoardSeatCount(numPlayers: number, numRingEntities?: number): number {
  const e = numRingEntities ?? numPlayers;
  if (e <= 0) return 0;
  if (e === 2 && numPlayers === 2) return 2;
  if (numPlayers >= 3) return e + 1;
  return e;
}

export function challengeSeatIndex(numPlayers: number, numRingEntities: number): number | null {
  const l = subjectBoardSeatCount(numPlayers, numRingEntities);
  if (numPlayers >= 3 && l === numRingEntities + 1) return l - 1;
  return null;
}

export function subjectBoardSeatIsChallenge(
  seatIndex: number,
  numPlayers: number,
  numRingEntities?: number,
): boolean {
  const e = numRingEntities ?? numPlayers;
  const l = subjectBoardSeatCount(numPlayers, e);
  return numPlayers >= 3 && l === e + 1 && seatIndex === l - 1;
}

export function seatOccupantAt(
  layout: RingSlot[],
  physicalIndex: number,
  seatCount: number,
  numPlayers: number,
): RingSlot | null {
  const e = layout.length;
  if (physicalIndex < 0 || physicalIndex >= seatCount) return null;
  if (subjectBoardSeatIsChallenge(physicalIndex, numPlayers, e)) return null;
  if (physicalIndex >= e) return null;
  return layout[physicalIndex] ?? null;
}

/** Human join-order number 1..P, or null for non-players. */
export function humanPlayerNumber(playerId: number, playerIds: number[]): number | null {
  const idx = playerIds.indexOf(playerId);
  if (idx < 0) return null;
  return idx + 1;
}
