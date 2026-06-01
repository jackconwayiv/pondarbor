from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from estates.constants import MAX_LOBBY_AGE_HOURS
from estates.models import EstatesGame, EstatesPlayerState, EstatesRoundState, EstatesUserStats
from estates.presence import adjust_presence_connection
from estates.game_setup import SCORING_STEPS_IN_ORDER, is_suit_allowed_in_zone, normalize_card_suit, normalize_suit_value
from estates.views import _progress_scoring_if_ready, _zone_no_winner_status_message, _zone_winner_payload
from users.models import Profile

User = get_user_model()


class EstatesLobbyApiTests(TestCase):
    def setUp(self):
        self.host = User.objects.create_user(email="host@example.com", password="secret12345")
        self.guest = User.objects.create_user(email="guest@example.com", password="secret12345")
        self.pending = User.objects.create_user(email="pending@example.com", password="secret12345")
        for user in (self.host, self.guest):
            user.account_status = User.AccountStatus.APPROVED
            user.save(update_fields=["account_status"])
        Profile.objects.update_or_create(user=self.host, defaults={"display_name": "Host", "avatar_url": ""})
        Profile.objects.update_or_create(user=self.guest, defaults={"display_name": "Guest", "avatar_url": ""})
        Profile.objects.update_or_create(user=self.pending, defaults={"display_name": "Pending", "avatar_url": ""})

        self.host_client = APIClient()
        self.host_client.force_login(self.host)
        self.guest_client = APIClient()
        self.guest_client.force_login(self.guest)
        self.pending_client = APIClient()
        self.pending_client.force_login(self.pending)
        self.anon_client = APIClient()

    def _both_players_open_play(self, game_id) -> None:
        """Active games start paused until both seats connect on the play view."""
        gid = str(game_id)
        adjust_presence_connection(game_id=gid, seat_index=1, delta=1)
        adjust_presence_connection(game_id=gid, seat_index=2, delta=1)

    def test_create_lobby_requires_authenticated_approved_user(self):
        anon_resp = self.anon_client.post("/api/v1/estates/lobbies/", {}, format="json")
        self.assertEqual(anon_resp.status_code, 403)

        pending_resp = self.pending_client.post("/api/v1/estates/lobbies/", {}, format="json")
        self.assertEqual(pending_resp.status_code, 403)

    def test_create_lobby_initializes_game_state_rows(self):
        resp = self.host_client.post("/api/v1/estates/lobbies/", {}, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        payload = resp.json()

        self.assertEqual(payload["status"], EstatesGame.Status.LOBBY)
        self.assertEqual(payload["player_1_id"], self.host.id)
        self.assertIsNone(payload["player_2_id"])
        self.assertEqual(payload["player_1"]["display_name"], "Host")
        self.assertEqual(len(payload["players"]), 1)
        self.assertEqual(payload["players"][0]["user_id"], self.host.id)
        self.assertEqual(payload["round_state"]["phase"], EstatesRoundState.Phase.LOBBY)
        self.assertEqual(payload["round_state"]["actions_taken_by_seat"], {"1": 0, "2": 0})

        game = EstatesGame.objects.get(pk=payload["id"])
        self.assertEqual(game.player_1_id, self.host.id)
        self.assertIsNone(game.player_2_id)
        self.assertEqual(EstatesPlayerState.objects.filter(game=game).count(), 1)
        self.assertTrue(EstatesRoundState.objects.filter(game=game).exists())

    def test_list_open_lobbies_excludes_own_full_and_stale(self):
        own_game = EstatesGame.objects.create(player_1=self.host, status=EstatesGame.Status.LOBBY)
        EstatesPlayerState.objects.create(game=own_game, user=self.host, seat_index=1)
        EstatesRoundState.objects.create(game=own_game)

        open_game = EstatesGame.objects.create(player_1=self.guest, status=EstatesGame.Status.LOBBY)
        EstatesPlayerState.objects.create(game=open_game, user=self.guest, seat_index=1)
        EstatesRoundState.objects.create(game=open_game)

        full_game = EstatesGame.objects.create(
            player_1=self.guest,
            player_2=self.host,
            status=EstatesGame.Status.LOBBY,
        )
        EstatesPlayerState.objects.create(game=full_game, user=self.guest, seat_index=1)
        EstatesPlayerState.objects.create(game=full_game, user=self.host, seat_index=2)
        EstatesRoundState.objects.create(game=full_game)

        stale_game = EstatesGame.objects.create(player_1=self.guest, status=EstatesGame.Status.LOBBY)
        EstatesPlayerState.objects.create(game=stale_game, user=self.guest, seat_index=1)
        EstatesRoundState.objects.create(game=stale_game)
        stale_created = timezone.now() - timedelta(hours=MAX_LOBBY_AGE_HOURS + 1)
        EstatesGame.objects.filter(pk=stale_game.pk).update(created_at=stale_created, updated_at=stale_created)

        resp = self.host_client.get("/api/v1/estates/lobbies/")
        self.assertEqual(resp.status_code, 200, resp.content)
        rows = resp.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["id"], str(open_game.id))

        self.assertFalse(EstatesGame.objects.filter(pk=stale_game.pk).exists())

    def test_join_lobby_assigns_second_player(self):
        game = EstatesGame.objects.create(player_1=self.host, status=EstatesGame.Status.LOBBY)
        EstatesPlayerState.objects.create(game=game, user=self.host, seat_index=1)
        EstatesRoundState.objects.create(game=game)

        resp = self.guest_client.post(f"/api/v1/estates/lobbies/{game.id}/join/", {}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        body = resp.json()
        self.assertEqual(body["player_2_id"], self.guest.id)
        self.assertEqual(len(body["players"]), 2)

        game.refresh_from_db()
        self.assertEqual(game.player_2_id, self.guest.id)
        self.assertTrue(EstatesPlayerState.objects.filter(game=game, user=self.guest, seat_index=2).exists())

    def test_join_lobby_rejects_owner_and_full_lobby(self):
        game = EstatesGame.objects.create(player_1=self.host, status=EstatesGame.Status.LOBBY)
        EstatesPlayerState.objects.create(game=game, user=self.host, seat_index=1)
        EstatesRoundState.objects.create(game=game)

        owner_join_resp = self.host_client.post(f"/api/v1/estates/lobbies/{game.id}/join/", {}, format="json")
        self.assertEqual(owner_join_resp.status_code, 400)

        game.player_2 = self.guest
        game.save(update_fields=["player_2", "updated_at"])
        EstatesPlayerState.objects.create(game=game, user=self.guest, seat_index=2)

        third_user = User.objects.create_user(email="third@example.com", password="secret12345")
        third_user.account_status = User.AccountStatus.APPROVED
        third_user.save(update_fields=["account_status"])
        third_client = APIClient()
        third_client.force_login(third_user)

        full_resp = third_client.post(f"/api/v1/estates/lobbies/{game.id}/join/", {}, format="json")
        self.assertEqual(full_resp.status_code, 400)

    def test_confirm_requires_lobby_player(self):
        game = EstatesGame.objects.create(player_1=self.host, status=EstatesGame.Status.LOBBY)
        EstatesPlayerState.objects.create(game=game, user=self.host, seat_index=1)
        EstatesRoundState.objects.create(game=game)

        outsider = User.objects.create_user(email="outsider@example.com", password="secret12345")
        outsider.account_status = User.AccountStatus.APPROVED
        outsider.save(update_fields=["account_status"])
        outsider_client = APIClient()
        outsider_client.force_login(outsider)

        resp = outsider_client.post(f"/api/v1/estates/lobbies/{game.id}/confirm/", {}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_confirm_requires_two_players(self):
        game = EstatesGame.objects.create(player_1=self.host, status=EstatesGame.Status.LOBBY)
        EstatesPlayerState.objects.create(game=game, user=self.host, seat_index=1)
        EstatesRoundState.objects.create(game=game)

        resp = self.host_client.post(f"/api/v1/estates/lobbies/{game.id}/confirm/", {}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_owner_confirm_starts_game_and_deals_opening_hands(self):
        create_resp = self.host_client.post("/api/v1/estates/lobbies/", {}, format="json")
        game_id = create_resp.json()["id"]
        join_resp = self.guest_client.post(f"/api/v1/estates/lobbies/{game_id}/join/", {}, format="json")
        self.assertEqual(join_resp.status_code, 200, join_resp.content)

        with patch("estates.views.random.choice", return_value=2):
            confirm_resp = self.host_client.post(f"/api/v1/estates/lobbies/{game_id}/confirm/", {}, format="json")
        self.assertEqual(confirm_resp.status_code, 200, confirm_resp.content)
        body = confirm_resp.json()
        self.assertEqual(body["status"], EstatesGame.Status.ACTIVE)
        self.assertEqual(body["round"], 1)
        self.assertIsNotNone(body["started_at"])
        self.assertEqual(body["round_state"]["phase"], EstatesRoundState.Phase.PLACEMENT)
        self.assertEqual(body["round_state"]["turn_player_seat"], 2)
        self.assertEqual(body["round_state"]["pending_actor_seat"], 2)
        self.assertEqual(body["round_state"]["pending_action"], "play_card")
        self.assertIn("Waiting for", body["round_state"]["status_message"])

        self.assertEqual(len(body["players"]), 2)
        by_seat = {row["seat_index"]: row for row in body["players"]}
        self.assertEqual(len(by_seat[1]["hand"]), 5)
        self.assertEqual(len(by_seat[1]["deck"]), 25)
        self.assertEqual(by_seat[1]["hand_count"], 5)
        self.assertEqual(by_seat[1]["deck_count"], 25)
        self.assertEqual(by_seat[2]["hand"], [])
        self.assertEqual(by_seat[2]["deck"], [])
        self.assertEqual(by_seat[2]["hand_count"], 5)
        self.assertEqual(by_seat[2]["deck_count"], 25)
        self.assertEqual(by_seat[1]["draw_bonus"], 0)
        self.assertEqual(by_seat[2]["draw_bonus"], 0)
        self.assertFalse(by_seat[1]["is_starting_player"])
        self.assertTrue(by_seat[2]["is_starting_player"])

        seat_1_ids = {card["card_id"] for card in by_seat[1]["hand"] + by_seat[1]["deck"]}
        self.assertEqual(len(seat_1_ids), 30)

        for card in by_seat[1]["hand"] + by_seat[1]["deck"]:
            self.assertEqual(card["temporary_value_modifier"], 0)

    def test_non_owner_cannot_start_lobby(self):
        create_resp = self.host_client.post("/api/v1/estates/lobbies/", {}, format="json")
        game_id = create_resp.json()["id"]
        self.guest_client.post(f"/api/v1/estates/lobbies/{game_id}/join/", {}, format="json")
        resp = self.guest_client.post(f"/api/v1/estates/lobbies/{game_id}/confirm/", {}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_games_mine_returns_204_when_no_game(self):
        resp = self.host_client.get("/api/v1/estates/games/mine/")
        self.assertEqual(resp.status_code, 204)

    def test_games_mine_returns_latest_game_for_player(self):
        game_one = EstatesGame.objects.create(player_1=self.host, status=EstatesGame.Status.LOBBY)
        EstatesPlayerState.objects.create(game=game_one, user=self.host, seat_index=1)
        EstatesRoundState.objects.create(game=game_one)

        game_two = EstatesGame.objects.create(player_1=self.host, status=EstatesGame.Status.LOBBY)
        EstatesPlayerState.objects.create(game=game_two, user=self.host, seat_index=1)
        EstatesRoundState.objects.create(game=game_two)

        resp = self.host_client.get("/api/v1/estates/games/mine/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()["id"], str(game_two.id))

    def test_list_my_games_groups_by_status(self):
        completed = EstatesGame.objects.create(
            player_1=self.host,
            player_2=self.guest,
            status=EstatesGame.Status.COMPLETED,
            winner_user=self.guest,
            round=3,
        )
        EstatesPlayerState.objects.create(game=completed, user=self.host, seat_index=1, score=4)
        EstatesPlayerState.objects.create(game=completed, user=self.guest, seat_index=2, score=7)
        EstatesRoundState.objects.create(game=completed)

        active = EstatesGame.objects.create(
            player_1=self.host,
            player_2=self.guest,
            status=EstatesGame.Status.ACTIVE,
            round=2,
        )
        EstatesPlayerState.objects.create(game=active, user=self.host, seat_index=1, score=2)
        EstatesPlayerState.objects.create(game=active, user=self.guest, seat_index=2, score=1)
        EstatesRoundState.objects.create(game=active)

        lobby = EstatesGame.objects.create(player_1=self.host, status=EstatesGame.Status.LOBBY)
        EstatesPlayerState.objects.create(game=lobby, user=self.host, seat_index=1)
        EstatesRoundState.objects.create(game=lobby)

        resp = self.host_client.get("/api/v1/estates/games/mine/list/")
        self.assertEqual(resp.status_code, 200, resp.content)
        body = resp.json()
        self.assertEqual(len(body["open_lobby"]), 1)
        self.assertEqual(body["open_lobby"][0]["id"], str(lobby.id))
        self.assertTrue(body["open_lobby"][0]["is_owner"])
        self.assertEqual(len(body["in_progress"]), 1)
        self.assertEqual(body["in_progress"][0]["id"], str(active.id))
        self.assertEqual(body["in_progress"][0]["round"], 2)
        self.assertEqual(len(body["completed"]), 1)
        self.assertEqual(body["completed"][0]["id"], str(completed.id))
        self.assertEqual(body["completed"][0]["winner_display_name"], "Guest")
        self.assertEqual(body["completed"][0]["my_score"], 4)
        self.assertEqual(body["completed"][0]["opponent_score"], 7)

    @patch("estates.views.random.choice", return_value=1)
    def test_games_mine_tolerates_invalid_scoring_payload(self, _mock_choice):
        create_resp = self.host_client.post("/api/v1/estates/lobbies/", {}, format="json")
        game_id = create_resp.json()["id"]
        self.guest_client.post(f"/api/v1/estates/lobbies/{game_id}/join/", {}, format="json")
        self.host_client.post(f"/api/v1/estates/lobbies/{game_id}/confirm/", {}, format="json")
        self._both_players_open_play(game_id)

        game = EstatesGame.objects.get(pk=game_id)
        round_state = EstatesRoundState.objects.get(game=game)
        round_state.phase = EstatesRoundState.Phase.SCORING
        round_state.pending_payload = {
            "zone_winners": {},
            "scoring": {
                "zone_index": "bad",
                "waiting_until_ms": "not-a-number",
                "awaiting_choice": None,
            },
        }
        round_state.save(update_fields=["phase", "pending_payload", "updated_at"])

        resp = self.host_client.get("/api/v1/estates/games/mine/")
        self.assertEqual(resp.status_code, 200, resp.content)

    def test_lobby_owner_can_update_victory_score(self):
        game = EstatesGame.objects.create(player_1=self.host, status=EstatesGame.Status.LOBBY, victory_score=7)
        EstatesPlayerState.objects.create(game=game, user=self.host, seat_index=1)
        EstatesRoundState.objects.create(game=game)

        resp = self.host_client.patch(
            f"/api/v1/estates/lobbies/{game.id}/",
            {"victory_score": 11},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()["victory_score"], 11)
        game.refresh_from_db()
        self.assertEqual(game.victory_score, 11)

    def test_non_owner_cannot_update_lobby_victory_score(self):
        game = EstatesGame.objects.create(player_1=self.host, player_2=self.guest, status=EstatesGame.Status.LOBBY)
        EstatesPlayerState.objects.create(game=game, user=self.host, seat_index=1)
        EstatesPlayerState.objects.create(game=game, user=self.guest, seat_index=2)
        EstatesRoundState.objects.create(game=game)

        resp = self.guest_client.patch(
            f"/api/v1/estates/lobbies/{game.id}/",
            {"victory_score": 9},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_owner_can_cancel_lobby_before_second_player_joins(self):
        game = EstatesGame.objects.create(player_1=self.host, status=EstatesGame.Status.LOBBY)
        EstatesPlayerState.objects.create(game=game, user=self.host, seat_index=1)
        EstatesRoundState.objects.create(game=game)

        resp = self.host_client.delete(f"/api/v1/estates/lobbies/{game.id}/")
        self.assertEqual(resp.status_code, 204, resp.content)
        self.assertFalse(EstatesGame.objects.filter(pk=game.pk).exists())

    def test_owner_cannot_cancel_lobby_once_second_player_joined(self):
        game = EstatesGame.objects.create(player_1=self.host, player_2=self.guest, status=EstatesGame.Status.LOBBY)
        EstatesPlayerState.objects.create(game=game, user=self.host, seat_index=1)
        EstatesPlayerState.objects.create(game=game, user=self.guest, seat_index=2)
        EstatesRoundState.objects.create(game=game)

        resp = self.host_client.delete(f"/api/v1/estates/lobbies/{game.id}/")
        self.assertEqual(resp.status_code, 400)

    def test_joined_non_owner_can_leave_lobby(self):
        game = EstatesGame.objects.create(player_1=self.host, player_2=self.guest, status=EstatesGame.Status.LOBBY)
        EstatesPlayerState.objects.create(game=game, user=self.host, seat_index=1)
        EstatesPlayerState.objects.create(game=game, user=self.guest, seat_index=2)
        EstatesRoundState.objects.create(
            game=game,
            pending_action="confirm_lobby",
            pending_payload={"confirmations": {"1": True, "2": True}},
        )

        resp = self.guest_client.post(f"/api/v1/estates/lobbies/{game.id}/leave/", {}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        payload = resp.json()
        self.assertIsNone(payload["player_2_id"])
        self.assertEqual(payload["round_state"]["pending_payload"]["confirmations"], {"1": False, "2": False})
        self.assertEqual(payload["round_state"]["status_message"], "Waiting for an opponent to join the lobby.")
        game.refresh_from_db()
        self.assertIsNone(game.player_2_id)
        self.assertFalse(
            EstatesPlayerState.objects.filter(game=game, user=self.guest, seat_index=2).exists()
        )

    def test_owner_cannot_leave_own_lobby(self):
        game = EstatesGame.objects.create(player_1=self.host, status=EstatesGame.Status.LOBBY)
        EstatesPlayerState.objects.create(game=game, user=self.host, seat_index=1)
        EstatesRoundState.objects.create(game=game)

        resp = self.host_client.post(f"/api/v1/estates/lobbies/{game.id}/leave/", {}, format="json")
        self.assertEqual(resp.status_code, 403)

    @patch("estates.views.random.choice", return_value=1)
    def test_active_game_place_confirm_and_turn_pass(self, _mock_choice):
        create_resp = self.host_client.post("/api/v1/estates/lobbies/", {}, format="json")
        game_id = create_resp.json()["id"]
        self.guest_client.post(f"/api/v1/estates/lobbies/{game_id}/join/", {}, format="json")
        self.host_client.post(f"/api/v1/estates/lobbies/{game_id}/confirm/", {}, format="json")
        self._both_players_open_play(game_id)

        game = EstatesGame.objects.get(pk=game_id)
        host_state = EstatesPlayerState.objects.get(game=game, seat_index=1)
        first_card = host_state.hand[0]["card_id"]

        host_state.refresh_from_db()
        hand_size_before = len(host_state.hand)
        place_resp = self.host_client.post(
            f"/api/v1/estates/games/{game_id}/actions/place-card/",
            {"card_id": first_card, "zone": "gate"},
            format="json",
        )
        self.assertEqual(place_resp.status_code, 200, place_resp.content)
        body = place_resp.json()
        self.assertEqual(body["round_state"]["pending_action"], "play_card")
        self.assertEqual(body["round_state"]["actions_taken_by_seat"]["1"], 1)
        self.assertEqual(body["round_state"]["pending_actor_seat"], 2)
        gate_placement = body["round_state"]["placements_by_zone"]["gate"]["1"]
        self.assertTrue(gate_placement["confirmed"])
        host_state.refresh_from_db()
        self.assertEqual(len(host_state.hand), hand_size_before - 1)

    @patch("estates.views.random.choice", return_value=1)
    def test_invalid_zone_rejected(self, _mock_choice):
        create_resp = self.host_client.post("/api/v1/estates/lobbies/", {}, format="json")
        game_id = create_resp.json()["id"]
        self.guest_client.post(f"/api/v1/estates/lobbies/{game_id}/join/", {}, format="json")
        self.host_client.post(f"/api/v1/estates/lobbies/{game_id}/confirm/", {}, format="json")
        self._both_players_open_play(game_id)

        game = EstatesGame.objects.get(pk=game_id)
        host_state = EstatesPlayerState.objects.get(game=game, seat_index=1)
        non_peasant = next(
            (card for card in host_state.hand if str(card.get("suit") or "") != "peasant"),
            None,
        )
        self.assertIsNotNone(non_peasant, "opening hand should include a non-peasant card")

        bad_zone_resp = self.host_client.post(
            f"/api/v1/estates/games/{game_id}/actions/place-card/",
            {"card_id": non_peasant["card_id"], "zone": "farm"},
            format="json",
        )
        self.assertEqual(bad_zone_resp.status_code, 400)

    @patch("estates.views.random.choice", return_value=1)
    def test_active_game_concede_records_concession_outcome(self, _mock_choice):
        create_resp = self.host_client.post("/api/v1/estates/lobbies/", {}, format="json")
        game_id = create_resp.json()["id"]
        self.guest_client.post(f"/api/v1/estates/lobbies/{game_id}/join/", {}, format="json")
        self.host_client.post(f"/api/v1/estates/lobbies/{game_id}/confirm/", {}, format="json")

        concede_resp = self.host_client.post(
            f"/api/v1/estates/games/{game_id}/actions/concede/",
            {},
            format="json",
        )
        self.assertEqual(concede_resp.status_code, 200, concede_resp.content)
        body = concede_resp.json()
        self.assertEqual(body["status"], EstatesGame.Status.COMPLETED)
        self.assertEqual(body["completion_outcome"], EstatesGame.CompletionOutcome.CONCESSION)
        self.assertEqual(body["conceded_by_user_id"], self.host.id)
        self.assertEqual(body["winner_user_id"], self.guest.id)

        game = EstatesGame.objects.get(pk=game_id)
        self.assertEqual(game.completion_outcome, EstatesGame.CompletionOutcome.CONCESSION)
        self.assertEqual(game.conceded_by_id, self.host.id)
        self.assertEqual(game.winner_user_id, self.guest.id)

    def test_scoring_steps_are_one_zone_each(self):
        self.assertEqual(len(SCORING_STEPS_IN_ORDER), 5)
        self.assertEqual(SCORING_STEPS_IN_ORDER[1], ("throne",))
        self.assertEqual(SCORING_STEPS_IN_ORDER[-1], ("tower",))

    def test_empty_gate_scoring_advances_without_message(self):
        game = EstatesGame.objects.create(
            player_1=self.host,
            player_2=self.guest,
            status=EstatesGame.Status.ACTIVE,
            round=1,
            victory_score=7,
        )
        EstatesPlayerState.objects.create(
            game=game, user=self.host, seat_index=1, deck=[], hand=[], discard=[]
        )
        EstatesPlayerState.objects.create(
            game=game, user=self.guest, seat_index=2, deck=[], hand=[], discard=[]
        )
        placements = {
            zone: {"1": None, "2": None}
            for zone in ("gate", "farm", "road", "tower", "throne")
        }
        round_state = EstatesRoundState.objects.create(
            game=game,
            phase=EstatesRoundState.Phase.SCORING,
            placements_by_zone=placements,
            status_message="Round complete.",
            pending_payload={
                "scoring": {
                    "zone_index": 0,
                    "waiting_until_ms": 0,
                    "awaiting_choice": None,
                },
            },
        )
        progressed = _progress_scoring_if_ready(locked=game, round_state=round_state)
        self.assertTrue(progressed)
        round_state.refresh_from_db()
        scoring = round_state.pending_payload["scoring"]
        self.assertEqual(scoring["zone_index"], 1)
        self.assertNotIn("Gate", round_state.status_message)

    def test_road_winner_grants_draw_bonus(self):
        game = EstatesGame.objects.create(
            player_1=self.host,
            player_2=self.guest,
            status=EstatesGame.Status.ACTIVE,
            round=1,
            victory_score=7,
        )
        host_state = EstatesPlayerState.objects.create(
            game=game, user=self.host, seat_index=1, deck=[], hand=[], discard=[], draw_bonus=0
        )
        EstatesPlayerState.objects.create(
            game=game, user=self.guest, seat_index=2, deck=[], hand=[], discard=[], draw_bonus=0
        )
        road_card = {
            "card_id": "noble-3-1",
            "suit": "noble",
            "color": "blue",
            "rank": 3,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        placements = {
            zone: {"1": None, "2": None}
            for zone in ("gate", "farm", "road", "tower", "throne")
        }
        placements["road"] = {"1": {"card": road_card, "confirmed": True}, "2": None}
        round_state = EstatesRoundState.objects.create(
            game=game,
            phase=EstatesRoundState.Phase.SCORING,
            placements_by_zone=placements,
            pending_payload={
                "scoring": {
                    "zone_index": 3,
                    "waiting_until_ms": 0,
                    "awaiting_choice": None,
                    "zone_wins_recorded": ["gate", "throne", "farm"],
                },
            },
        )
        progressed = _progress_scoring_if_ready(locked=game, round_state=round_state)
        self.assertTrue(progressed)
        host_state.refresh_from_db()
        round_state.refresh_from_db()
        self.assertEqual(host_state.draw_bonus, 2)
        self.assertIn("Road", round_state.status_message)
        self.assertIn("2 extra cards", round_state.status_message)

    def test_tower_winner_prompts_discard_choice(self):
        game = EstatesGame.objects.create(
            player_1=self.host,
            player_2=self.guest,
            status=EstatesGame.Status.ACTIVE,
            round=1,
            victory_score=7,
        )
        host_state = EstatesPlayerState.objects.create(
            game=game,
            user=self.host,
            seat_index=1,
            deck=[],
            hand=[],
            discard=[],
            draw_bonus=0,
            score=0,
        )
        guest_state = EstatesPlayerState.objects.create(
            game=game,
            user=self.guest,
            seat_index=2,
            deck=[],
            hand=[],
            discard=[],
            draw_bonus=0,
            score=0,
        )
        tower_card = {
            "card_id": "royal-4-1",
            "suit": "royal",
            "color": "orange",
            "rank": 4,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        throne_card = {
            "card_id": "royal-5-1",
            "suit": "royal",
            "color": "orange",
            "rank": 5,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        placements = {
            zone: {"1": None, "2": None}
            for zone in ("gate", "farm", "road", "tower", "throne")
        }
        placements["tower"] = {"1": {"card": tower_card, "confirmed": True}, "2": None}
        placements["throne"] = {"1": None, "2": {"card": throne_card, "confirmed": True}}
        round_state = EstatesRoundState.objects.create(
            game=game,
            phase=EstatesRoundState.Phase.SCORING,
            placements_by_zone=placements,
            pending_payload={
                "scoring": {
                    "zone_index": 4,
                    "waiting_until_ms": 0,
                    "awaiting_choice": None,
                    "zone_wins_recorded": ["gate", "throne", "farm", "road"],
                },
            },
        )

        progressed = _progress_scoring_if_ready(locked=game, round_state=round_state)
        self.assertTrue(progressed)

        round_state.refresh_from_db()
        host_state.refresh_from_db()
        scoring = round_state.pending_payload["scoring"]

        self.assertEqual(scoring["zone_index"], 4)
        self.assertEqual(scoring["awaiting_choice"]["type"], "tower_discard")
        self.assertEqual(host_state.draw_bonus, 0)
        self.assertIn("discard", round_state.status_message.lower())

    def test_tower_discard_choice_applies(self):
        game = EstatesGame.objects.create(
            player_1=self.host,
            player_2=self.guest,
            status=EstatesGame.Status.ACTIVE,
            round=1,
            victory_score=7,
        )
        low_card = {
            "card_id": "peasant-1-1",
            "suit": "peasant",
            "rank": 1,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        high_card = {
            "card_id": "peasant-5-1",
            "suit": "peasant",
            "rank": 5,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        host_state = EstatesPlayerState.objects.create(
            game=game,
            user=self.host,
            seat_index=1,
            deck=[],
            hand=[low_card, high_card],
            discard=[],
            draw_bonus=0,
            score=0,
        )
        EstatesPlayerState.objects.create(
            game=game,
            user=self.guest,
            seat_index=2,
            deck=[],
            hand=[],
            discard=[],
            draw_bonus=0,
            score=0,
        )
        tower_card = {
            "card_id": "royal-4-1",
            "suit": "royal",
            "color": "orange",
            "rank": 4,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        throne_card = {
            "card_id": "royal-6-1",
            "suit": "royal",
            "color": "orange",
            "rank": 6,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        placements = {
            zone: {"1": None, "2": None}
            for zone in ("gate", "farm", "road", "tower", "throne")
        }
        placements["tower"] = {"1": {"card": tower_card, "confirmed": True}, "2": None}
        placements["throne"] = {"1": None, "2": {"card": throne_card, "confirmed": True}}
        EstatesRoundState.objects.create(
            game=game,
            phase=EstatesRoundState.Phase.SCORING,
            placements_by_zone=placements,
            pending_payload={
                "scoring": {
                    "zone_index": 4,
                    "waiting_until_ms": 0,
                    "awaiting_choice": None,
                    "zone_wins_recorded": ["gate", "throne", "farm", "road"],
                },
            },
        )

        round_state = EstatesRoundState.objects.get(game=game)
        progressed = _progress_scoring_if_ready(locked=game, round_state=round_state)
        self.assertTrue(progressed)

        resp = self.host_client.post(
            f"/api/v1/estates/games/{game.id}/actions/choose-effect-target/",
            {"target_card_ids": [low_card["card_id"]]},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)

        host_state.refresh_from_db()
        self.assertEqual(len(host_state.hand), 1)
        self.assertEqual(host_state.hand[0]["card_id"], high_card["card_id"])
        self.assertEqual(len(host_state.discard), 1)
        self.assertEqual(host_state.discard[0]["card_id"], low_card["card_id"])
        self.assertEqual(host_state.discard[0]["temporary_value_modifier"], 0)

        scoring = resp.json()["round_state"]["pending_payload"]["scoring"]
        self.assertIsNone(scoring.get("awaiting_choice"))
        self.assertEqual(scoring.get("next_round_start_seat"), 2)

    def test_tower_discard_multiple_cards(self):
        game = EstatesGame.objects.create(
            player_1=self.host,
            player_2=self.guest,
            status=EstatesGame.Status.ACTIVE,
            round=1,
            victory_score=7,
        )
        low_card = {
            "card_id": "peasant-1-1",
            "suit": "peasant",
            "rank": 1,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        mid_card = {
            "card_id": "peasant-2-1",
            "suit": "peasant",
            "rank": 2,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        high_card = {
            "card_id": "peasant-5-1",
            "suit": "peasant",
            "rank": 5,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        host_state = EstatesPlayerState.objects.create(
            game=game,
            user=self.host,
            seat_index=1,
            deck=[],
            hand=[low_card, mid_card, high_card],
            discard=[],
            draw_bonus=0,
            score=0,
        )
        EstatesPlayerState.objects.create(
            game=game,
            user=self.guest,
            seat_index=2,
            deck=[],
            hand=[],
            discard=[],
            draw_bonus=0,
            score=0,
        )
        tower_card = {
            "card_id": "royal-4-1",
            "suit": "royal",
            "color": "orange",
            "rank": 4,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        placements = {
            zone: {"1": None, "2": None}
            for zone in ("gate", "farm", "road", "tower", "throne")
        }
        placements["tower"] = {"1": {"card": tower_card, "confirmed": True}, "2": None}
        EstatesRoundState.objects.create(
            game=game,
            phase=EstatesRoundState.Phase.SCORING,
            placements_by_zone=placements,
            pending_payload={
                "scoring": {
                    "zone_index": 4,
                    "waiting_until_ms": 0,
                    "awaiting_choice": None,
                    "zone_wins_recorded": ["gate", "throne", "farm", "road"],
                },
            },
            pending_action="resolve_scoring",
        )
        round_state = EstatesRoundState.objects.get(game=game)
        _progress_scoring_if_ready(locked=game, round_state=round_state)

        resp = self.host_client.post(
            f"/api/v1/estates/games/{game.id}/actions/choose-effect-target/",
            {"target_card_ids": [low_card["card_id"], mid_card["card_id"]]},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        host_state.refresh_from_db()
        self.assertEqual(len(host_state.hand), 1)
        self.assertEqual(host_state.hand[0]["card_id"], high_card["card_id"])
        self.assertEqual(len(host_state.discard), 2)

    def test_tower_discard_none_keeps_hand(self):
        game = EstatesGame.objects.create(
            player_1=self.host,
            player_2=self.guest,
            status=EstatesGame.Status.ACTIVE,
            round=1,
            victory_score=7,
        )
        hand_card = {
            "card_id": "peasant-3-1",
            "suit": "peasant",
            "rank": 3,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        host_state = EstatesPlayerState.objects.create(
            game=game,
            user=self.host,
            seat_index=1,
            deck=[],
            hand=[hand_card],
            discard=[],
            draw_bonus=0,
            score=0,
        )
        EstatesPlayerState.objects.create(
            game=game,
            user=self.guest,
            seat_index=2,
            deck=[],
            hand=[],
            discard=[],
            draw_bonus=0,
            score=0,
        )
        tower_card = {
            "card_id": "royal-4-1",
            "suit": "royal",
            "color": "orange",
            "rank": 4,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        placements = {
            zone: {"1": None, "2": None}
            for zone in ("gate", "farm", "road", "tower", "throne")
        }
        placements["tower"] = {"1": {"card": tower_card, "confirmed": True}, "2": None}
        EstatesRoundState.objects.create(
            game=game,
            phase=EstatesRoundState.Phase.SCORING,
            placements_by_zone=placements,
            pending_payload={
                "scoring": {
                    "zone_index": 4,
                    "waiting_until_ms": 0,
                    "awaiting_choice": None,
                    "zone_wins_recorded": ["gate", "throne", "farm", "road"],
                },
            },
            pending_action="resolve_scoring",
        )
        round_state = EstatesRoundState.objects.get(game=game)
        _progress_scoring_if_ready(locked=game, round_state=round_state)

        resp = self.host_client.post(
            f"/api/v1/estates/games/{game.id}/actions/choose-effect-target/",
            {"target_card_ids": []},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        host_state.refresh_from_db()
        self.assertEqual(len(host_state.hand), 1)
        self.assertEqual(len(host_state.discard), 0)
        self.assertIn("keeps", resp.json()["round_state"]["status_message"].lower())

    def test_tower_discard_rejects_unknown_card_id(self):
        game = EstatesGame.objects.create(
            player_1=self.host,
            player_2=self.guest,
            status=EstatesGame.Status.ACTIVE,
            round=1,
            victory_score=7,
        )
        hand_card = {
            "card_id": "peasant-3-1",
            "suit": "peasant",
            "rank": 3,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        EstatesPlayerState.objects.create(
            game=game,
            user=self.host,
            seat_index=1,
            deck=[],
            hand=[hand_card],
            discard=[],
            draw_bonus=0,
            score=0,
        )
        EstatesPlayerState.objects.create(
            game=game,
            user=self.guest,
            seat_index=2,
            deck=[],
            hand=[],
            discard=[],
            draw_bonus=0,
            score=0,
        )
        tower_card = {
            "card_id": "royal-4-1",
            "suit": "royal",
            "color": "orange",
            "rank": 4,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        placements = {
            zone: {"1": None, "2": None}
            for zone in ("gate", "farm", "road", "tower", "throne")
        }
        placements["tower"] = {"1": {"card": tower_card, "confirmed": True}, "2": None}
        EstatesRoundState.objects.create(
            game=game,
            phase=EstatesRoundState.Phase.SCORING,
            placements_by_zone=placements,
            pending_payload={
                "scoring": {
                    "zone_index": 4,
                    "waiting_until_ms": 0,
                    "awaiting_choice": None,
                    "zone_wins_recorded": ["gate", "throne", "farm", "road"],
                },
            },
            pending_action="resolve_scoring",
        )
        round_state = EstatesRoundState.objects.get(game=game)
        _progress_scoring_if_ready(locked=game, round_state=round_state)

        resp = self.host_client.post(
            f"/api/v1/estates/games/{game.id}/actions/choose-effect-target/",
            {"target_card_ids": ["not-in-hand"]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400, resp.content)

    def test_throne_winner_gains_point(self):
        game = EstatesGame.objects.create(
            player_1=self.host,
            player_2=self.guest,
            status=EstatesGame.Status.ACTIVE,
            round=1,
            victory_score=7,
        )
        EstatesPlayerState.objects.create(
            game=game, user=self.host, seat_index=1, deck=[], hand=[], discard=[], score=0
        )
        guest_state = EstatesPlayerState.objects.create(
            game=game, user=self.guest, seat_index=2, deck=[], hand=[], discard=[], score=0
        )
        throne_card = {
            "card_id": "royal-5-1",
            "suit": "royal",
            "color": "orange",
            "rank": 5,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        placements = {
            zone: {"1": None, "2": None}
            for zone in ("gate", "farm", "road", "tower", "throne")
        }
        placements["throne"] = {"1": None, "2": {"card": throne_card, "confirmed": True}}
        round_state = EstatesRoundState.objects.create(
            game=game,
            phase=EstatesRoundState.Phase.SCORING,
            placements_by_zone=placements,
            pending_payload={
                "scoring": {
                    "zone_index": 1,
                    "waiting_until_ms": 0,
                    "awaiting_choice": None,
                    "zone_wins_recorded": ["gate"],
                },
            },
        )
        progressed = _progress_scoring_if_ready(locked=game, round_state=round_state)
        self.assertTrue(progressed)
        guest_state.refresh_from_db()
        round_state.refresh_from_db()
        self.assertEqual(guest_state.score, 1)
        self.assertIn("Throne", round_state.status_message)

    def test_throne_victory_records_skipped_zone_wins_without_scoring_them(self):
        game = EstatesGame.objects.create(
            player_1=self.host,
            player_2=self.guest,
            status=EstatesGame.Status.ACTIVE,
            round=1,
            victory_score=7,
        )
        host_state = EstatesPlayerState.objects.create(
            game=game,
            user=self.host,
            seat_index=1,
            deck=[],
            hand=[],
            discard=[],
            draw_bonus=0,
            score=6,
        )
        guest_state = EstatesPlayerState.objects.create(
            game=game,
            user=self.guest,
            seat_index=2,
            deck=[],
            hand=[],
            discard=[],
            draw_bonus=0,
            score=0,
        )
        farm_card = {
            "card_id": "peasant-3-1",
            "suit": "peasant",
            "rank": 3,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        throne_card = {
            "card_id": "royal-5-1",
            "suit": "royal",
            "rank": 5,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        placements = {
            zone: {"1": None, "2": None}
            for zone in ("gate", "farm", "road", "tower", "throne")
        }
        placements["farm"] = {"1": None, "2": {"card": farm_card, "confirmed": True}}
        placements["throne"] = {"1": {"card": throne_card, "confirmed": True}, "2": None}
        guest_stats, _ = EstatesUserStats.objects.get_or_create(user=self.guest)
        guest_farm_before = guest_stats.zone_farm_wins
        round_state = EstatesRoundState.objects.create(
            game=game,
            phase=EstatesRoundState.Phase.SCORING,
            placements_by_zone=placements,
            pending_payload={
                "scoring": {
                    "zone_index": 1,
                    "waiting_until_ms": 0,
                    "awaiting_choice": None,
                    "zone_wins_recorded": ["gate"],
                },
            },
        )
        progressed = _progress_scoring_if_ready(locked=game, round_state=round_state)
        self.assertTrue(progressed)
        game.refresh_from_db()
        host_state.refresh_from_db()
        guest_state.refresh_from_db()
        guest_stats.refresh_from_db()
        round_state.refresh_from_db()
        self.assertEqual(game.status, EstatesGame.Status.COMPLETED)
        self.assertEqual(host_state.score, 7)
        scoring = round_state.pending_payload["scoring"]
        self.assertEqual(scoring["zone_index"], 1)
        self.assertEqual(guest_stats.zone_farm_wins, guest_farm_before + 1)
        self.assertEqual(host_state.draw_bonus, 0)
        self.assertIn("throne", scoring["zone_wins_recorded"])
        self.assertIn("farm", scoring["zone_wins_recorded"])

    def test_throne_victory_does_not_double_count_zone_wins(self):
        game = EstatesGame.objects.create(
            player_1=self.host,
            player_2=self.guest,
            status=EstatesGame.Status.ACTIVE,
            round=1,
            victory_score=7,
        )
        host_state = EstatesPlayerState.objects.create(
            game=game,
            user=self.host,
            seat_index=1,
            deck=[],
            hand=[],
            discard=[],
            score=6,
        )
        EstatesPlayerState.objects.create(
            game=game,
            user=self.guest,
            seat_index=2,
            deck=[],
            hand=[],
            discard=[],
            score=0,
        )
        throne_card = {
            "card_id": "royal-5-1",
            "suit": "royal",
            "rank": 5,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        placements = {
            zone: {"1": None, "2": None}
            for zone in ("gate", "farm", "road", "tower", "throne")
        }
        placements["throne"] = {"1": {"card": throne_card, "confirmed": True}, "2": None}
        host_stats, _ = EstatesUserStats.objects.get_or_create(user=self.host)
        throne_before = host_stats.zone_throne_wins
        round_state = EstatesRoundState.objects.create(
            game=game,
            phase=EstatesRoundState.Phase.SCORING,
            placements_by_zone=placements,
            pending_payload={
                "scoring": {
                    "zone_index": 1,
                    "waiting_until_ms": 0,
                    "awaiting_choice": None,
                    "zone_wins_recorded": ["gate"],
                },
            },
        )
        progressed = _progress_scoring_if_ready(locked=game, round_state=round_state)
        self.assertTrue(progressed)
        host_state.refresh_from_db()
        host_stats.refresh_from_db()
        self.assertEqual(host_state.score, 7)
        self.assertEqual(host_stats.zone_throne_wins, throne_before + 1)

    def test_orange_color_and_suit_aliases_normalize_to_royal(self):
        card = {"suit": "orange", "color": "orange", "rank": 3}
        self.assertEqual(normalize_card_suit(card), "royal")
        self.assertEqual(normalize_suit_value("orange"), "royal")
        self.assertTrue(is_suit_allowed_in_zone(zone="tower", suit="royal"))
        self.assertTrue(is_suit_allowed_in_zone(zone="tower", suit="orange"))
        self.assertTrue(is_suit_allowed_in_zone(zone="tower", suit=normalize_card_suit(card)))
        self.assertFalse(is_suit_allowed_in_zone(zone="farm", suit=normalize_card_suit(card)))

    def test_zone_winner_single_placement_wins_zone(self):
        peasant = {
            "card_id": "peasant-3-1",
            "suit": "peasant",
            "rank": 3,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        only_seat_1 = {
            "1": {"card": peasant, "confirmed": True},
            "2": None,
        }
        self.assertEqual(_zone_winner_payload(only_seat_1), {"winning_seat": 1})

        only_seat_2 = {
            "1": None,
            "2": {"card": peasant, "confirmed": True},
        }
        self.assertEqual(_zone_winner_payload(only_seat_2), {"winning_seat": 2})

    def test_zone_winner_both_missing_is_not_a_win(self):
        self.assertIsNone(_zone_winner_payload({"1": None, "2": None}))

    def test_zone_winner_equal_cards_are_tied(self):
        card = {
            "card_id": "peasant-2-1",
            "suit": "peasant",
            "rank": 2,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        payload = {
            "1": {"card": card, "confirmed": True},
            "2": {"card": dict(card, card_id="peasant-2-2"), "confirmed": True},
        }
        self.assertEqual(_zone_winner_payload(payload), {"winning_seat": None, "outcome": "tie"})

    def test_zone_winner_zero_value_card_cannot_win_alone(self):
        zero_card = {
            "card_id": "peasant-0-1",
            "suit": "peasant",
            "rank": 0,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        self.assertEqual(
            _zone_winner_payload({"1": {"card": zero_card, "confirmed": True}, "2": None}),
            {"winning_seat": None, "outcome": "no_winner"},
        )

    def test_zone_winner_zero_value_loses_to_positive(self):
        zero_card = {
            "card_id": "peasant-0-1",
            "suit": "peasant",
            "rank": 0,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        positive_card = {
            "card_id": "peasant-1-1",
            "suit": "peasant",
            "rank": 1,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        payload = {
            "1": {"card": zero_card, "confirmed": True},
            "2": {"card": positive_card, "confirmed": True},
        }
        self.assertEqual(_zone_winner_payload(payload), {"winning_seat": 2})

    def test_zone_no_winner_status_message_copy(self):
        self.assertEqual(
            _zone_no_winner_status_message(zone_name="farm", winner_payload={"outcome": "no_winner"}),
            "There is no winner at the Farm this round.",
        )
        self.assertEqual(
            _zone_no_winner_status_message(zone_name="gate", winner_payload={"outcome": "tie"}),
            "The Gate is tied this round - no reward.",
        )

    def test_zone_winner_both_zero_value_cards_have_no_winner(self):
        zero_a = {
            "card_id": "peasant-0-1",
            "suit": "peasant",
            "rank": 0,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        zero_b = {
            "card_id": "peasant-0-2",
            "suit": "peasant",
            "rank": 0,
            "temporary_value_modifier": 0,
            "permanent_value_bonus": 0,
        }
        payload = {
            "1": {"card": zero_a, "confirmed": True},
            "2": {"card": zero_b, "confirmed": True},
        }
        self.assertEqual(_zone_winner_payload(payload), {"winning_seat": None, "outcome": "no_winner"})

