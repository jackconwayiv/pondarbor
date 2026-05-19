import type { WhatIfNpc, WhatIfPlayer } from "./types";
import {
  buildRingLayout,
  humanPlayerNumber,
  seatOccupantAt,
  subjectBoardSeatCount,
  subjectBoardSeatIsChallenge,
} from "./whatifRingLayout";
import { formatPlayerSeatLabel } from "./whatifTvSeatRingLabel";

export {
  buildRingLayout,
  humanPlayerNumber,
  subjectBoardSeatCount,
  subjectBoardSeatIsChallenge,
} from "./whatifRingLayout";

export function ringLayoutFromSession(players: WhatIfPlayer[], npcs: WhatIfNpc[]) {
  const playerIds = players.map((p) => p.id);
  const npcIds = npcs.map((n) => n.id);
  const layout = buildRingLayout(playerIds, npcIds);
  const p = players.length;
  const e = layout.length;
  const l = subjectBoardSeatCount(p, e);
  return { layout, playerIds, npcIds, p, e, l };
}

export function subjectBoardSeatLabel(
  players: WhatIfPlayer[],
  npcs: WhatIfNpc[],
  physicalSeatIndex: number,
): string {
  const { layout, p, l } = ringLayoutFromSession(players, npcs);
  if (physicalSeatIndex < 0 || physicalSeatIndex >= l) return "?";
  if (subjectBoardSeatIsChallenge(physicalSeatIndex, p, layout.length)) return "Challenge";
  const occ = seatOccupantAt(layout, physicalSeatIndex, l, p);
  if (!occ) return "?";
  if (occ.kind === "player") {
    return players.find((pl) => pl.id === occ.id)?.display_name ?? "?";
  }
  return npcs.find((n) => n.id === occ.id)?.display_name ?? "?";
}

export function physicalSeatIndexForPlayer(
  players: WhatIfPlayer[],
  npcs: WhatIfNpc[],
  playerId: number,
): number {
  const { layout, l } = ringLayoutFromSession(players, npcs);
  for (let i = 0; i < l; i += 1) {
    const occ = seatOccupantAt(layout, i, l, players.length);
    if (occ?.kind === "player" && occ.id === playerId) return i;
  }
  return -1;
}

export function subjectBoardSeatIsNpc(
  players: WhatIfPlayer[],
  npcs: WhatIfNpc[],
  physicalSeatIndex: number,
): boolean {
  const { layout, p, l } = ringLayoutFromSession(players, npcs);
  const occ = seatOccupantAt(layout, physicalSeatIndex, l, p);
  return occ?.kind === "npc";
}

export type SubjectDieSeatMeta =
  | { kind: "challenge"; label: string }
  | { kind: "player"; label: string; player: WhatIfPlayer }
  | { kind: "npc"; label: string; npc: WhatIfNpc }
  | { kind: "unknown"; label: string };

export function subjectDieSeatMeta(
  players: WhatIfPlayer[],
  npcs: WhatIfNpc[],
  physicalSeat: number,
): SubjectDieSeatMeta {
  const { layout, playerIds, p, l } = ringLayoutFromSession(players, npcs);
  if (subjectBoardSeatIsChallenge(physicalSeat, p, layout.length)) {
    return { kind: "challenge", label: "Challenge" };
  }
  const occ = seatOccupantAt(layout, physicalSeat, l, p);
  if (!occ) return { kind: "unknown", label: "?" };
  if (occ.kind === "npc") {
    const npc = npcs.find((n) => n.id === occ.id);
    if (!npc) return { kind: "unknown", label: "?" };
    return { kind: "npc", label: npc.display_name, npc };
  }
  const player = players.find((pl) => pl.id === occ.id);
  if (!player) return { kind: "unknown", label: "?" };
  const num = humanPlayerNumber(occ.id, playerIds);
  return {
    kind: "player",
    label: num != null ? formatPlayerSeatLabel(num, player.display_name) : player.display_name,
    player,
  };
}

/** Hand subject-pick cards: name only (no join-order seat number). */
export function subjectDieSeatHandLabel(meta: SubjectDieSeatMeta): string {
  if (meta.kind === "player") return meta.player.display_name;
  if (meta.kind === "npc") return meta.npc.display_name;
  return meta.label;
}
