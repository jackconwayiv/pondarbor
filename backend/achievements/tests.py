from unittest.mock import patch
from urllib.parse import quote

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from achievements.models import AchievementDefinition, UserAchievement
from friends.models import FriendRequest
from achievements.services import (
    SLUG_ARCHIVIST,
    SLUG_GOOD_AS_NEW,
    SLUG_PONDCLICKER_TIER_1,
    SLUG_PONDCLICKER_TIER_2,
    SLUG_PONDCLICKER_TIER_6,
    SLUG_PONDCLICKER_TIER_7,
    SLUG_PONDCLICKER_POND_PAWN,
    SLUG_PONDCLICKER_TADPOLE_TRAVELER,
    SLUG_PONDCLICKER_LILY_PAD_LEAPER,
    SLUG_PONDCLICKER_MARSH_WARDEN,
    SLUG_SCHEDULE_COORDINATOR,
    SLUG_SHARING_IS_CARING,
    SLUG_SOMETHING_BORROWED,
    SLUG_SMORGASBORD,
    SLUG_TASTY_PLANS,
    SLUG_THATS_AMORE,
    SLUG_TOWN_CRIER,
    SLUG_WHATIF_DECE_PROPOSER,
    SLUG_WHATIF_WARRIOR,
    SLUG_WHATIF_WIZ,
    evaluate_closet_return_achievements_for_users,
    evaluate_closet_sharing_is_caring_for_user,
    evaluate_after_whatif_session_ended,
    evaluate_clicker2_achievements_for_user,
    evaluate_meal_maestro_partner_for_user,
    evaluate_meal_maestro_smorgasbord_for_user,
    evaluate_meal_maestro_tasty_plans_for_instance,
    evaluate_pondclicker_achievements_for_user,
    evaluate_quote_achievements_for_user,
    evaluate_schedule_coordinator_for_user,
    evaluate_whatif_dece_proposer_for_user,
    evaluate_whatif_warrior_for_user,
    SLUG_GOALS_CHECKPOINT_CHARLIE,
    SLUG_GOALS_LIFES_A_CHORE,
    SLUG_GOALS_MARATHON_MONTH,
    SLUG_GOALS_ON_TARGET,
    SLUG_GOALS_STREAK_WEEK,
    SLUG_GOALS_TRI_GOAL_ATHLON,
    SLUG_WELCOME_TO_POND_ARBOR,
    evaluate_goals_achievements_for_user,
    evaluate_welcome_to_pond_arbor_for_user,
)
from datetime import date, timedelta

from calendars.models import CalendarSource
from calendars.services import SyncResult
from calendars.tests.helpers import CalendarTestMixin
from quotes.models import Quote
from whatif.models import WhatIfGameResult, WhatIfPlayer, WhatIfQuestion, WhatIfSession
from closet.models import Item
from meal.models import Meal, MealPlanInstance, MealPlanInstanceSlot, MealPlanInstanceSlotMeal

User = get_user_model()


class AchievementQuoteTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="ach@example.com", password="secret12345")
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_ARCHIVIST,
            defaults={
                "title": "Archivist",
                "description": "",
                "category": "quotes",
                "order": 10,
            },
        )
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_TOWN_CRIER,
            defaults={
                "title": "Town Crier",
                "description": "",
                "category": "quotes",
                "order": 20,
            },
        )

    def test_archivist_unlocks_at_ten_quotes(self):
        for i in range(10):
            Quote.objects.create(owner=self.user, body=f"q{i}")
        evaluate_quote_achievements_for_user(self.user.id)
        self.assertTrue(
            UserAchievement.objects.filter(user=self.user, achievement__slug=SLUG_ARCHIVIST).exists()
        )

    def test_town_crier_requires_published(self):
        for i in range(10):
            Quote.objects.create(
                owner=self.user,
                body=f"q{i}",
                visibility=Quote.Visibility.PUBLISHED,
            )
        evaluate_quote_achievements_for_user(self.user.id)
        self.assertTrue(
            UserAchievement.objects.filter(user=self.user, achievement__slug=SLUG_TOWN_CRIER).exists()
        )

    def test_sticky_does_not_revoke_after_delete(self):
        for i in range(10):
            Quote.objects.create(owner=self.user, body=f"q{i}")
        evaluate_quote_achievements_for_user(self.user.id)
        q = Quote.objects.filter(owner=self.user).first()
        assert q is not None
        q.deleted_at = timezone.now()
        q.save(update_fields=["deleted_at", "updated_at"])
        self.assertEqual(Quote.objects.filter(owner=self.user, deleted_at__isnull=True).count(), 9)
        self.assertTrue(
            UserAchievement.objects.filter(user=self.user, achievement__slug=SLUG_ARCHIVIST).exists()
        )


class AchievementWhatIfTests(TestCase):
    def setUp(self):
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_WHATIF_WARRIOR,
            defaults={
                "title": "WhatIf Warrior",
                "description": "",
                "category": "whatif",
                "order": 40,
            },
        )
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_WHATIF_WIZ,
            defaults={
                "title": "WhatIf Wiz",
                "description": "",
                "category": "whatif",
                "order": 30,
            },
        )

    def test_warrior_five_ended_sessions(self):
        u = User.objects.create_user(email="war@example.com", password="secret12345")
        codes = ["PLAY", "GAME", "WHAT", "IFIT", "ENDD"]
        for code in codes:
            s = WhatIfSession.objects.create(short_code=code, status=WhatIfSession.Status.ENDED)
            WhatIfPlayer.objects.create(session=s, user=u, display_name="p", avatar_emoji="🦊")
        evaluate_whatif_warrior_for_user(u.id)
        self.assertTrue(
            UserAchievement.objects.filter(user=u, achievement__slug=SLUG_WHATIF_WARRIOR).exists()
        )

    def test_wiz_requires_three_players_and_winner_user(self):
        u1 = User.objects.create_user(email="w1@example.com", password="secret12345")
        u2 = User.objects.create_user(email="w2@example.com", password="secret12345")
        u3 = User.objects.create_user(email="w3@example.com", password="secret12345")
        s = WhatIfSession.objects.create(short_code="WIZZ", status=WhatIfSession.Status.ENDED)
        p1 = WhatIfPlayer.objects.create(session=s, user=u1, display_name="a", avatar_emoji="🦊")
        WhatIfPlayer.objects.create(session=s, user=u2, display_name="b", avatar_emoji="🐻")
        WhatIfPlayer.objects.create(session=s, user=u3, display_name="c", avatar_emoji="🐼")
        WhatIfGameResult.objects.create(
            session=s,
            winner_player=p1,
            winner_user=u1,
            winner_display_name="a",
        )
        evaluate_after_whatif_session_ended(s.id)
        self.assertTrue(
            UserAchievement.objects.filter(user=u1, achievement__slug=SLUG_WHATIF_WIZ).exists()
        )


