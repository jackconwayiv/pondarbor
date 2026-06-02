from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from estates.bot_user import get_computer_user
from estates.computer import (
    PlacementMove,
    assign_round_zone_personas,
    build_opponent_card_pool,
    normalize_zone_personas,
    optimize_zone_personas,
    pick_random_zone_personas,
    rank_computer_moves,
    rank_gate_moves,
    rank_placement_moves,
    rank_tower_moves,
    serialize_zone_personas,
    _expected_rank_in_zone_from_pool,
    _prob_opponent_beats_card_in_zone,
)
from estates.constants import COMPUTER_SEAT_INDEX, HUMAN_SEAT_INDEX
from estates.models import EstatesGame, EstatesPlayerState, EstatesRoundState
from estates.presence import adjust_presence_connection
from estates.views import _solo_advance_scoring_and_computer, _try_run_computer_step

User = get_user_model()


class EstatesComputerTests(TestCase):
    def setUp(self):
        self.human = User.objects.create_user(email="human@example.com", password="secret12345")
        self.human.account_status = User.AccountStatus.APPROVED
        self.human.save(update_fields=["account_status"])
        self.client = APIClient()
        self.client.force_login(self.human)
        self.computer = get_computer_user()

    def _solo_game(self, *, difficulty: str = "normal") -> EstatesGame:
        resp = self.client.post(
            "/api/v1/estates/lobbies/solo/",
            {"difficulty": difficulty},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        return EstatesGame.objects.get(pk=resp.json()["id"])

    def test_list_my_games_includes_computer_difficulty(self):
        game = self._solo_game(difficulty="normal")
        resp = self.client.get("/api/v1/estates/games/mine/list/")
        self.assertEqual(resp.status_code, 200)
        rows = resp.json()["in_progress"]
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0]["is_solo"])
        self.assertEqual(rows[0]["computer_difficulty"], "normal")

    def test_solo_start_blocks_second_open_game(self):
        self._solo_game()
        resp = self.client.post("/api/v1/estates/lobbies/solo/", {"difficulty": "easy"}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_solo_start_active_with_computer_seat(self):
        game = self._solo_game(difficulty="hard")
        self.assertTrue(game.is_solo)
        self.assertEqual(game.victory_score, 7)
        self.assertEqual(game.computer_difficulty, "hard")
        self.assertEqual(game.computer_persona, "")
        self.assertEqual(game.status, EstatesGame.Status.ACTIVE)
        self.assertEqual(EstatesPlayerState.objects.filter(game=game).count(), 2)

    def test_opponent_hand_hidden_in_api(self):
        game = self._solo_game()
        round_state = EstatesRoundState.objects.get(game=game)
        # Poll advances solo games when it is the computer's turn; keep human to act so hand counts stay stable.
        if round_state.pending_actor_seat == COMPUTER_SEAT_INDEX:
            round_state.pending_actor_seat = HUMAN_SEAT_INDEX
            round_state.pending_action = "play_card"
            round_state.pending_computer_action_at = None
            round_state.save(
                update_fields=[
                    "pending_actor_seat",
                    "pending_action",
                    "pending_computer_action_at",
                    "updated_at",
                ]
            )
        adjust_presence_connection(game_id=str(game.pk), seat_index=HUMAN_SEAT_INDEX, delta=1)
        resp = self.client.get("/api/v1/estates/games/mine/")
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        players = {p["seat_index"]: p for p in payload["players"]}
        self.assertEqual(len(players[HUMAN_SEAT_INDEX]["hand"]), 5)
        self.assertEqual(players[COMPUTER_SEAT_INDEX]["hand"], [])
        self.assertEqual(players[COMPUTER_SEAT_INDEX]["deck"], [])
        self.assertEqual(players[COMPUTER_SEAT_INDEX]["hand_count"], 5)

    def test_opponent_spent_cards_visible_in_api(self):
        game = self._solo_game()
        computer_state = EstatesPlayerState.objects.get(game=game, seat_index=2)
        computer_state.discard = [
            {
                "card_id": "peasant-1-1",
                "suit": "peasant",
                "rank": 1,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            }
        ]
        computer_state.save(update_fields=["discard", "updated_at"])
        adjust_presence_connection(game_id=str(game.pk), seat_index=1, delta=1)
        resp = self.client.get("/api/v1/estates/games/mine/")
        payload = resp.json()
        players = {p["seat_index"]: p for p in payload["players"]}
        self.assertEqual(len(players[2]["discard"]), 1)
        self.assertEqual(players[2]["discard"][0]["card_id"], "peasant-1-1")
        self.assertEqual(players[2]["hand"], [])

    def test_computer_step_respects_schedule(self):
        game = self._solo_game()
        round_state = EstatesRoundState.objects.get(game=game)
        round_state.pending_actor_seat = COMPUTER_SEAT_INDEX
        round_state.phase = EstatesRoundState.Phase.PLACEMENT
        round_state.pending_action = "play_card"
        round_state.pending_computer_action_at = timezone.now() + timedelta(seconds=30)
        round_state.is_paused = False
        round_state.save()
        self.assertFalse(_try_run_computer_step(game_id=str(game.pk)))

    def test_easy_computer_plays_when_solo_drive_runs(self):
        game = self._solo_game(difficulty="easy")
        adjust_presence_connection(game_id=str(game.pk), seat_index=HUMAN_SEAT_INDEX, delta=1)
        round_state = EstatesRoundState.objects.get(game=game)
        computer_state = EstatesPlayerState.objects.get(game=game, seat_index=COMPUTER_SEAT_INDEX)
        hand_before = len(computer_state.hand or [])
        self.assertGreater(hand_before, 0)
        round_state.pending_actor_seat = COMPUTER_SEAT_INDEX
        round_state.pending_action = "play_card"
        round_state.phase = EstatesRoundState.Phase.PLACEMENT
        round_state.is_paused = False
        round_state.pending_computer_action_at = timezone.now() + timedelta(seconds=30)
        round_state.save()
        _progressed, computer_step = _solo_advance_scoring_and_computer(game_id=str(game.pk))
        self.assertTrue(computer_step, "expected computer to play via solo drive")
        computer_state.refresh_from_db()
        self.assertLess(len(computer_state.hand or []), hand_before)

    def test_easy_computer_responds_after_human_place_card(self):
        game = self._solo_game(difficulty="easy")
        adjust_presence_connection(game_id=str(game.pk), seat_index=HUMAN_SEAT_INDEX, delta=1)
        human = EstatesPlayerState.objects.get(game=game, seat_index=HUMAN_SEAT_INDEX)
        round_state = EstatesRoundState.objects.get(game=game)
        if round_state.pending_actor_seat != HUMAN_SEAT_INDEX:
            round_state.pending_actor_seat = HUMAN_SEAT_INDEX
            round_state.pending_action = "play_card"
            round_state.is_paused = False
            round_state.save()
        card = next(c for c in (human.hand or []) if str(c.get("suit") or "") == "peasant")
        computer_before = len(
            EstatesPlayerState.objects.get(game=game, seat_index=COMPUTER_SEAT_INDEX).hand or []
        )
        resp = self.client.post(
            f"/api/v1/estates/games/{game.id}/actions/place-card/",
            {"card_id": card["card_id"], "zone": "farm"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        round_state.refresh_from_db()
        if round_state.pending_actor_seat == COMPUTER_SEAT_INDEX:
            _solo_advance_scoring_and_computer(game_id=str(game.pk))
            computer_after = len(
                EstatesPlayerState.objects.get(game=game, seat_index=COMPUTER_SEAT_INDEX).hand or []
            )
            self.assertLess(computer_after, computer_before)

    def test_rank_placement_moves_legality(self):
        hand = [
            {
                "card_id": "royal-5-1",
                "suit": "royal",
                "rank": 5,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            }
        ]
        placements = {
            "gate": {"1": None, "2": None},
            "farm": {"1": None, "2": None},
            "road": {"1": None, "2": None},
            "tower": {"1": None, "2": None},
            "throne": {"1": None, "2": None},
        }
        zone_personas = {z: "throne_rush" for z in ("gate", "farm", "road", "tower", "throne")}
        moves = rank_placement_moves(
            computer_hand=hand,
            placements=placements,
            computer_seat=2,
            opponent_seat=1,
            computer_score=0,
            opponent_score=0,
            victory_score=7,
            zone_personas=zone_personas,
            difficulty="normal",
        )
        self.assertTrue(any(m.zone == "throne" for m in moves))

    def _placed(self, *, seat: int, card: dict) -> dict:
        return {str(seat): {"card": card, "confirmed": True}}

    def test_gate_debuff_prefers_solo_rank_one_waste(self):
        placements = {
            "gate": {"1": None, "2": None},
            "farm": self._placed(
                seat=1,
                card={
                    "card_id": "peasant-1-1",
                    "suit": "peasant",
                    "rank": 1,
                    "temporary_value_modifier": 0,
                    "permanent_value_bonus": 0,
                },
            ),
            "road": self._placed(
                seat=1,
                card={
                    "card_id": "peasant-4-1",
                    "suit": "peasant",
                    "rank": 4,
                    "temporary_value_modifier": 0,
                    "permanent_value_bonus": 0,
                },
            ),
            "tower": {"1": None, "2": None},
            "throne": {"1": None, "2": None},
        }
        moves = rank_gate_moves(
            placements=placements,
            actor_seat=2,
            target_seat=1,
            difficulty="normal",
        )
        self.assertGreaterEqual(len(moves), 2)
        self.assertEqual(moves[0].target_zone, "farm")
        self.assertEqual(moves[0].target_card_id, "peasant-1-1")

    def test_gate_debuff_prefers_strategic_flip_over_waste(self):
        placements = {
            "gate": {"1": None, "2": None},
            "farm": self._placed(
                seat=1,
                card={
                    "card_id": "peasant-1-1",
                    "suit": "peasant",
                    "rank": 1,
                    "temporary_value_modifier": 0,
                    "permanent_value_bonus": 0,
                },
            ),
            "road": {
                "1": {
                    "card": {
                        "card_id": "peasant-4-1",
                        "suit": "peasant",
                        "rank": 4,
                        "temporary_value_modifier": 0,
                        "permanent_value_bonus": 0,
                    },
                    "confirmed": True,
                },
                "2": {
                    "card": {
                        "card_id": "noble-3-1",
                        "suit": "noble",
                        "rank": 3,
                        "temporary_value_modifier": 0,
                        "permanent_value_bonus": 0,
                    },
                    "confirmed": True,
                },
            },
            "tower": {"1": None, "2": None},
            "throne": {"1": None, "2": None},
        }
        moves = rank_gate_moves(
            placements=placements,
            actor_seat=2,
            target_seat=1,
            difficulty="normal",
        )
        self.assertGreaterEqual(len(moves), 2)
        self.assertEqual(moves[0].target_zone, "road")
        self.assertEqual(moves[0].target_card_id, "peasant-4-1")

    def test_tower_discard_keeps_lone_suit_when_pair_is_low_value(self):
        hand = [
            {
                "card_id": "peasant-1-1",
                "suit": "peasant",
                "rank": 1,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "noble-2-1",
                "suit": "noble",
                "rank": 2,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "noble-2-2",
                "suit": "noble",
                "rank": 2,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        ]
        moves = rank_tower_moves(computer_hand=hand, difficulty="normal")
        self.assertEqual(len(moves), 1)
        self.assertEqual(
            set(moves[0].target_card_ids),
            {"peasant-1-1", "noble-2-1", "noble-2-2"},
        )

    def test_tower_discard_dumps_value_one_solo_when_pair_is_three_plus(self):
        hand = [
            {
                "card_id": "peasant-1-1",
                "suit": "peasant",
                "rank": 1,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "noble-4-1",
                "suit": "noble",
                "rank": 4,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "noble-5-1",
                "suit": "noble",
                "rank": 5,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        ]
        moves = rank_tower_moves(computer_hand=hand, difficulty="normal")
        self.assertEqual(len(moves), 1)
        self.assertEqual(moves[0].target_card_ids, ("peasant-1-1",))

    def test_tower_discard_by_difficulty(self):
        hand = [
            {
                "card_id": "peasant-1-1",
                "suit": "peasant",
                "rank": 1,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "noble-3-1",
                "suit": "noble",
                "rank": 3,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        ]
        self.assertEqual(rank_tower_moves(computer_hand=[], difficulty="normal"), [])

        for difficulty in ("easy", "normal", "hard"):
            moves = rank_tower_moves(computer_hand=hand, difficulty=difficulty)
            self.assertEqual(len(moves), 1)
            self.assertEqual(moves[0].effect_type, "tower_discard")
            self.assertEqual(moves[0].target_card_ids, ("peasant-1-1",))

    def test_tower_discard_easy_batch_two_rank_ones(self):
        hand = [
            {
                "card_id": "peasant-1-1",
                "suit": "peasant",
                "rank": 1,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "noble-1-1",
                "suit": "noble",
                "rank": 1,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        ]
        moves = rank_tower_moves(computer_hand=hand, difficulty="easy")
        self.assertEqual(len(moves), 1)
        self.assertEqual(len(moves[0].target_card_ids), 2)
        self.assertEqual(set(moves[0].target_card_ids), {"peasant-1-1", "noble-1-1"})

    def test_tower_discard_lone_royal_keeps_hand(self):
        lone_royal = {
            "card_id": "royal-1-1",
            "suit": "royal",
            "rank": 1,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        self.assertEqual(rank_tower_moves(computer_hand=[lone_royal], difficulty="easy"), [])
        self.assertEqual(rank_tower_moves(computer_hand=[lone_royal], difficulty="normal"), [])

    def test_tower_discard_hand_of_fours_and_fives_keeps_all(self):
        hand = [
            {
                "card_id": "peasant-4-1",
                "suit": "peasant",
                "rank": 4,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "royal-5-1",
                "suit": "royal",
                "rank": 5,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        ]
        for difficulty in ("easy", "normal", "hard"):
            self.assertEqual(rank_tower_moves(computer_hand=hand, difficulty=difficulty), [])

    def test_tower_discard_hard_conditional_rank_three(self):
        hand = [
            {
                "card_id": "peasant-3-1",
                "suit": "peasant",
                "rank": 3,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "peasant-5-1",
                "suit": "peasant",
                "rank": 5,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        ]
        moves = rank_tower_moves(computer_hand=hand, difficulty="hard")
        self.assertEqual(len(moves), 1)
        self.assertEqual(moves[0].target_card_ids, ("peasant-3-1",))

        solo_three = [hand[0]]
        self.assertEqual(rank_tower_moves(computer_hand=solo_three, difficulty="hard"), [])

    def test_tower_discard_hard_dumps_ones_and_twos(self):
        hand = [
            {
                "card_id": "peasant-1-1",
                "suit": "peasant",
                "rank": 1,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "peasant-2-1",
                "suit": "peasant",
                "rank": 2,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "noble-3-1",
                "suit": "noble",
                "rank": 3,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        ]
        moves = rank_tower_moves(computer_hand=hand, difficulty="hard")
        self.assertEqual(len(moves), 1)
        self.assertEqual(set(moves[0].target_card_ids), {"peasant-1-1", "peasant-2-1"})

    def test_easy_random_roll(self):
        hand = [
            {
                "card_id": f"peasant-{i}-1",
                "suit": "peasant",
                "rank": i,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            }
            for i in range(1, 4)
        ]
        placements = {
            z: {"1": None, "2": None}
            for z in ("gate", "farm", "road", "tower", "throne")
        }
        with patch("estates.computer.random.random", return_value=0.0):
            moves = rank_placement_moves(
                computer_hand=hand,
                placements=placements,
                computer_seat=2,
                opponent_seat=1,
                computer_score=0,
                opponent_score=0,
                victory_score=7,
                zone_personas={z: "throne_rush" for z in placements},
                difficulty="easy",
            )
        self.assertGreaterEqual(len(moves), 1)

    def test_easy_stores_zone_personas_json(self):
        game = self._solo_game(difficulty="easy")
        personas = normalize_zone_personas(game.computer_persona)
        self.assertEqual(len(personas), 5)

    def test_assign_round_zone_personas_by_difficulty(self):
        placements = {z: {"1": None, "2": None} for z in ("gate", "farm", "road", "tower", "throne")}
        easy_fixed = serialize_zone_personas(pick_random_zone_personas())
        easy_a = assign_round_zone_personas(
            difficulty="easy",
            stored_persona=easy_fixed,
            opponent_discard=[],
            placements=placements,
            opponent_seat=1,
        )
        easy_b = assign_round_zone_personas(
            difficulty="easy",
            stored_persona=easy_fixed,
            opponent_discard=[],
            placements=placements,
            opponent_seat=1,
        )
        self.assertEqual(easy_a, easy_b)

        normal_a = assign_round_zone_personas(
            difficulty="normal",
            stored_persona="",
            opponent_discard=[],
            placements=placements,
            opponent_seat=1,
        )
        normal_b = assign_round_zone_personas(
            difficulty="normal",
            stored_persona="",
            opponent_discard=[],
            placements=placements,
            opponent_seat=1,
        )
        self.assertEqual(set(normal_a.keys()), set(normal_b.keys()))

    def test_pool_hand_deck_matches_total_remaining(self):
        placements = {z: {"1": None, "2": None} for z in ("gate", "farm", "road", "tower", "throne")}
        pool = build_opponent_card_pool(
            opponent_discard=[],
            placements=placements,
            opponent_seat=1,
            opponent_hand_count=5,
            opponent_deck_count=25,
        )
        self.assertEqual(pool.total_remaining, 30)
        self.assertEqual(pool.opponent_pool_size, 30)

        discard = [
            {
                "card_id": "peasant-1-1",
                "suit": "peasant",
                "rank": 1,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            }
        ]
        placements["farm"] = self._placed(
            seat=1,
            card={
                "card_id": "peasant-3-1",
                "suit": "peasant",
                "rank": 3,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        )
        pool = build_opponent_card_pool(
            opponent_discard=discard,
            placements=placements,
            opponent_seat=1,
            opponent_hand_count=4,
            opponent_deck_count=24,
        )
        self.assertEqual(pool.total_remaining, 28)
        self.assertEqual(pool.opponent_pool_size, 28)
        self.assertEqual(pool.opponent_pool_size, pool.total_remaining)

    def test_upgraded_card_removes_base_deck_slot(self):
        placements = {z: {"1": None, "2": None} for z in ("gate", "farm", "road", "tower", "throne")}
        placements["farm"] = self._placed(
            seat=1,
            card={
                "card_id": "peasant-3-1",
                "suit": "peasant",
                "rank": 3,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 1,
            },
        )
        pool = build_opponent_card_pool(
            opponent_discard=[],
            placements=placements,
            opponent_seat=1,
            opponent_hand_count=4,
            opponent_deck_count=25,
        )
        self.assertEqual(pool.total_remaining, 29)

    def test_upgraded_spent_card_removes_base_deck_slot(self):
        placements = {z: {"1": None, "2": None} for z in ("gate", "farm", "road", "tower", "throne")}
        pool = build_opponent_card_pool(
            opponent_discard=[
                {
                    "card_id": "noble-4-2",
                    "suit": "noble",
                    "rank": 4,
                    "temporary_value_modifier": 0,
                    "permanent_value_bonus": 1,
                }
            ],
            placements=placements,
            opponent_seat=1,
            opponent_hand_count=5,
            opponent_deck_count=24,
        )
        self.assertEqual(pool.total_remaining, 29)
        self.assertEqual(pool.opponent_pool_size, 29)

    def test_opponent_pool_uses_only_opponent_deck_copy(self):
        placements = {z: {"1": None, "2": None} for z in ("gate", "farm", "road", "tower", "throne")}
        baseline = build_opponent_card_pool(
            opponent_discard=[],
            placements=placements,
            opponent_seat=1,
            opponent_hand_count=5,
            opponent_deck_count=25,
        )
        self.assertEqual(baseline.total_remaining, 30)
        computer_royal = {
            "card_id": "royal-5-cpu",
            "suit": "royal",
            "rank": 5,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        placements["throne"] = {"1": None, "2": computer_royal}
        with_computer_on_board = build_opponent_card_pool(
            opponent_discard=[],
            placements=placements,
            opponent_seat=1,
            opponent_hand_count=5,
            opponent_deck_count=25,
        )
        self.assertEqual(with_computer_on_board.total_remaining, 30)

    def test_hard_card_counting_low_throne_reply_after_royals_spent(self):
        placements = {z: {"1": None, "2": None} for z in ("gate", "farm", "road", "tower", "throne")}
        discard = [
            {
                "card_id": f"royal-{i}-{copy}",
                "suit": "royal",
                "rank": i,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            }
            for i in range(1, 6)
            for copy in (1, 2)
        ]
        pool = build_opponent_card_pool(
            opponent_discard=discard,
            placements=placements,
            opponent_seat=1,
            opponent_hand_count=5,
            opponent_deck_count=10,
        )
        throne_rank = _expected_rank_in_zone_from_pool(pool, zone="throne")
        self.assertLess(throne_rank, 2.5)
        prob_beat = _prob_opponent_beats_card_in_zone(
            pool,
            zone="throne",
            our_card={
                "card_id": "royal-5-1",
                "suit": "royal",
                "rank": 5,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            zone_payload={"1": None, "2": None},
            opponent_seat=1,
            computer_seat=2,
        )
        self.assertLess(prob_beat, 0.05)

    def test_hard_reply_penalty_lower_with_exhausted_suit(self):
        placements = {
            z: {"1": None, "2": None}
            for z in ("gate", "farm", "road", "tower", "throne")
        }
        spent = [
            {
                "card_id": f"peasant-{i}-1",
                "suit": "peasant",
                "rank": i,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            }
            for i in range(1, 6)
        ] * 2
        pool = build_opponent_card_pool(
            opponent_discard=spent,
            placements=placements,
            opponent_seat=1,
            opponent_hand_count=3,
            opponent_deck_count=5,
        )
        farm_rank = _expected_rank_in_zone_from_pool(pool, zone="farm")
        self.assertLess(farm_rank, 2.0)

    def test_hard_optimize_uses_spent_pile(self):
        placements = {z: {"1": None, "2": None} for z in ("gate", "farm", "road", "tower", "throne")}
        discard = [
            {
                "card_id": f"royal-{i}-1",
                "suit": "royal",
                "rank": i,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            }
            for i in range(1, 6)
        ] + [
            {
                "card_id": f"royal-{i}-2",
                "suit": "royal",
                "rank": i,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            }
            for i in range(1, 6)
        ]
        personas = optimize_zone_personas(
            opponent_discard=discard,
            placements=placements,
            opponent_seat=1,
        )
        self.assertEqual(len(personas), 5)

    def test_normal_beats_opponent_throne_over_empty_gate(self):
        royal_5 = {
            "card_id": "royal-5-1",
            "suit": "royal",
            "rank": 5,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        royal_4 = {
            "card_id": "royal-4-1",
            "suit": "royal",
            "rank": 4,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        placements = {
            "gate": {"1": None, "2": None},
            "farm": {"1": None, "2": None},
            "road": {"1": None, "2": None},
            "tower": {"1": None, "2": None},
            "throne": self._placed(seat=1, card=royal_4),
        }
        zone_personas = {z: "gate_slasher" for z in placements}
        moves = rank_placement_moves(
            computer_hand=[royal_5],
            placements=placements,
            computer_seat=2,
            opponent_seat=1,
            computer_score=0,
            opponent_score=0,
            victory_score=7,
            zone_personas=zone_personas,
            difficulty="normal",
        )
        self.assertGreaterEqual(len(moves), 1)
        self.assertEqual(moves[0].zone, "throne")
        self.assertEqual(moves[0].card_id, "royal-5-1")

    def test_easy_plays_strongest_card_first(self):
        hand = [
            {
                "card_id": "royal-1-1",
                "suit": "royal",
                "rank": 1,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "royal-3-1",
                "suit": "royal",
                "rank": 3,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "royal-5-1",
                "suit": "royal",
                "rank": 5,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        ]
        placements = {
            z: {"1": None, "2": None}
            for z in ("gate", "farm", "road", "tower", "throne")
        }
        zone_personas = {z: "throne_rush" for z in placements}
        with patch("estates.computer.random.random", return_value=1.0):
            moves = rank_placement_moves(
                computer_hand=hand,
                placements=placements,
                computer_seat=2,
                opponent_seat=1,
                computer_score=0,
                opponent_score=0,
                victory_score=7,
                zone_personas=zone_personas,
                difficulty="easy",
            )
        self.assertEqual(moves[0].card_id, "royal-5-1")

    def test_hard_holds_fives_until_late_round(self):
        """Empty throne: secure high royal; last play of round still uses the 5."""
        royal_3 = {
            "card_id": "royal-3-1",
            "suit": "royal",
            "rank": 3,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        royal_5 = {
            "card_id": "royal-5-1",
            "suit": "royal",
            "rank": 5,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        placements = {
            z: {"1": None, "2": None}
            for z in ("gate", "farm", "road", "tower", "throne")
        }
        zone_personas = {z: "throne_rush" for z in placements}
        moves = rank_placement_moves(
            computer_hand=[royal_3, royal_5],
            placements=placements,
            computer_seat=2,
            opponent_seat=1,
            computer_score=0,
            opponent_score=0,
            victory_score=7,
            zone_personas=zone_personas,
            difficulty="hard",
            opponent_hand_count=5,
            opponent_deck_count=25,
        )
        throne_moves = [m for m in moves if m.zone == "throne"]
        self.assertGreaterEqual(len(throne_moves), 2)
        self.assertEqual(throne_moves[0].card_id, "royal-5-1")

        placements["throne"] = self._placed(seat=2, card=royal_3)
        placements["farm"] = self._placed(seat=2, card=royal_3)
        moves_late = rank_placement_moves(
            computer_hand=[royal_5],
            placements=placements,
            computer_seat=2,
            opponent_seat=1,
            computer_score=0,
            opponent_score=0,
            victory_score=7,
            zone_personas=zone_personas,
            difficulty="hard",
        )
        self.assertEqual(moves_late[0].card_id, "royal-5-1")

    def test_hard_empty_throne_avoids_beatable_two(self):
        hand = [
            {
                "card_id": "royal-2-1",
                "suit": "royal",
                "rank": 2,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "royal-4-1",
                "suit": "royal",
                "rank": 4,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "royal-5-1",
                "suit": "royal",
                "rank": 5,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        ]
        placements = {
            z: {"1": None, "2": None}
            for z in ("gate", "farm", "road", "tower", "throne")
        }
        zone_personas = {z: "throne_rush" for z in placements}
        moves = rank_placement_moves(
            computer_hand=hand,
            placements=placements,
            computer_seat=2,
            opponent_seat=1,
            computer_score=0,
            opponent_score=0,
            victory_score=7,
            zone_personas=zone_personas,
            difficulty="hard",
            opponent_hand_count=5,
            opponent_deck_count=25,
        )
        throne_moves = [m for m in moves if m.zone == "throne"]
        self.assertGreaterEqual(len(throne_moves), 1)
        self.assertNotEqual(throne_moves[0].card_id, "royal-2-1")

    def test_hard_reacts_to_human_throne_with_min_beater(self):
        royal_4 = {
            "card_id": "royal-4-1",
            "suit": "royal",
            "rank": 4,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        royal_5 = {
            "card_id": "royal-5-1",
            "suit": "royal",
            "rank": 5,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        placements = {
            z: {"1": None, "2": None}
            for z in ("gate", "farm", "road", "tower", "throne")
        }
        placements["throne"] = self._placed(seat=1, card=royal_4)
        zone_personas = {z: "throne_rush" for z in placements}
        moves = rank_placement_moves(
            computer_hand=[royal_5],
            placements=placements,
            computer_seat=2,
            opponent_seat=1,
            computer_score=0,
            opponent_score=0,
            victory_score=7,
            zone_personas=zone_personas,
            difficulty="hard",
            opponent_hand_count=4,
            opponent_deck_count=25,
        )
        self.assertGreaterEqual(len(moves), 1)
        self.assertEqual(moves[0].zone, "throne")
        self.assertEqual(moves[0].card_id, "royal-5-1")

    def test_hard_starting_player_avoids_weak_throne_lead(self):
        royal_2 = {
            "card_id": "royal-2-1",
            "suit": "royal",
            "rank": 2,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        noble_3 = {
            "card_id": "noble-3-1",
            "suit": "noble",
            "rank": 3,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        noble_4 = {
            "card_id": "noble-4-1",
            "suit": "noble",
            "rank": 4,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        placements = {
            z: {"1": None, "2": None}
            for z in ("gate", "farm", "road", "tower", "throne")
        }
        zone_personas = {z: "throne_rush" for z in placements}
        moves = rank_placement_moves(
            computer_hand=[royal_2, noble_3, noble_4],
            placements=placements,
            computer_seat=2,
            opponent_seat=1,
            computer_score=0,
            opponent_score=0,
            victory_score=7,
            zone_personas=zone_personas,
            difficulty="hard",
            opponent_hand_count=5,
            opponent_deck_count=25,
            computer_is_starting_player=True,
        )
        self.assertGreaterEqual(len(moves), 1)
        top = moves[0]
        self.assertFalse(top.zone == "throne" and top.card_id == "royal-2-1")

    def test_easy_prefers_strongest_on_empty_throne(self):
        hand = [
            {
                "card_id": "royal-1-1",
                "suit": "royal",
                "rank": 1,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "royal-5-1",
                "suit": "royal",
                "rank": 5,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        ]
        placements = {
            z: {"1": None, "2": None}
            for z in ("gate", "farm", "road", "tower", "throne")
        }
        zone_personas = {z: "throne_rush" for z in placements}
        with patch("estates.computer.random.random", return_value=1.0):
            moves = rank_placement_moves(
                computer_hand=hand,
                placements=placements,
                computer_seat=2,
                opponent_seat=1,
                computer_score=0,
                opponent_score=0,
                victory_score=7,
                zone_personas=zone_personas,
                difficulty="easy",
            )
        throne_moves = [m for m in moves if m.zone == "throne"]
        self.assertGreaterEqual(len(throne_moves), 2)
        self.assertEqual(throne_moves[0].card_id, "royal-5-1")

    def test_normal_prefers_beat_by_two_when_gate_open(self):
        placements = {
            z: {"1": None, "2": None}
            for z in ("gate", "farm", "road", "tower", "throne")
        }
        placements["farm"] = self._placed(
            seat=1,
            card={
                "card_id": "peasant-3-1",
                "suit": "peasant",
                "rank": 3,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        )
        hand = [
            {
                "card_id": "peasant-4-1",
                "suit": "peasant",
                "rank": 4,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "peasant-5-1",
                "suit": "peasant",
                "rank": 5,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        ]
        zone_personas = {z: "farm_builder" for z in placements}
        moves = rank_placement_moves(
            computer_hand=hand,
            placements=placements,
            computer_seat=2,
            opponent_seat=1,
            computer_score=0,
            opponent_score=0,
            victory_score=7,
            zone_personas=zone_personas,
            difficulty="normal",
        )
        farm_moves = [m for m in moves if m.zone == "farm"]
        self.assertEqual(farm_moves[0].card_id, "peasant-5-1")

    def test_normal_prefers_beat_by_one_when_gate_locked(self):
        placements = {
            z: {"1": None, "2": None}
            for z in ("gate", "farm", "road", "tower", "throne")
        }
        placements["gate"] = self._placed(
            seat=2,
            card={
                "card_id": "peasant-2-1",
                "suit": "peasant",
                "rank": 2,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        )
        placements["farm"] = self._placed(
            seat=1,
            card={
                "card_id": "peasant-3-1",
                "suit": "peasant",
                "rank": 3,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        )
        hand = [
            {
                "card_id": "peasant-4-1",
                "suit": "peasant",
                "rank": 4,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "peasant-5-1",
                "suit": "peasant",
                "rank": 5,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        ]
        zone_personas = {z: "farm_builder" for z in placements}
        moves = rank_placement_moves(
            computer_hand=hand,
            placements=placements,
            computer_seat=2,
            opponent_seat=1,
            computer_score=0,
            opponent_score=0,
            victory_score=7,
            zone_personas=zone_personas,
            difficulty="normal",
        )
        farm_moves = [m for m in moves if m.zone == "farm"]
        self.assertEqual(farm_moves[0].card_id, "peasant-4-1")

    def test_normal_plays_minimum_card_when_beat_by_one_is_enough(self):
        """With Gate locked, a 3 beats a 2 without needing a 5."""
        placements = {
            z: {"1": None, "2": None}
            for z in ("gate", "farm", "road", "tower", "throne")
        }
        placements["gate"] = self._placed(
            seat=2,
            card={
                "card_id": "peasant-1-1",
                "suit": "peasant",
                "rank": 1,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        )
        placements["farm"] = self._placed(
            seat=1,
            card={
                "card_id": "peasant-2-1",
                "suit": "peasant",
                "rank": 2,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        )
        hand = [
            {
                "card_id": "peasant-3-1",
                "suit": "peasant",
                "rank": 3,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "peasant-5-1",
                "suit": "peasant",
                "rank": 5,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        ]
        zone_personas = {z: "farm_builder" for z in placements}
        moves = rank_placement_moves(
            computer_hand=hand,
            placements=placements,
            computer_seat=2,
            opponent_seat=1,
            computer_score=0,
            opponent_score=0,
            victory_score=7,
            zone_personas=zone_personas,
            difficulty="normal",
        )
        farm_moves = [m for m in moves if m.zone == "farm"]
        self.assertEqual(farm_moves[0].card_id, "peasant-3-1")

    def test_tower_discard_normal_dumps_rank_two_not_five(self):
        hand = [
            {
                "card_id": "peasant-2-1",
                "suit": "peasant",
                "rank": 2,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "royal-5-1",
                "suit": "royal",
                "rank": 5,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        ]
        moves = rank_tower_moves(computer_hand=hand, difficulty="normal")
        self.assertEqual(len(moves), 1)
        self.assertEqual(moves[0].target_card_ids, ("peasant-2-1",))

    def test_gate_placement_scores_throne_debuff_over_empty_farm(self):
        """Winning gate is valued by the best debuff tier on another zone, not as its own zone."""
        royal_5 = {
            "card_id": "royal-5-1",
            "suit": "royal",
            "rank": 5,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        royal_4 = {
            "card_id": "royal-4-1",
            "suit": "royal",
            "rank": 4,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        peasant_3 = {
            "card_id": "peasant-3-1",
            "suit": "peasant",
            "rank": 3,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        placements = {
            "gate": {"1": None, "2": None},
            "farm": {"1": None, "2": None},
            "road": self._placed(seat=1, card=peasant_3),
            "tower": {"1": None, "2": None},
            "throne": self._placed(seat=1, card=royal_4),
        }
        # Computer has 5 royal: throne beats 4; gate debuff on road is low tier.
        zone_personas = {z: "gate_slasher" for z in ("gate", "farm", "road", "tower", "throne")}
        moves = rank_placement_moves(
            computer_hand=[royal_5],
            placements=placements,
            computer_seat=2,
            opponent_seat=1,
            computer_score=0,
            opponent_score=0,
            victory_score=7,
            zone_personas=zone_personas,
            difficulty="normal",
        )
        self.assertEqual(moves[0].zone, "throne")

    def test_hard_still_prioritizes_throne_over_gate_for_five(self):
        """Zone priority beats slow-roll: a 5 still takes throne over an empty gate."""
        royal_5 = {
            "card_id": "royal-5-1",
            "suit": "royal",
            "rank": 5,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        royal_4 = {
            "card_id": "royal-4-1",
            "suit": "royal",
            "rank": 4,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        placements = {
            "gate": {"1": None, "2": None},
            "farm": {"1": None, "2": None},
            "road": {"1": None, "2": None},
            "tower": {"1": None, "2": None},
            "throne": self._placed(seat=1, card=royal_4),
        }
        zone_personas = {z: "gate_slasher" for z in placements}
        moves = rank_placement_moves(
            computer_hand=[royal_5],
            placements=placements,
            computer_seat=2,
            opponent_seat=1,
            computer_score=0,
            opponent_score=0,
            victory_score=7,
            zone_personas=zone_personas,
            difficulty="hard",
        )
        self.assertEqual(moves[0].zone, "throne")

    def test_empty_zone_prefers_lower_card(self):
        hand = [
            {
                "card_id": "peasant-1-1",
                "suit": "peasant",
                "rank": 1,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
            {
                "card_id": "peasant-5-1",
                "suit": "peasant",
                "rank": 5,
                "temporary_value_modifier": 0,
                "permanent_value_bonus": 0,
            },
        ]
        placements = {
            z: {"1": None, "2": None}
            for z in ("gate", "farm", "road", "tower", "throne")
        }
        zone_personas = {z: "farm_builder" for z in placements}
        moves = rank_placement_moves(
            computer_hand=hand,
            placements=placements,
            computer_seat=2,
            opponent_seat=1,
            computer_score=0,
            opponent_score=0,
            victory_score=7,
            zone_personas=zone_personas,
            difficulty="normal",
        )
        farm_moves = [m for m in moves if m.zone == "farm"]
        self.assertGreaterEqual(len(farm_moves), 2)
        self.assertEqual(farm_moves[0].card_id, "peasant-1-1")
