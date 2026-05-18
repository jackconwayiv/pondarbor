import { describe, expect, it } from "vitest";

import type { EstatesGameState, EstatesRoundState } from "./api";
import {
  mergeOptimisticPlacement,
  serverHasPendingPlacement,
  type PendingPlacement,
} from "./optimisticPlacement";

function minimalGame(
  overrides: Partial<EstatesGameState> & {
    hand?: Array<Record<string, unknown>>;
    placements?: EstatesRoundState["placements_by_zone"];
  } = {},
): EstatesGameState {
  const hand = overrides.hand ?? [{ card_id: "c1", suit: "peasant" }];
  const placements: EstatesRoundState["placements_by_zone"] = overrides.placements ?? {};
  return {
    id: "g1",
    status: "active",
    round: 1,
    is_solo: false,
    victory_score: 10,
    player_1_id: 1,
    player_2_id: 2,
    player_1: { user_id: 1, seat_index: 1, display_name: "A", avatar_url: "" },
    player_2: { user_id: 2, seat_index: 2, display_name: "B", avatar_url: "" },
    players: [
      {
        user_id: 1,
        seat_index: 1,
        display_name: "A",
        avatar_url: "",
        deck: [],
        hand,
        discard: [],
        draw_bonus: 0,
        is_starting_player: true,
        score: 0,
      },
      {
        user_id: 2,
        seat_index: 2,
        display_name: "B",
        avatar_url: "",
        deck: [],
        hand: [],
        discard: [],
        draw_bonus: 0,
        is_starting_player: false,
        score: 0,
      },
    ],
    round_state: {
      round_number: 1,
      phase: "placement",
      turn_player_seat: 1,
      actions_taken_by_seat: { "1": 0, "2": 0 },
      placements_by_zone: placements,
      pending_actor_seat: 1,
      pending_action: "play_card",
      pending_payload: {},
      status_message: "Your turn",
      phase_started_at: "",
      connections_seat_1: 1,
      connections_seat_2: 1,
      is_paused: false,
      disconnected_seat: null,
    },
    winner_user_id: null,
    completion_outcome: null,
    conceded_by_user_id: null,
    started_at: null,
    completed_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

const pending: PendingPlacement = {
  zone: "farm",
  cardId: "c1",
  card: { card_id: "c1", suit: "peasant" },
};

describe("optimisticPlacement", () => {
  it("returns game unchanged when pending is null", () => {
    const game = minimalGame();
    expect(mergeOptimisticPlacement(game, 1, null)).toBe(game);
  });

  it("removes card from hand and places in zone", () => {
    const game = minimalGame();
    const merged = mergeOptimisticPlacement(game, 1, pending);
    expect(merged.players[0].hand).toHaveLength(0);
    const placed = merged.round_state?.placements_by_zone?.farm?.["1"] as {
      card: { card_id: string };
      confirmed: boolean;
    };
    expect(placed.card.card_id).toBe("c1");
    expect(placed.confirmed).toBe(true);
    expect(merged.round_state?.pending_actor_seat).toBe(1);
  });

  it("serverHasPendingPlacement detects matching server state", () => {
    const game = minimalGame({
      placements: {
        farm: {
          "1": { card: { card_id: "c1" }, confirmed: true },
          "2": null,
        },
      },
      hand: [],
    });
    expect(serverHasPendingPlacement(game, 1, pending)).toBe(true);
    expect(mergeOptimisticPlacement(game, 1, pending)).toBe(game);
  });
});
