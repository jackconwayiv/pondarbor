import type { EstatesGameState } from "./api";

export type PendingPlacement = {
  zone: string;
  cardId: string;
  card: Record<string, unknown>;
};

function placedCardId(
  placementsByZone: Record<string, Record<string, unknown>>,
  zone: string,
  seatKey: string,
): string | null {
  const row = placementsByZone[zone]?.[seatKey];
  if (!row || typeof row !== "object") return null;
  const card = (row as { card?: unknown }).card;
  if (!card || typeof card !== "object") return null;
  return String((card as { card_id?: unknown }).card_id || "") || null;
}

/** True when the server already reflects the pending placement. */
export function serverHasPendingPlacement(
  game: EstatesGameState,
  mySeat: number,
  pending: PendingPlacement,
): boolean {
  const seatKey = String(mySeat);
  const placements = game.round_state?.placements_by_zone ?? {};
  return placedCardId(placements, pending.zone, seatKey) === pending.cardId;
}

/** Overlay optimistic hand removal + zone placement without changing turn seat. */
export function mergeOptimisticPlacement(
  game: EstatesGameState,
  mySeat: number,
  pending: PendingPlacement | null,
): EstatesGameState {
  if (!pending || !game.round_state) return game;
  if (serverHasPendingPlacement(game, mySeat, pending)) return game;

  const seatKey = String(mySeat);
  const placements = { ...(game.round_state.placements_by_zone ?? {}) };
  const zonePayload = { ...(placements[pending.zone] ?? {}) };
  zonePayload[seatKey] = { card: pending.card, confirmed: true };
  placements[pending.zone] = zonePayload;

  const players = game.players.map((player) => {
    if (player.seat_index !== mySeat) return player;
    return {
      ...player,
      hand: (player.hand ?? []).filter(
        (c) => String((c as { card_id?: unknown }).card_id || "") !== pending.cardId,
      ),
    };
  });

  return {
    ...game,
    players,
    round_state: {
      ...game.round_state,
      placements_by_zone: placements,
    },
  };
}
