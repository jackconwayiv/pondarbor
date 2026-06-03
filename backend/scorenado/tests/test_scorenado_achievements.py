from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from achievements.models import AchievementDefinition, UserAchievement
from achievements.services import (
    SLUG_SCORENADO_DROSSELMEYER,
    SLUG_SCORENADO_GAME_PLAYER,
    SLUG_SCORENADO_HAT_TRICK,
    SLUG_SCORENADO_SCOREKEEPER,
    evaluate_scorenado_achievements_for_user,
)
from friends.models import FriendRequest
from users.models import Profile

User = get_user_model()


class ScorenadoAchievementTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="ach-owner@example.com", password="secret12345"
        )
        self.friend = User.objects.create_user(
            email="ach-friend@example.com", password="secret12345"
        )
        for u in (self.owner, self.friend):
            u.account_status = User.AccountStatus.APPROVED
            u.save(update_fields=["account_status"])
        Profile.objects.update_or_create(user=self.owner, defaults={"display_name": "Owner"})
        Profile.objects.update_or_create(user=self.friend, defaults={"display_name": "Friend"})
        FriendRequest.objects.create(
            requester=self.owner,
            requested=self.friend,
            is_accepted=True,
        )
        for slug, title in (
            (SLUG_SCORENADO_GAME_PLAYER, "Game Player"),
            (SLUG_SCORENADO_HAT_TRICK, "Hat Trick"),
            (SLUG_SCORENADO_DROSSELMEYER, "Drosselmeyer"),
            (SLUG_SCORENADO_SCOREKEEPER, "Scorekeeper"),
        ):
            AchievementDefinition.objects.get_or_create(
                slug=slug,
                defaults={"title": title, "category": "scorenado", "order": 1},
            )
        self.client = APIClient()
        self.client.force_login(self.owner)

    def _create_template(self, *, name="Test", published=False):
        r = self.client.post(
            "/api/v1/scorenado/templates/",
            {
                "name": name,
                "is_published": published,
                "categories": [{"name": "Points", "sort_order": 0, "is_scored": True}],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        return r.json()["id"]

    def _create_two_player_game(self, tid):
        return self.client.post(
            "/api/v1/scorenado/games/",
            {
                "template_id": tid,
                "players": [{"display_name": "P1"}, {"display_name": "P2"}],
            },
            format="json",
        ).json()

    def _invite_friend_to_seat(self, game, seat_index=1):
        player_id = game["players"][seat_index]["id"]
        r = self.client.post(
            f"/api/v1/scorenado/games/{game['id']}/players/{player_id}/invite/",
            {"user_id": self.friend.id},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)

    def _friend_accepts(self, game, seat_index=1):
        player_id = game["players"][seat_index]["id"]
        other = APIClient()
        other.force_login(self.friend)
        r = other.post(f"/api/v1/scorenado/invites/{player_id}/accept/")
        self.assertEqual(r.status_code, 200, r.content)

    def _score_and_finalize(self, game, *, winner_index=0):
        gid = game["id"]
        cat_id = game["template"]["categories"][0]["id"]
        winner_id = game["players"][winner_index]["id"]
        loser_id = game["players"][1 - winner_index]["id"]
        self.client.put(
            f"/api/v1/scorenado/games/{gid}/scores/",
            {"category_id": cat_id, "player_id": winner_id, "value": 10},
            format="json",
        )
        self.client.put(
            f"/api/v1/scorenado/games/{gid}/scores/",
            {"category_id": cat_id, "player_id": loser_id, "value": 1},
            format="json",
        )
        self.client.post(f"/api/v1/scorenado/games/{gid}/finalize/")

    def test_game_player_requires_finalized_invite_acceptance(self):
        tid = self._create_template()
        game = self._create_two_player_game(tid)
        self._invite_friend_to_seat(game)
        self._friend_accepts(game)
        evaluate_scorenado_achievements_for_user(self.friend.id)
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.friend, achievement__slug=SLUG_SCORENADO_GAME_PLAYER
            ).exists()
        )
        self._score_and_finalize(game)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.friend, achievement__slug=SLUG_SCORENADO_GAME_PLAYER
            ).exists()
        )

    def test_owner_auto_seat_does_not_unlock_game_player(self):
        tid = self._create_template()
        game = self._create_two_player_game(tid)
        self._score_and_finalize(game)
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.owner, achievement__slug=SLUG_SCORENADO_GAME_PLAYER
            ).exists()
        )

    def test_hat_trick_requires_three_finalized_invite_wins(self):
        tid = self._create_template()
        for _ in range(3):
            game = self._create_two_player_game(tid)
            self._invite_friend_to_seat(game)
            self._friend_accepts(game)
            self._score_and_finalize(game, winner_index=1)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.friend, achievement__slug=SLUG_SCORENADO_HAT_TRICK
            ).exists()
        )

    def test_drosselmeyer_requires_three_published_templates(self):
        for i in range(3):
            self._create_template(name=f"Shared {i}", published=True)
        evaluate_scorenado_achievements_for_user(self.owner.id)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.owner, achievement__slug=SLUG_SCORENADO_DROSSELMEYER
            ).exists()
        )

    def test_scorekeeper_requires_five_finalized_games_with_friend(self):
        tid = self._create_template()
        for _ in range(5):
            game = self._create_two_player_game(tid)
            self._invite_friend_to_seat(game)
            self._friend_accepts(game)
            self._score_and_finalize(game)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.owner, achievement__slug=SLUG_SCORENADO_SCOREKEEPER
            ).exists()
        )
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.friend, achievement__slug=SLUG_SCORENADO_SCOREKEEPER
            ).exists()
        )

    def test_scorekeeper_not_counted_without_other_claimed_user(self):
        tid = self._create_template()
        for _ in range(5):
            game = self._create_two_player_game(tid)
            self._score_and_finalize(game)
        evaluate_scorenado_achievements_for_user(self.owner.id)
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.owner, achievement__slug=SLUG_SCORENADO_SCOREKEEPER
            ).exists()
        )