class AchievementWhatIfDeceProposerTests(TestCase):
    def setUp(self):
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_WHATIF_DECE_PROPOSER,
            defaults={
                "title": "Dece Proposer",
                "description": "",
                "category": "whatif",
                "order": 45,
            },
        )

    def test_unlocks_at_five_approved_non_deleted(self):
        u = User.objects.create_user(email="dece@example.com", password="secret12345")
        base = {
            "answer_1": "1",
            "answer_2": "2",
            "answer_3": "3",
            "answer_4": "4",
            "answer_5": "5",
            "answer_6": "6",
        }
        for i in range(4):
            WhatIfQuestion.objects.create(
                prompt=f"What if {{subject}} q{i}?",
                review_status=WhatIfQuestion.ReviewStatus.APPROVED,
                proposed_by=u,
                **base,
            )
        evaluate_whatif_dece_proposer_for_user(u.id)
        self.assertFalse(
            UserAchievement.objects.filter(user=u, achievement__slug=SLUG_WHATIF_DECE_PROPOSER).exists()
        )
        WhatIfQuestion.objects.create(
            prompt="What if {subject} fifth?",
            review_status=WhatIfQuestion.ReviewStatus.APPROVED,
            proposed_by=u,
            **base,
        )
        evaluate_whatif_dece_proposer_for_user(u.id)
        self.assertTrue(
            UserAchievement.objects.filter(user=u, achievement__slug=SLUG_WHATIF_DECE_PROPOSER).exists()
        )

    def test_soft_deleted_approved_does_not_count(self):
        u = User.objects.create_user(email="dece-del@example.com", password="secret12345")
        base = {
            "answer_1": "1",
            "answer_2": "2",
            "answer_3": "3",
            "answer_4": "4",
            "answer_5": "5",
            "answer_6": "6",
        }
        for i in range(4):
            WhatIfQuestion.objects.create(
                prompt=f"What if {{subject}} ok{i}?",
                review_status=WhatIfQuestion.ReviewStatus.APPROVED,
                proposed_by=u,
                **base,
            )
        deleted = WhatIfQuestion.objects.create(
            prompt="What if {subject} deleted?",
            review_status=WhatIfQuestion.ReviewStatus.APPROVED,
            proposed_by=u,
            deleted_at=timezone.now(),
            **base,
        )
        assert deleted.id is not None
        evaluate_whatif_dece_proposer_for_user(u.id)
        self.assertFalse(
            UserAchievement.objects.filter(user=u, achievement__slug=SLUG_WHATIF_DECE_PROPOSER).exists()
        )


class PondClickerAchievementTests(TestCase):
    def setUp(self):
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_PONDCLICKER_TIER_1,
            defaults={
                "title": "Tier 1 Pond",
                "description": "",
                "category": "pondclicker",
                "order": 50,
            },
        )

    def test_tier1_unlocks_when_all_five_marquee_denizens_owned(self):
        user = User.objects.create_user(email="pond@example.com", password="secret12345")
        evaluate_pondclicker_achievements_for_user(user.id, {"owned_upgrades": {"pond_snails": 1}})
        self.assertFalse(
            UserAchievement.objects.filter(user=user, achievement__slug=SLUG_PONDCLICKER_TIER_1).exists()
        )

        partial = {
            "owned_upgrades": {
                "pond_snails": 1,
                "tadpoles": 1,
                "water_fleas": 1,
                "dragonfly_nymph": 1,
            },
        }
        evaluate_pondclicker_achievements_for_user(user.id, partial)
        self.assertFalse(
            UserAchievement.objects.filter(user=user, achievement__slug=SLUG_PONDCLICKER_TIER_1).exists()
        )

        state_ok = {
            "owned_upgrades": {
                "pond_snails": 1,
                "tadpoles": 1,
                "water_fleas": 1,
                "dragonfly_nymph": 1,
                "leeches": 1,
            },
        }
        evaluate_pondclicker_achievements_for_user(user.id, state_ok)
        self.assertTrue(
            UserAchievement.objects.filter(user=user, achievement__slug=SLUG_PONDCLICKER_TIER_1).exists()
        )

    def test_tier2_unlocks_when_all_five_marquee_denizens_owned(self):
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_PONDCLICKER_TIER_2,
            defaults={
                "title": "Tier 2 Pond",
                "description": "",
                "category": "pondclicker",
                "order": 51,
            },
        )
        user = User.objects.create_user(email="pond2@example.com", password="secret12345")
        state_ok = {
            "owned_upgrades": {
                "crayfish": 1,
                "minnows": 1,
                "green_frogs": 1,
                "water_striders": 1,
                "diving_beetles": 1,
            },
        }
        evaluate_pondclicker_achievements_for_user(user.id, state_ok)
        self.assertTrue(
            UserAchievement.objects.filter(user=user, achievement__slug=SLUG_PONDCLICKER_TIER_2).exists()
        )

    def test_tier6_unlocks_in_same_pass_as_tier1_when_state_has_both(self):
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_PONDCLICKER_TIER_6,
            defaults={
                "title": "Tier 6 Pond",
                "description": "",
                "category": "pondclicker",
                "order": 55,
            },
        )
        user = User.objects.create_user(email="pond6@example.com", password="secret12345")
        state = {
            "owned_upgrades": {
                "pond_snails": 1,
                "tadpoles": 1,
                "water_fleas": 1,
                "dragonfly_nymph": 1,
                "leeches": 1,
                "otters": 1,
                "beavers": 1,
                "bald_eagles": 1,
                "bowfin": 1,
                "mute_swans": 1,
            },
        }
        evaluate_pondclicker_achievements_for_user(user.id, state)
        self.assertTrue(
            UserAchievement.objects.filter(user=user, achievement__slug=SLUG_PONDCLICKER_TIER_1).exists()
        )
        self.assertTrue(
            UserAchievement.objects.filter(user=user, achievement__slug=SLUG_PONDCLICKER_TIER_6).exists()
        )

    def test_tier7_unlocks_when_all_ten_marquee_denizens_owned(self):
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_PONDCLICKER_TIER_7,
            defaults={
                "title": "Prestige Pond",
                "description": "",
                "category": "pondclicker",
                "order": 56,
            },
        )
        user = User.objects.create_user(email="pond7@example.com", password="secret12345")
        nine = {
            "white_tailed_deer": 1,
            "fireflies": 1,
            "brown_bats": 1,
            "bumblebees": 1,
            "water_snake": 1,
            "fishing_spider": 1,
            "american_mink": 1,
            "belted_kingfisher": 1,
            "monarch_butterfly": 1,
        }
        evaluate_pondclicker_achievements_for_user(user.id, {"owned_upgrades": nine})
        self.assertFalse(
            UserAchievement.objects.filter(user=user, achievement__slug=SLUG_PONDCLICKER_TIER_7).exists()
        )
        state_ok = {**nine, "raccoon": 1}
        evaluate_pondclicker_achievements_for_user(user.id, {"owned_upgrades": state_ok})
        self.assertTrue(
            UserAchievement.objects.filter(user=user, achievement__slug=SLUG_PONDCLICKER_TIER_7).exists()
        )


