from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from scorenado.models import Game, GamePlayer, ScoreboardTemplate
from users.models import Profile

User = get_user_model()


class ScorenadoApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="secret12345"
        )
        self.other = User.objects.create_user(
            email="other@example.com", password="secret12345"
        )
        for u in (self.owner, self.other):
            u.account_status = User.AccountStatus.APPROVED
            u.save(update_fields=["account_status"])
        Profile.objects.update_or_create(user=self.owner, defaults={"display_name": "Owner"})
        self.client = APIClient()
        self.client.force_login(self.owner)

    def _create_template(self):
        r = self.client.post(
            "/api/v1/scorenado/templates/",
            {
                "name": "Test Game",
                "low_score_wins": False,
                "categories": [
                    {"name": "Points A", "sort_order": 0, "is_scored": True},
                    {"name": "Points B", "sort_order": 1, "is_scored": True},
                ],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        return r.json()["id"]

    def test_template_crud(self):
        tid = self._create_template()
        r = self.client.get(f"/api/v1/scorenado/templates/{tid}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()["categories"]), 2)

    def test_game_scoring_and_finalize(self):
        tid = self._create_template()
        r = self.client.post(
            "/api/v1/scorenado/games/",
            {
                "template_id": tid,
                "title": "Friday night",
                "players": [
                    {"display_name": "Alice"},
                    {"display_name": "Bob"},
                ],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        game = r.json()
        gid = game["id"]
        cat_a = game["template"]["categories"][0]["id"]
        player_alice = game["players"][0]["id"]

        r2 = self.client.put(
            f"/api/v1/scorenado/games/{gid}/scores/",
            {
                "category_id": cat_a,
                "player_id": player_alice,
                "value": 10,
            },
            format="json",
        )
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(
            r2.json()["template"]["categories"][0]["scores"][player_alice],
            10,
        )
        self.assertEqual(r2.json()["players"][0]["total"], 10)

        r3 = self.client.post(f"/api/v1/scorenado/games/{gid}/finalize/")
        self.assertEqual(r3.status_code, 200)
        self.assertTrue(r3.json()["is_finalized"])

        r4 = self.client.put(
            f"/api/v1/scorenado/games/{gid}/scores/",
            {"category_id": cat_a, "player_id": player_alice, "value": 5},
            format="json",
        )
        self.assertEqual(r4.status_code, 403)

    def test_game_creator_linked_to_player_one(self):
        tid = self._create_template()
        game = self.client.post(
            "/api/v1/scorenado/games/",
            {"template_id": tid},
            format="json",
        ).json()
        self.assertEqual(game["players"][0]["display_name"], "P1")
        self.assertEqual(game["players"][0]["claimed_user"]["id"], self.owner.id)

    def test_game_only_first_seat_auto_claimed(self):
        tid = self._create_template()
        game = self.client.post(
            "/api/v1/scorenado/games/",
            {
                "template_id": tid,
                "players": [{"display_name": "P1"}, {"display_name": "P2"}],
            },
            format="json",
        ).json()
        self.assertEqual(game["players"][0]["claimed_user"]["id"], self.owner.id)
        self.assertIsNone(game["players"][1]["claimed_user"])

    def test_templates_sorted_by_updated_at(self):
        r1 = self.client.post(
            "/api/v1/scorenado/templates/",
            {"name": "Older", "categories": [{"name": "A", "sort_order": 0}]},
            format="json",
        )
        r2 = self.client.post(
            "/api/v1/scorenado/templates/",
            {"name": "Newer", "categories": [{"name": "B", "sort_order": 0}]},
            format="json",
        )
        self.assertEqual(r1.status_code, 201)
        self.assertEqual(r2.status_code, 201)
        older_id = r1.json()["id"]
        self.client.patch(
            f"/api/v1/scorenado/templates/{older_id}/",
            {"name": "Older edited"},
            format="json",
        )
        listed = self.client.get("/api/v1/scorenado/templates/").json()
        self.assertGreaterEqual(len(listed), 2)
        self.assertEqual(listed[0]["name"], "Older edited")

    def test_template_last_played_at_annotation(self):
        tid = self._create_template()
        self.client.post(
            "/api/v1/scorenado/games/",
            {"template_id": tid},
            format="json",
        )
        row = next(
            t for t in self.client.get("/api/v1/scorenado/templates/").json() if t["id"] == tid
        )
        self.assertIsNotNone(row.get("last_played_at"))

    def test_games_list_sorted_by_played_at(self):
        tid = self._create_template()
        g1 = self.client.post(
            "/api/v1/scorenado/games/",
            {"template_id": tid, "played_at": "2020-01-01"},
            format="json",
        ).json()
        g2 = self.client.post(
            "/api/v1/scorenado/games/",
            {"template_id": tid, "played_at": "2024-06-15"},
            format="json",
        ).json()
        listed = self.client.get("/api/v1/scorenado/games/").json()
        self.assertEqual(listed[0]["id"], g2["id"])
        self.assertEqual(listed[1]["id"], g1["id"])

    def test_template_min_players_and_default_rounds(self):
        r = self.client.post(
            "/api/v1/scorenado/templates/",
            {
                "name": "Setup template",
                "scored_by_rounds": True,
                "min_players": 4,
                "default_round_count": 6,
                "categories": [{"name": "Pts", "sort_order": 0}],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        body = r.json()
        self.assertEqual(body["min_players"], 4)
        self.assertEqual(body["default_round_count"], 6)

    def test_create_game_with_player_and_round_counts(self):
        r = self.client.post(
            "/api/v1/scorenado/templates/",
            {
                "name": "Rounds setup",
                "scored_by_rounds": True,
                "categories": [{"name": "Points", "sort_order": 0}],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        tid = r.json()["id"]
        game = self.client.post(
            "/api/v1/scorenado/games/",
            {
                "template_id": tid,
                "round_count": 4,
                "players": [
                    {"display_name": "A"},
                    {"display_name": "B"},
                    {"display_name": "C"},
                    {"display_name": "D"},
                    {"display_name": "E"},
                ],
            },
            format="json",
        ).json()
        self.assertEqual(len(game["players"]), 5)
        self.assertEqual(game["round_count"], 4)

    def test_scored_by_rounds_per_category_per_round(self):
        r = self.client.post(
            "/api/v1/scorenado/templates/",
            {
                "name": "Rounds Game",
                "scored_by_rounds": True,
                "categories": [
                    {"name": "Birds", "sort_order": 0, "is_scored": True},
                    {"name": "Bonus", "sort_order": 1, "is_scored": True},
                ],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        tid = r.json()["id"]
        game = self.client.post(
            "/api/v1/scorenado/games/",
            {"template_id": tid, "round_count": 2},
            format="json",
        ).json()
        gid = game["id"]
        cat_birds = game["template"]["categories"][0]["id"]
        cat_bonus = game["template"]["categories"][1]["id"]
        player = game["players"][0]["id"]

        self.client.put(
            f"/api/v1/scorenado/games/{gid}/scores/",
            {
                "category_id": cat_birds,
                "player_id": player,
                "value": 5,
                "round_number": 1,
            },
            format="json",
        )
        self.client.put(
            f"/api/v1/scorenado/games/{gid}/scores/",
            {
                "category_id": cat_birds,
                "player_id": player,
                "value": 3,
                "round_number": 2,
            },
            format="json",
        )
        detail = self.client.get(f"/api/v1/scorenado/games/{gid}/").json()
        self.assertEqual(detail["round_count"], 2)
        birds = next(
            c for c in detail["template"]["categories"] if c["name"] == "Birds"
        )
        self.assertEqual(birds["scores_by_round"]["1"][player], 5)
        self.assertEqual(birds["scores_by_round"]["2"][player], 3)
        self.assertEqual(detail["players"][0]["total"], 8)

    def test_private_template_hidden_from_other_users(self):
        tid = self._create_template()
        other = APIClient()
        other.force_login(self.other)
        listed = other.get("/api/v1/scorenado/templates/").json()
        self.assertNotIn(tid, [t["id"] for t in listed])
        r = other.get(f"/api/v1/scorenado/templates/{tid}/")
        self.assertEqual(r.status_code, 404)

    def test_published_template_visible_but_not_editable(self):
        r = self.client.post(
            "/api/v1/scorenado/templates/",
            {
                "name": "Public board",
                "is_published": True,
                "categories": [{"name": "Pts", "sort_order": 0}],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        tid = r.json()["id"]
        self.assertTrue(r.json()["is_published"])
        self.assertTrue(r.json()["can_edit"])

        other = APIClient()
        other.force_login(self.other)
        listed = other.get("/api/v1/scorenado/templates/").json()
        match = next(t for t in listed if t["id"] == tid)
        self.assertTrue(match["is_published"])
        self.assertFalse(match["can_edit"])

        r2 = other.patch(
            f"/api/v1/scorenado/templates/{tid}/",
            {"name": "Hijacked"},
            format="json",
        )
        self.assertEqual(r2.status_code, 404)

        game = other.post(
            "/api/v1/scorenado/games/",
            {"template_id": tid, "players": [{"display_name": "A"}, {"display_name": "B"}]},
            format="json",
        )
        self.assertEqual(game.status_code, 201)

    def test_invited_user_sees_private_template(self):
        tid = self._create_template()
        game = self.client.post(
            "/api/v1/scorenado/games/",
            {"template_id": tid, "players": [{"display_name": "A"}, {"display_name": "B"}]},
            format="json",
        ).json()
        player_id = game["players"][0]["id"]
        GamePlayer.objects.filter(pk=player_id).update(
            invited_user=self.other,
            invite_status=GamePlayer.INVITE_PENDING,
        )
        other = APIClient()
        other.force_login(self.other)
        listed = other.get("/api/v1/scorenado/templates/").json()
        self.assertIn(tid, [t["id"] for t in listed])
        match = next(t for t in listed if t["id"] == tid)
        self.assertFalse(match["is_published"])
        self.assertFalse(match["can_edit"])

    def test_participant_can_view_game_read_only(self):
        from friends.models import FriendRequest

        FriendRequest.objects.create(
            requester=self.owner,
            requested=self.other,
            is_accepted=True,
        )
        tid = self._create_template()
        game = self.client.post(
            "/api/v1/scorenado/games/",
            {"template_id": tid, "players": [{"display_name": "A"}, {"display_name": "B"}]},
            format="json",
        ).json()
        player_id = game["players"][1]["id"]
        invite = self.client.post(
            f"/api/v1/scorenado/games/{game['id']}/players/{player_id}/invite/",
            {"user_id": self.other.id},
            format="json",
        )
        self.assertEqual(invite.status_code, 200)
        other = APIClient()
        other.force_login(self.other)
        accept = other.post(f"/api/v1/scorenado/invites/{player_id}/accept/")
        self.assertEqual(accept.status_code, 200)
        detail = other.get(f"/api/v1/scorenado/games/{game['id']}/").json()
        self.assertFalse(detail["can_edit"])
        self.assertFalse(detail["is_owner"])
        score = other.put(
            f"/api/v1/scorenado/games/{game['id']}/scores/",
            {
                "category_id": detail["template"]["categories"][0]["id"],
                "player_id": detail["players"][0]["id"],
                "value": 5,
            },
            format="json",
        )
        self.assertEqual(score.status_code, 403)

    def test_template_edit_preserves_existing_game(self):
        tid = self._create_template()
        game = self.client.post(
            "/api/v1/scorenado/games/",
            {
                "template_id": tid,
                "players": [{"display_name": "Alice"}, {"display_name": "Bob"}],
            },
            format="json",
        ).json()
        gid = game["id"]
        cat_a = game["template"]["categories"][0]["id"]
        player_alice = game["players"][0]["id"]

        scored = self.client.put(
            f"/api/v1/scorenado/games/{gid}/scores/",
            {
                "category_id": cat_a,
                "player_id": player_alice,
                "value": 10,
            },
            format="json",
        )
        self.assertEqual(scored.status_code, 200)

        edited = self.client.patch(
            f"/api/v1/scorenado/templates/{tid}/",
            {
                "name": "Edited Template",
                "low_score_wins": True,
                "categories": [
                    {"name": "Renamed A", "sort_order": 0, "is_scored": True},
                    {"name": "New C", "sort_order": 1, "is_scored": True},
                ],
            },
            format="json",
        )
        self.assertEqual(edited.status_code, 200)

        detail = self.client.get(f"/api/v1/scorenado/games/{gid}/").json()
        self.assertEqual(detail["template"]["name"], "Test Game")
        self.assertFalse(detail["template"]["low_score_wins"])
        self.assertEqual(len(detail["template"]["categories"]), 2)
        self.assertEqual(detail["template"]["categories"][0]["name"], "Points A")
        self.assertEqual(
            detail["template"]["categories"][0]["scores"][player_alice],
            10,
        )
        self.assertEqual(
            self.client.get(f"/api/v1/scorenado/templates/{tid}/").json()["name"],
            "Edited Template",
        )

    def test_other_user_cannot_read_game(self):
        tid = self._create_template()
        r = self.client.post(
            "/api/v1/scorenado/games/",
            {"template_id": tid},
            format="json",
        )
        gid = r.json()["id"]
        other = APIClient()
        other.force_login(self.other)
        r2 = other.get(f"/api/v1/scorenado/games/{gid}/")
        self.assertEqual(r2.status_code, 404)
