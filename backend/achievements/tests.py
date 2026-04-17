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
    SLUG_SHARING_IS_CARING,
    SLUG_SOMETHING_BORROWED,
    SLUG_SMORGASBORD,
    SLUG_TASTY_PLANS,
    SLUG_THATS_AMORE,
    SLUG_TOWN_CRIER,
    SLUG_WHATIF_WARRIOR,
    SLUG_WHATIF_WIZ,
    evaluate_closet_return_achievements_for_users,
    evaluate_closet_sharing_is_caring_for_user,
    evaluate_after_whatif_session_ended,
    evaluate_meal_maestro_partner_for_user,
    evaluate_meal_maestro_smorgasbord_for_user,
    evaluate_meal_maestro_tasty_plans_for_instance,
    evaluate_pondclicker_achievements_for_user,
    evaluate_quote_achievements_for_user,
    evaluate_whatif_warrior_for_user,
)
from datetime import date

from quotes.models import Quote
from whatif.models import WhatIfGameResult, WhatIfPlayer, WhatIfSession
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
            source_template=None,
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