def _clicker2_state_with_milestones(n: int) -> dict:
    return {
        "milestones_reached": {f"m{i}": float(i) for i in range(n)},
    }


class Clicker2AchievementTests(TestCase):
    MILESTONE_SLUGS = (
        SLUG_PONDCLICKER_POND_PAWN,
        SLUG_PONDCLICKER_TADPOLE_TRAVELER,
        "pondclicker_pond_pioneer",
        SLUG_PONDCLICKER_LILY_PAD_LEAPER,
        "pondclicker_wetland_wanderer",
        SLUG_PONDCLICKER_MARSH_WARDEN,
        "pondclicker_current_commander",
        "pondclicker_stillwater_strategist",
        "pondclicker_ecosystem_architect",
        "pondclicker_pond_potentate",
    )

    def setUp(self):
        for idx, slug in enumerate(self.MILESTONE_SLUGS):
            AchievementDefinition.objects.get_or_create(
                slug=slug,
                defaults={
                    "title": slug,
                    "description": "",
                    "category": "pondclicker",
                    "order": 57 + idx,
                },
            )

    def test_no_unlock_below_fifty_milestones(self):
        user = User.objects.create_user(email="c2-49@example.com", password="secret12345")
        evaluate_clicker2_achievements_for_user(user.id, _clicker2_state_with_milestones(49))
        self.assertFalse(
            UserAchievement.objects.filter(user=user, achievement__slug=SLUG_PONDCLICKER_POND_PAWN).exists()
        )

    def test_pond_pawn_unlocks_at_fifty_milestones(self):
        user = User.objects.create_user(email="c2-50@example.com", password="secret12345")
        evaluate_clicker2_achievements_for_user(user.id, _clicker2_state_with_milestones(50))
        self.assertTrue(
            UserAchievement.objects.filter(user=user, achievement__slug=SLUG_PONDCLICKER_POND_PAWN).exists()
        )
        self.assertFalse(
            UserAchievement.objects.filter(
                user=user,
                achievement__slug=SLUG_PONDCLICKER_TADPOLE_TRAVELER,
            ).exists()
        )

    def test_tadpole_traveler_unlocks_at_one_hundred_milestones(self):
        user = User.objects.create_user(email="c2-100@example.com", password="secret12345")
        evaluate_clicker2_achievements_for_user(user.id, _clicker2_state_with_milestones(100))
        self.assertTrue(
            UserAchievement.objects.filter(user=user, achievement__slug=SLUG_PONDCLICKER_POND_PAWN).exists()
        )
        self.assertTrue(
            UserAchievement.objects.filter(
                user=user,
                achievement__slug=SLUG_PONDCLICKER_TADPOLE_TRAVELER,
            ).exists()
        )
        self.assertFalse(
            UserAchievement.objects.filter(
                user=user,
                achievement__slug="pondclicker_pond_pioneer",
            ).exists()
        )

    def test_two_hundred_milestones_unlocks_first_four_tiers(self):
        user = User.objects.create_user(email="c2-200@example.com", password="secret12345")
        evaluate_clicker2_achievements_for_user(user.id, _clicker2_state_with_milestones(200))
        for slug in self.MILESTONE_SLUGS[:4]:
            self.assertTrue(
                UserAchievement.objects.filter(user=user, achievement__slug=slug).exists(),
                slug,
            )
        self.assertFalse(
            UserAchievement.objects.filter(
                user=user,
                achievement__slug="pondclicker_wetland_wanderer",
            ).exists()
        )

    def test_evaluate_is_idempotent(self):
        user = User.objects.create_user(email="c2-idem@example.com", password="secret12345")
        state = _clicker2_state_with_milestones(300)
        self.assertTrue(evaluate_clicker2_achievements_for_user(user.id, state))
        self.assertFalse(evaluate_clicker2_achievements_for_user(user.id, state))
        self.assertEqual(
            UserAchievement.objects.filter(user=user).count(),
            6,
        )


class ClosetAchievementServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="closet-owner@example.com", password="secret12345")
        self.borrower = User.objects.create_user(email="closet-borrower@example.com", password="secret12345")
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_SHARING_IS_CARING,
            defaults={
                "title": "Sharing is Caring",
                "description": "",
                "category": "closet",
                "order": 60,
            },
        )
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_SOMETHING_BORROWED,
            defaults={
                "title": "Something Borrowed",
                "description": "",
                "category": "closet",
                "order": 70,
            },
        )
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_GOOD_AS_NEW,
            defaults={
                "title": "Good as New",
                "description": "",
                "category": "closet",
                "order": 80,
            },
        )

    def test_sharing_is_caring_requires_five_active_owned_items(self):
        for idx in range(5):
            Item.objects.create(
                owner_user=self.owner,
                current_holder_user=self.owner,
                name=f"Closet {idx}",
            )
        evaluate_closet_sharing_is_caring_for_user(self.owner.id)
        self.assertTrue(
            UserAchievement.objects.filter(user=self.owner, achievement__slug=SLUG_SHARING_IS_CARING).exists()
        )

    def test_return_achievements_unlock_owner_and_borrower(self):
        evaluate_closet_return_achievements_for_users(
            owner_user_id=self.owner.id,
            borrower_user_id=self.borrower.id,
        )
        self.assertTrue(
            UserAchievement.objects.filter(user=self.owner, achievement__slug=SLUG_GOOD_AS_NEW).exists()
        )
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.borrower,
                achievement__slug=SLUG_SOMETHING_BORROWED,
            ).exists()
        )


class AchievementMealMaestroTests(TestCase):
    def setUp(self):
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_THATS_AMORE,
            defaults={
                "title": "That's Amore",
                "description": "",
                "category": "meal",
                "order": 90,
            },
        )
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_TASTY_PLANS,
            defaults={
                "title": "Tasty Plans",
                "description": "",
                "category": "meal",
                "order": 91,
            },
        )
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_SMORGASBORD,
            defaults={
                "title": "Smorgasbord",
                "description": "",
                "category": "meal",
                "order": 92,
            },
        )

    def test_thats_amore_unlocks_both_mutual_partners(self):
        u1 = User.objects.create_user(email="meal-p1@example.com", password="secret12345")
        u2 = User.objects.create_user(email="meal-p2@example.com", password="secret12345")
        u1.profile.meal_crud_partner_id = u2.id
        u1.profile.save(update_fields=["meal_crud_partner_id", "updated_at"])
        u2.profile.meal_crud_partner_id = u1.id
        u2.profile.save(update_fields=["meal_crud_partner_id", "updated_at"])
        evaluate_meal_maestro_partner_for_user(u1.id)
        self.assertTrue(
            UserAchievement.objects.filter(user=u1, achievement__slug=SLUG_THATS_AMORE).exists()
        )
        self.assertTrue(
            UserAchievement.objects.filter(user=u2, achievement__slug=SLUG_THATS_AMORE).exists()
        )

    def test_thats_amore_not_one_sided(self):
        u1 = User.objects.create_user(email="meal-s1@example.com", password="secret12345")
        u2 = User.objects.create_user(email="meal-s2@example.com", password="secret12345")
        u1.profile.meal_crud_partner_id = u2.id
        u1.profile.save(update_fields=["meal_crud_partner_id", "updated_at"])
        evaluate_meal_maestro_partner_for_user(u1.id)
        self.assertFalse(
            UserAchievement.objects.filter(user=u1, achievement__slug=SLUG_THATS_AMORE).exists()
        )

    def test_tasty_plans_requires_fourteen_filled_slots(self):
        owner = User.objects.create_user(email="meal-plan@example.com", password="secret12345")
        meal = Meal.objects.create(owner_user=owner, title="Soup")
        inst = MealPlanInstance.objects.create(
            owner_user=owner,
            week_start=date(2026, 4, 6),
        )
        for d in range(7):
            for s in range(2):
                if d == 0 and s == 0:
                    continue
                slot = MealPlanInstanceSlot.objects.create(instance=inst, day_index=d, slot_index=s)
                MealPlanInstanceSlotMeal.objects.create(slot=slot, meal=meal)
        evaluate_meal_maestro_tasty_plans_for_instance(instance_id=inst.pk)
        self.assertFalse(
            UserAchievement.objects.filter(user=owner, achievement__slug=SLUG_TASTY_PLANS).exists()
        )

        slot = MealPlanInstanceSlot.objects.create(instance=inst, day_index=0, slot_index=0)
        MealPlanInstanceSlotMeal.objects.create(slot=slot, meal=meal)
        evaluate_meal_maestro_tasty_plans_for_instance(instance_id=inst.pk)
        self.assertTrue(
            UserAchievement.objects.filter(user=owner, achievement__slug=SLUG_TASTY_PLANS).exists()
        )

    def test_smorgasbord_requires_twenty_meals(self):
        owner = User.objects.create_user(email="meal-smorg@example.com", password="secret12345")
        for i in range(19):
            Meal.objects.create(owner_user=owner, title=f"M{i}")
        evaluate_meal_maestro_smorgasbord_for_user(owner.id)
        self.assertFalse(
            UserAchievement.objects.filter(user=owner, achievement__slug=SLUG_SMORGASBORD).exists()
        )
        Meal.objects.create(owner_user=owner, title="Last")
        evaluate_meal_maestro_smorgasbord_for_user(owner.id)
        self.assertTrue(
            UserAchievement.objects.filter(user=owner, achievement__slug=SLUG_SMORGASBORD).exists()
        )


class AchievementPublicApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="pub@example.com", password="secret12345")
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_ARCHIVIST,
            defaults={
                "title": "Archivist",
                "description": "d",
                "category": "quotes",
                "order": 10,
            },
        )
        defn = AchievementDefinition.objects.get(slug=SLUG_ARCHIVIST)
        UserAchievement.objects.create(user=self.user, achievement=defn)
        self.client = APIClient()
        self.viewer = User.objects.create_user(email="viewer@example.com", password="secret12345")
        self.viewer.account_status = User.AccountStatus.APPROVED
        self.viewer.save(update_fields=["account_status"])
        self.user.account_status = User.AccountStatus.APPROVED
        self.user.save(update_fields=["account_status"])

    def _accept_pair(self, user_a, user_b):
        FriendRequest.objects.update_or_create(
            requester=user_a,
            requested=user_b,
            defaults={"is_accepted": True},
        )
        FriendRequest.objects.update_or_create(
            requester=user_b,
            requested=user_a,
            defaults={"is_accepted": True},
        )

    def test_public_achievements_by_email(self):
        resp = self.client.get(f"/api/v1/users/{quote(self.user.email, safe='')}/achievements/")
        self.assertIn(resp.status_code, (401, 403))

        self.client.force_login(self.viewer)
        self._accept_pair(self.viewer, self.user)
        friend_resp = self.client.get(
            f"/api/v1/users/{quote(self.user.email, safe='')}/achievements/"
        )
        self.assertEqual(friend_resp.status_code, 200)
        data = friend_resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["slug"], SLUG_ARCHIVIST)

    def test_public_achievements_by_user_id(self):
        resp = self.client.get(f"/api/v1/users/{self.user.id}/achievements/")
        self.assertIn(resp.status_code, (401, 403))

        self.client.force_login(self.viewer)
        self._accept_pair(self.viewer, self.user)
        friend_resp = self.client.get(f"/api/v1/users/{self.user.id}/achievements/")
        self.assertEqual(friend_resp.status_code, 200)
        data = friend_resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["slug"], SLUG_ARCHIVIST)

    def test_friend_does_not_see_hidden_achievement(self):
        ua = UserAchievement.objects.get(user=self.user, achievement__slug=SLUG_ARCHIVIST)
        ua.visible_to_friends = False
        ua.save(update_fields=["visible_to_friends"])

        self.client.force_login(self.viewer)
        self._accept_pair(self.viewer, self.user)
        friend_resp = self.client.get(f"/api/v1/users/{self.user.id}/achievements/")
        self.assertEqual(friend_resp.status_code, 200)
        self.assertEqual(friend_resp.json(), [])

    def test_owner_still_sees_hidden_achievement(self):
        ua = UserAchievement.objects.get(user=self.user, achievement__slug=SLUG_ARCHIVIST)
        ua.visible_to_friends = False
        ua.save(update_fields=["visible_to_friends"])

        self.client.force_login(self.user)
        owner_resp = self.client.get(f"/api/v1/users/{self.user.id}/achievements/")
        self.assertEqual(owner_resp.status_code, 200)
        data = owner_resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["slug"], SLUG_ARCHIVIST)
        self.assertIs(data[0]["visible_to_friends"], False)

    def test_patch_achievement_visibility(self):
        self.client.force_login(self.user)
        resp = self.client.patch(
            f"/api/v1/users/me/achievements/{SLUG_ARCHIVIST}/",
            data={"visible_to_friends": False},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        ua = UserAchievement.objects.get(user=self.user, achievement__slug=SLUG_ARCHIVIST)
        self.assertIs(ua.visible_to_friends, False)

        resp_show = self.client.patch(
            f"/api/v1/users/me/achievements/{SLUG_ARCHIVIST}/",
            data={"visible_to_friends": True},
            content_type="application/json",
        )
        self.assertEqual(resp_show.status_code, 200)
        ua.refresh_from_db()
        self.assertIsNone(ua.visible_to_friends)


class AchievementPeerApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="peer-owner@example.com", password="secret12345")
        self.friend_visible = User.objects.create_user(
            email="peer-vis@example.com", password="secret12345"
        )
        self.friend_hidden = User.objects.create_user(
            email="peer-hid@example.com", password="secret12345"
        )
        self.viewer = User.objects.create_user(email="peer-viewer@example.com", password="secret12345")
        for u in (self.owner, self.friend_visible, self.friend_hidden, self.viewer):
            u.account_status = User.AccountStatus.APPROVED
            u.save(update_fields=["account_status"])
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_ARCHIVIST,
            defaults={
                "title": "Archivist",
                "description": "d",
                "category": "quotes",
                "order": 10,
            },
        )
        defn = AchievementDefinition.objects.get(slug=SLUG_ARCHIVIST)
        UserAchievement.objects.create(user=self.friend_visible, achievement=defn)
        ua_h = UserAchievement.objects.create(user=self.friend_hidden, achievement=defn)
        ua_h.visible_to_friends = False
        ua_h.save(update_fields=["visible_to_friends"])
        self.client = APIClient()

    def _accept_pair(self, user_a, user_b):
        FriendRequest.objects.update_or_create(
            requester=user_a,
            requested=user_b,
            defaults={"is_accepted": True},
        )
        FriendRequest.objects.update_or_create(
            requester=user_b,
            requested=user_a,
            defaults={"is_accepted": True},
        )

    def test_me_peers_lists_friend_with_visible_badge(self):
        self._accept_pair(self.viewer, self.friend_visible)
        self._accept_pair(self.viewer, self.friend_hidden)
        self.client.force_login(self.viewer)
        resp = self.client.post(
            "/api/v1/users/me/achievement-peers/",
            data={"slugs": [SLUG_ARCHIVIST]},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()["peers_by_slug"]
        self.assertIn(SLUG_ARCHIVIST, body)
        ids = {row["id"] for row in body[SLUG_ARCHIVIST]}
        self.assertIn(self.friend_visible.id, ids)
        self.assertNotIn(self.friend_hidden.id, ids)

    def test_subject_friends_peers_requires_friendship(self):
        self._accept_pair(self.owner, self.friend_visible)
        self.client.force_login(self.viewer)
        resp = self.client.post(
            f"/api/v1/users/{self.owner.id}/achievement-peers/",
            data={"slugs": [SLUG_ARCHIVIST]},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_subject_friends_peers_when_viewer_friends_with_subject(self):
        self._accept_pair(self.viewer, self.owner)
        self._accept_pair(self.owner, self.friend_visible)
        self.client.force_login(self.viewer)
        resp = self.client.post(
            f"/api/v1/users/{self.owner.id}/achievement-peers/",
            data={"slugs": [SLUG_ARCHIVIST]},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()["peers_by_slug"][SLUG_ARCHIVIST]
        ids = {row["id"] for row in body}
        self.assertIn(self.friend_visible.id, ids)
        self.assertNotIn(self.owner.id, ids)

    def test_me_peers_slug_cap(self):
        self.client.force_login(self.viewer)
        slugs = [f"s{i}" for i in range(70)]
        resp = self.client.post(
            "/api/v1/users/me/achievement-peers/",
            data={"slugs": slugs},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertLessEqual(len(resp.json()["peers_by_slug"]), 64)


class StaffAchievementDefinitionsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(
            email="staff-defs@example.com", password="secret12345", is_staff=True
        )
        self.member = User.objects.create_user(
            email="member-defs@example.com", password="secret12345", is_staff=False
        )
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_ARCHIVIST,
            defaults={
                "title": "Archivist",
                "description": "Test",
                "category": "quotes",
                "order": 10,
            },
        )

    def test_anonymous_forbidden(self):
        r = self.client.get("/api/v1/achievements/definitions/")
        self.assertIn(r.status_code, (401, 403))

    def test_non_staff_forbidden(self):
        self.client.force_login(self.member)
        r = self.client.get("/api/v1/achievements/definitions/")
        self.assertEqual(r.status_code, 403)

    def test_staff_receives_catalog_payload(self):
        self.client.force_login(self.staff)
        r = self.client.get("/api/v1/achievements/definitions/")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIsInstance(data, list)
        self.assertTrue(any(row.get("slug") == SLUG_ARCHIVIST for row in data))
        sample = next(row for row in data if row.get("slug") == SLUG_ARCHIVIST)
        self.assertIn("title", sample)
        self.assertIn("description", sample)
        self.assertIn("category", sample)


class ScheduleCoordinatorAchievementTests(CalendarTestMixin, TestCase):
    def setUp(self):
        self.create_users()
        AchievementDefinition.objects.get_or_create(
            slug=SLUG_SCHEDULE_COORDINATOR,
            defaults={
                "title": "Schedule Coordinator",
                "description": "Share one or more calendars with your PondArbor friends.",
                "category": "calendar",
                "order": 130,
            },
        )

    def test_evaluate_manual_source_only_does_not_unlock(self):
        CalendarSource.objects.create(
            owner=self.alice,
            source_type=CalendarSource.SourceType.MANUAL,
            display_name="Manual",
        )
        evaluate_schedule_coordinator_for_user(self.alice.id)
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.alice, achievement__slug=SLUG_SCHEDULE_COORDINATOR
            ).exists()
        )

    def test_import_success_unlocks(self):
        with patch(
            "calendars.views.sync_ical_source",
            return_value=SyncResult(ok=True, created=1),
        ):
            resp = self.alice_client.post(
                "/api/v1/calendars/sources/",
                {
                    "display_name": "Trips",
                    "ical_url": "https://calendar.google.com/calendar/ical/x/basic.ics",
                },
                format="json",
            )
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.alice, achievement__slug=SLUG_SCHEDULE_COORDINATOR
            ).exists()
        )

    def test_import_sync_failure_does_not_unlock(self):
        with patch(
            "calendars.views.sync_ical_source",
            return_value=SyncResult(ok=False, error="404 Not Found"),
        ):
            resp = self.alice_client.post(
                "/api/v1/calendars/sources/",
                {
                    "display_name": "Trips",
                    "ical_url": "https://calendar.google.com/calendar/ical/y/basic.ics",
                },
                format="json",
            )
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.alice, achievement__slug=SLUG_SCHEDULE_COORDINATOR
            ).exists()
        )

    def test_refresh_success_unlocks(self):
        source = CalendarSource.objects.create(
            owner=self.alice,
            source_type=CalendarSource.SourceType.ICAL,
            display_name="Trips",
            ical_url="https://calendar.google.com/calendar/ical/z/basic.ics",
        )
        with patch(
            "calendars.views.sync_ical_source",
            return_value=SyncResult(ok=True, created=0, updated=1),
        ):
            resp = self.alice_client.post(f"/api/v1/calendars/sources/{source.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.alice, achievement__slug=SLUG_SCHEDULE_COORDINATOR
            ).exists()
        )


