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
    rank_computer_moves,
    rank_gate_moves,
    rank_placement_moves,
    rank_tower_moves,
)
from estates.constants import COMPUTER_SEAT_INDEX, HUMAN_SEAT_INDEX
from estates.models import EstatesGame, EstatesPlayerState, EstatesRoundState
from estates.presence import adjust_presence_connection
from estates.views import _try_run_computer_step

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
        self.assertIn(game.computer_persona, ("throne_rush", "farm_builder", "road_runner", "gate_slasher"))
        self.assertEqual(game.status, EstatesGame.Status.ACTIVE)
        self.assertEqual(EstatesPlayerState.objects.filter(game=game).count(), 2)

    def test_opponent_hand_hidden_in_api(self):
        game = self._solo_game()
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
        moves = rank_placement_moves(
            computer_hand=hand,
            placements=placements,
            computer_seat=2,
            opponent_seat=1,
            computer_score=0,
            opponent_score=0,
            victory_score=7,
            persona="throne_rush",
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
        self.assertEqual(moves[0].target_card_id, "noble-2-1")

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
        self.assertEqual(moves[0].target_card_id, "peasant-1-1")

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
            self.assertEqual(len(moves), 2)
            self.assertEqual(moves[0].effect_type, "tower_discard")
            self.assertEqual(moves[0].target_card_id, "peasant-1-1")

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
                persona="throne_rush",
                difficulty="easy",
            )
        self.assertGreaterEqual(len(moves), 1)
