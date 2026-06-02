from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase

from achievements.models import AchievementDefinition, UserAchievement
from achievements.services import (
    SLUG_ESTATES_FARMED_YA,
    SLUG_ESTATES_NOBLE,
    SLUG_ESTATES_PEASANT,
    SLUG_ESTATES_ROYAL,
    SLUG_ESTATES_FARMHAND,
    SLUG_ESTATES_THRONED_YA,
    evaluate_estates_achievements_for_user,
    evaluate_estates_stunt_zone_win_achievements,
)
from estates.models import EstatesGame, EstatesPlayerState, EstatesRoundState, EstatesUserStats
from estates.stats import (
    backfill_estates_match_stats_from_history,
    evaluate_estates_stunt_zone_win_achievements as stats_evaluate_stunt,
    record_estates_game_completed,
    record_estates_zone_win,
    serialize_estates_user_stats,
)
from users.models import Profile

User = get_user_model()


class EstatesStatsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="player@example.com", password="secret12345")
        self.user.account_status = User.AccountStatus.APPROVED
        self.user.save(update_fields=["account_status"])
        Profile.objects.update_or_create(user=self.user, defaults={"display_name": "Player", "avatar_url": ""})

        self.opponent = User.objects.create_user(email="opponent@example.com", password="secret12345")
        self.opponent.account_status = User.AccountStatus.APPROVED
        self.opponent.save(update_fields=["account_status"])
        Profile.objects.update_or_create(
            user=self.opponent, defaults={"display_name": "Opponent", "avatar_url": ""}
        )

        for slug in (
            "estates_farmhand",
            "estates_highwayman",
            "estates_lookout",
            "estates_gatekeeper",
            "estates_monarch",
            "estates_royal",
            "estates_noble",
            "estates_peasant",
            "estates_throned_ya",
            "estates_farmed_ya",
        ):
            AchievementDefinition.objects.update_or_create(
                slug=slug,
                defaults={
                    "title": slug,
                    "description": slug,
                    "category": "estates",
                    "order": 1,
                    "show_on_public_profile": True,
                },
            )

    def _create_completed_pvp_game(self, *, winner: User) -> EstatesGame:
        loser = self.opponent if winner.id == self.user.id else self.user
        game = EstatesGame.objects.create(
            player_1=self.user,
            player_2=self.opponent,
            status=EstatesGame.Status.COMPLETED,
            winner_user=winner,
            completion_outcome=EstatesGame.CompletionOutcome.VICTORY_SCORE,
            is_solo=False,
        )
        EstatesPlayerState.objects.create(game=game, user=self.user, seat_index=1, score=0)
        EstatesPlayerState.objects.create(game=game, user=self.opponent, seat_index=2, score=0)
        EstatesRoundState.objects.create(game=game)
        return game

    def test_record_zone_win_increments_counter_and_unlocks(self):
        for _ in range(50):
            record_estates_zone_win(self.user.id, "farm")
        stats = EstatesUserStats.objects.get(user_id=self.user.id)
        self.assertEqual(stats.zone_farm_wins, 50)
        self.assertTrue(
            UserAchievement.objects.filter(
                user_id=self.user.id,
                achievement__slug=SLUG_ESTATES_FARMHAND,
            ).exists()
        )

    def test_record_game_completed_counts_both_players(self):
        game = self._create_completed_pvp_game(winner=self.user)
        record_estates_game_completed(game)
        user_stats = EstatesUserStats.objects.get(user_id=self.user.id)
        opponent_stats = EstatesUserStats.objects.get(user_id=self.opponent.id)
        self.assertEqual(user_stats.games_completed, 1)
        self.assertEqual(opponent_stats.games_completed, 1)
        self.assertEqual(user_stats.pvp_wins, 1)
        self.assertEqual(opponent_stats.pvp_wins, 0)
        game.refresh_from_db()
        self.assertIsNotNone(game.stats_recorded_at)

    def test_record_game_completed_is_idempotent(self):
        game = self._create_completed_pvp_game(winner=self.user)
        record_estates_game_completed(game)
        record_estates_game_completed(game)
        stats = EstatesUserStats.objects.get(user_id=self.user.id)
        self.assertEqual(stats.games_completed, 1)
        self.assertEqual(stats.pvp_wins, 1)

    def test_evaluate_estates_achievements_for_user(self):
        stats = EstatesUserStats.objects.create(
            user=self.user,
            games_completed=10,
            pvp_wins=5,
            solo_wins=5,
        )
        evaluate_estates_achievements_for_user(self.user.id)
        unlocked = set(
            UserAchievement.objects.filter(user_id=self.user.id).values_list(
                "achievement__slug", flat=True
            )
        )
        self.assertIn(SLUG_ESTATES_NOBLE, unlocked)
        self.assertIn(SLUG_ESTATES_ROYAL, unlocked)
        self.assertIn(SLUG_ESTATES_PEASANT, unlocked)
        stats.zone_throne_wins = 50
        stats.save(update_fields=["zone_throne_wins", "updated_at"])
        evaluate_estates_achievements_for_user(self.user.id)
        self.assertTrue(
            UserAchievement.objects.filter(
                user_id=self.user.id,
                achievement__slug="estates_monarch",
            ).exists()
        )

    def test_backfill_estates_match_stats_from_history(self):
        for _ in range(5):
            self._create_completed_pvp_game(winner=self.user)
        backfill_estates_match_stats_from_history()
        stats = EstatesUserStats.objects.get(user_id=self.user.id)
        self.assertEqual(stats.games_completed, 5)
        self.assertEqual(stats.pvp_wins, 5)
        self.assertTrue(
            UserAchievement.objects.filter(
                user_id=self.user.id,
                achievement__slug=SLUG_ESTATES_ROYAL,
            ).exists()
        )

    def test_stats_mine_endpoint(self):
        EstatesUserStats.objects.create(
            user=self.user,
            games_completed=3,
            pvp_wins=2,
            solo_wins=1,
            zone_farm_wins=7,
        )
        from rest_framework.test import APIClient

        client = APIClient()
        client.force_login(self.user)
        resp = client.get("/api/v1/estates/stats/mine/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["games_completed"], 3)
        self.assertEqual(body["zone_wins"]["farm"], 7)
        self.assertEqual(body["achievement_thresholds"]["royal"], 5)

    def test_serialize_estates_user_stats_empty(self):
        payload = serialize_estates_user_stats(None)
        self.assertEqual(payload["games_completed"], 0)
        self.assertEqual(payload["zone_wins"]["road"], 0)

    def test_stunt_achievement_unlocks_on_pvp_value_one_throne(self):
        game = EstatesGame.objects.create(
            player_1=self.user,
            player_2=self.opponent,
            status=EstatesGame.Status.ACTIVE,
            is_solo=False,
        )
        card = {
            "card_id": "c1",
            "rank": 1,
            "suit": "royal",
            "permanent_value_bonus": 0,
            "temporary_value_modifier": 0,
        }
        evaluate_estates_stunt_zone_win_achievements(
            game=game,
            user_id=self.user.id,
            zone_name="throne",
            winning_card=card,
        )
        self.assertTrue(
            UserAchievement.objects.filter(
                user_id=self.user.id,
                achievement__slug=SLUG_ESTATES_THRONED_YA,
            ).exists()
        )

    def test_stunt_achievement_skips_solo(self):
        game = EstatesGame.objects.create(
            player_1=self.user,
            player_2=self.opponent,
            status=EstatesGame.Status.ACTIVE,
            is_solo=True,
        )
        card = {"card_id": "c1", "rank": 1, "suit": "royal"}
        evaluate_estates_stunt_zone_win_achievements(
            game=game,
            user_id=self.user.id,
            zone_name="throne",
            winning_card=card,
        )
        self.assertFalse(
            UserAchievement.objects.filter(
                user_id=self.user.id,
                achievement__slug=SLUG_ESTATES_THRONED_YA,
            ).exists()
        )

    def test_stunt_achievement_skips_non_value_one_card(self):
        game = EstatesGame.objects.create(
            player_1=self.user,
            player_2=self.opponent,
            status=EstatesGame.Status.ACTIVE,
            is_solo=False,
        )
        card = {"card_id": "c1", "rank": 2, "suit": "royal"}
        stats_evaluate_stunt(
            game=game,
            user_id=self.user.id,
            zone_name="farm",
            winning_card=card,
        )
        self.assertFalse(
            UserAchievement.objects.filter(
                user_id=self.user.id,
                achievement__slug=SLUG_ESTATES_FARMED_YA,
            ).exists()
        )

    def test_stunt_achievement_skips_gate_debuffed_two(self):
        game = EstatesGame.objects.create(
            player_1=self.user,
            player_2=self.opponent,
            status=EstatesGame.Status.ACTIVE,
            is_solo=False,
        )
        card = {
            "card_id": "c1",
            "rank": 2,
            "suit": "royal",
            "permanent_value_bonus": 0,
            "temporary_value_modifier": -1,
        }
        evaluate_estates_stunt_zone_win_achievements(
            game=game,
            user_id=self.user.id,
            zone_name="throne",
            winning_card=card,
        )
        self.assertFalse(
            UserAchievement.objects.filter(
                user_id=self.user.id,
                achievement__slug=SLUG_ESTATES_THRONED_YA,
            ).exists()
        )

    def test_stunt_achievement_skips_upgraded_rank_one(self):
        game = EstatesGame.objects.create(
            player_1=self.user,
            player_2=self.opponent,
            status=EstatesGame.Status.ACTIVE,
            is_solo=False,
        )
        card = {
            "card_id": "c1",
            "rank": 1,
            "suit": "peasant",
            "permanent_value_bonus": 1,
            "temporary_value_modifier": 0,
        }
        stats_evaluate_stunt(
            game=game,
            user_id=self.user.id,
            zone_name="farm",
            winning_card=card,
        )
        self.assertFalse(
            UserAchievement.objects.filter(
                user_id=self.user.id,
                achievement__slug=SLUG_ESTATES_FARMED_YA,
            ).exists()
        )

    def test_stunt_achievement_unlocks_farm_with_value_one(self):
        game = EstatesGame.objects.create(
            player_1=self.user,
            player_2=self.opponent,
            status=EstatesGame.Status.ACTIVE,
            is_solo=False,
        )
        card = {
            "card_id": "c1",
            "rank": 1,
            "suit": "peasant",
            "permanent_value_bonus": 0,
            "temporary_value_modifier": 0,
        }
        stats_evaluate_stunt(
            game=game,
            user_id=self.user.id,
            zone_name="farm",
            winning_card=card,
        )
        self.assertTrue(
            UserAchievement.objects.filter(
                user_id=self.user.id,
                achievement__slug=SLUG_ESTATES_FARMED_YA,
            ).exists()
        )