class GoalsAchievementTests(TestCase):
    def setUp(self):
        for slug, title, order in (
            (SLUG_GOALS_TRI_GOAL_ATHLON, "Tri-Goal-Athlon", 230),
            (SLUG_GOALS_STREAK_WEEK, "Streak Week", 231),
            (SLUG_GOALS_MARATHON_MONTH, "Marathon Month", 232),
            (SLUG_GOALS_CHECKPOINT_CHARLIE, "Checkpoint Charlie", 233),
            (SLUG_GOALS_LIFES_A_CHORE, "Life's a Chore", 234),
            (SLUG_GOALS_ON_TARGET, "On Target", 235),
        ):
            AchievementDefinition.objects.get_or_create(
                slug=slug,
                defaults={
                    "title": title,
                    "description": "",
                    "category": "goals",
                    "order": order,
                },
            )
        self.user = User.objects.create_user(email="goals-ach@example.com", password="secret12345")
        self.user.account_status = User.AccountStatus.APPROVED
        self.user.save(update_fields=["account_status"])

    def test_tri_goal_athlon_requires_three_active(self):
        from goals.models import Goal

        for i in range(2):
            Goal.objects.create(
                owner_user=self.user,
                title=f"Goal {i}",
                kind=Goal.Kind.CONTINUOUS,
                status=Goal.Status.ACTIVE,
            )
        evaluate_goals_achievements_for_user(self.user.id)
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.user, achievement__slug=SLUG_GOALS_TRI_GOAL_ATHLON
            ).exists()
        )
        Goal.objects.create(
            owner_user=self.user,
            title="Third",
            kind=Goal.Kind.CONTINUOUS,
            status=Goal.Status.ACTIVE,
        )
        evaluate_goals_achievements_for_user(self.user.id)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user, achievement__slug=SLUG_GOALS_TRI_GOAL_ATHLON
            ).exists()
        )

    def test_tri_goal_athlon_excludes_paused(self):
        from goals.models import Goal

        for i in range(2):
            Goal.objects.create(
                owner_user=self.user,
                title=f"Active {i}",
                kind=Goal.Kind.CONTINUOUS,
                status=Goal.Status.ACTIVE,
            )
        Goal.objects.create(
            owner_user=self.user,
            title="Paused",
            kind=Goal.Kind.CONTINUOUS,
            status=Goal.Status.PAUSED,
        )
        evaluate_goals_achievements_for_user(self.user.id)
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.user, achievement__slug=SLUG_GOALS_TRI_GOAL_ATHLON
            ).exists()
        )

    def test_streak_week_unlocks_at_seven_day_streak(self):
        from goals.models import CheckIn, Goal

        goal = Goal.objects.create(
            owner_user=self.user,
            title="Daily habit",
            kind=Goal.Kind.CONTINUOUS,
            schedule_interval_kind=Goal.ScheduleIntervalKind.DAY,
            status=Goal.Status.ACTIVE,
        )
        now = timezone.now()
        for day in range(7):
            CheckIn.objects.create(
                goal=goal,
                owner_user_id=self.user.id,
                occurred_at=now - timedelta(days=day),
            )
        evaluate_goals_achievements_for_user(self.user.id)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user, achievement__slug=SLUG_GOALS_STREAK_WEEK
            ).exists()
        )
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.user, achievement__slug=SLUG_GOALS_MARATHON_MONTH
            ).exists()
        )

    def test_checkpoint_charlie_requires_ten_completed(self):
        from goals.models import Checkpoint, Goal

        goal = Goal.objects.create(
            owner_user=self.user,
            title="Project",
            kind=Goal.Kind.ONE_TIME,
            status=Goal.Status.ACTIVE,
        )
        now = timezone.now()
        for i in range(10):
            Checkpoint.objects.create(
                goal=goal,
                title=f"Step {i}",
                sort_order=i,
                completed_at=now,
            )
        evaluate_goals_achievements_for_user(self.user.id)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user, achievement__slug=SLUG_GOALS_CHECKPOINT_CHARLIE
            ).exists()
        )

    def test_lifes_a_chore_requires_five_chores_same_day(self):
        from goals.models import CheckIn, Goal

        now = timezone.now()
        for i in range(4):
            chore = Goal.objects.create(
                owner_user=self.user,
                title=f"Chore {i}",
                kind=Goal.Kind.CHORE,
                status=Goal.Status.ACTIVE,
            )
            CheckIn.objects.create(
                goal=chore,
                owner_user_id=self.user.id,
                occurred_at=now,
            )
        evaluate_goals_achievements_for_user(self.user.id)
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.user, achievement__slug=SLUG_GOALS_LIFES_A_CHORE
            ).exists()
        )
        fifth = Goal.objects.create(
            owner_user=self.user,
            title="Chore 4",
            kind=Goal.Kind.CHORE,
            status=Goal.Status.ACTIVE,
        )
        CheckIn.objects.create(
            goal=fifth,
            owner_user_id=self.user.id,
            occurred_at=now,
        )
        evaluate_goals_achievements_for_user(self.user.id)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user, achievement__slug=SLUG_GOALS_LIFES_A_CHORE
            ).exists()
        )

    def test_lifes_a_chore_does_not_count_spread_across_days(self):
        from goals.models import CheckIn, Goal

        now = timezone.now()
        for i in range(5):
            chore = Goal.objects.create(
                owner_user=self.user,
                title=f"Chore {i}",
                kind=Goal.Kind.CHORE,
                status=Goal.Status.ACTIVE,
            )
            CheckIn.objects.create(
                goal=chore,
                owner_user_id=self.user.id,
                occurred_at=now - timedelta(days=i),
            )
        evaluate_goals_achievements_for_user(self.user.id)
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.user, achievement__slug=SLUG_GOALS_LIFES_A_CHORE
            ).exists()
        )

    def test_on_target_requires_five_completed_projects(self):
        from goals.models import Goal

        now = timezone.now()
        for i in range(4):
            Goal.objects.create(
                owner_user=self.user,
                title=f"Project {i}",
                kind=Goal.Kind.ONE_TIME,
                status=Goal.Status.COMPLETED,
                completed_at=now,
            )
        evaluate_goals_achievements_for_user(self.user.id)
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.user, achievement__slug=SLUG_GOALS_ON_TARGET
            ).exists()
        )
        Goal.objects.create(
            owner_user=self.user,
            title="Project 4",
            kind=Goal.Kind.ONE_TIME,
            status=Goal.Status.COMPLETED,
            completed_at=now,
        )
        evaluate_goals_achievements_for_user(self.user.id)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user, achievement__slug=SLUG_GOALS_ON_TARGET
            ).exists()
        )


class WelcomeToPondArborAchievementTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="welcome@example.com",
            password="secret12345",
        )

    def test_evaluate_unlocks_once(self):
        evaluate_welcome_to_pond_arbor_for_user(self.user.id)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user,
                achievement__slug=SLUG_WELCOME_TO_POND_ARBOR,
            ).exists()
        )
        evaluate_welcome_to_pond_arbor_for_user(self.user.id)
        self.assertEqual(
            UserAchievement.objects.filter(
                user=self.user,
                achievement__slug=SLUG_WELCOME_TO_POND_ARBOR,
            ).count(),
            1,
        )


class AchievementTrophyCaseApiTests(TestCase):
    def setUp(self):
        User = get_user_model()
        from users.models import Profile

        self.viewer = User.objects.create_user(
            email="hof-viewer@example.com", password="secret12345"
        )
        self.friend = User.objects.create_user(
            email="hof-friend@example.com", password="secret12345"
        )
        self.stranger = User.objects.create_user(
            email="hof-stranger@example.com", password="secret12345"
        )
        for u in (self.viewer, self.friend, self.stranger):
            u.account_status = User.AccountStatus.APPROVED
            u.save(update_fields=["account_status"])

        prof = self.stranger.profile
        prof.social_publish_visibility = Profile.SocialPublishVisibility.FRIENDS_ONLY
        prof.save(update_fields=["social_publish_visibility"])

        self.archivist, _ = AchievementDefinition.objects.get_or_create(
            slug=SLUG_ARCHIVIST,
            defaults={
                "title": "Archivist",
                "description": "d",
                "category": "quotes",
                "order": 10,
            },
        )
        self.town_crier, _ = AchievementDefinition.objects.get_or_create(
            slug=SLUG_TOWN_CRIER,
            defaults={
                "title": "Town Crier",
                "description": "d",
                "category": "quotes",
                "order": 20,
            },
        )
        self.client = APIClient()

    def _accept_pair(self, user_a, user_b):
        FriendRequest.objects.update_or_create(
            requester=user_a,
            requested=user_b,
            defaults={"is_accepted": True},
        )
        FriendRequest.objects.update_or_create(
            requester=user_b,
            requested=user_a,
            defaults={"is_accepted": True},
        )

    def test_requires_approved_user(self):
        pending = get_user_model().objects.create_user(
            email="hof-pending@example.com", password="secret12345"
        )
        self.client.force_login(pending)
        resp = self.client.get("/api/v1/users/me/achievement-trophy-case/")
        self.assertEqual(resp.status_code, 403)

    def test_excludes_friends_only_stranger_when_not_friends(self):
        UserAchievement.objects.create(user=self.stranger, achievement=self.archivist)
        self.client.force_login(self.viewer)
        resp = self.client.get("/api/v1/users/me/achievement-trophy-case/")
        self.assertEqual(resp.status_code, 200)
        archivist = next(r for r in resp.json()["rows"] if r["slug"] == SLUG_ARCHIVIST)
        self.assertFalse(archivist["is_earned"])

    def test_includes_friends_only_stranger_when_friends(self):
        self._accept_pair(self.viewer, self.stranger)
        UserAchievement.objects.create(user=self.stranger, achievement=self.archivist)
        self.client.force_login(self.viewer)
        resp = self.client.get("/api/v1/users/me/achievement-trophy-case/")
        self.assertEqual(resp.status_code, 200)
        archivist = next(r for r in resp.json()["rows"] if r["slug"] == SLUG_ARCHIVIST)
        self.assertTrue(archivist["is_earned"])

    def test_respects_viewer_social_read_scope_friends_only(self):
        from users.models import Profile

        self._accept_pair(self.viewer, self.friend)
        UserAchievement.objects.create(user=self.friend, achievement=self.archivist)
        UserAchievement.objects.create(user=self.stranger, achievement=self.town_crier)
        prof = self.viewer.profile
        prof.social_read_scope = Profile.SocialReadScope.FRIENDS_ONLY
        prof.save(update_fields=["social_read_scope"])
        self.client.force_login(self.viewer)
        resp = self.client.get("/api/v1/users/me/achievement-trophy-case/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        by_slug = {row["slug"]: row for row in body["rows"]}
        self.assertTrue(by_slug[SLUG_ARCHIVIST]["is_earned"])
        self.assertFalse(by_slug[SLUG_TOWN_CRIER]["is_earned"])

    def test_includes_unearned_catalog_rows(self):
        self.client.force_login(self.viewer)
        resp = self.client.get("/api/v1/users/me/achievement-trophy-case/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        archivist = next(r for r in body["rows"] if r["slug"] == SLUG_ARCHIVIST)
        self.assertFalse(archivist["is_earned"])
        self.assertEqual(archivist["earner_count"], 0)
        self.assertEqual(archivist["title"], "Archivist")
        self.assertEqual(archivist["earners"], [])

    def test_earned_row_includes_title_and_flag(self):
        UserAchievement.objects.create(user=self.viewer, achievement=self.archivist)
        self.client.force_login(self.viewer)
        resp = self.client.get("/api/v1/users/me/achievement-trophy-case/")
        self.assertEqual(resp.status_code, 200)
        archivist = next(r for r in resp.json()["rows"] if r["slug"] == SLUG_ARCHIVIST)
        self.assertTrue(archivist["is_earned"])
        self.assertEqual(archivist["title"], "Archivist")

    def test_hidden_friend_badge_excluded_for_non_owner(self):
        self._accept_pair(self.viewer, self.friend)
        ua = UserAchievement.objects.create(user=self.friend, achievement=self.archivist)
        ua.visible_to_friends = False
        ua.save(update_fields=["visible_to_friends"])
        self.client.force_login(self.viewer)
        resp = self.client.get("/api/v1/users/me/achievement-trophy-case/")
        self.assertEqual(resp.status_code, 200)
        archivist = next(r for r in resp.json()["rows"] if r["slug"] == SLUG_ARCHIVIST)
        self.assertFalse(archivist["is_earned"])
