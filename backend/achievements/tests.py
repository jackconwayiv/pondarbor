from urllib.parse import quote

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from achievements.models import AchievementDefinition, UserAchievement
from achievements.services import (
    SLUG_ARCHIVIST,
    SLUG_TOWN_CRIER,
    SLUG_WHATIF_WARRIOR,
    SLUG_WHATIF_WIZ,
    evaluate_after_whatif_session_ended,
    evaluate_quote_achievements_for_user,
    evaluate_whatif_warrior_for_user,
)
from quotes.models import Quote
from whatif.models import WhatIfGameResult, WhatIfPlayer, WhatIfSession

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

    def test_town_crier_requires_public(self):
        for i in range(10):
            Quote.objects.create(
                owner=self.user,
                body=f"q{i}",
                visibility=Quote.Visibility.PUBLIC,
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

    def test_public_achievements_by_email(self):
        resp = self.client.get(f"/api/v1/users/{quote(self.user.email, safe='')}/achievements/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["slug"], SLUG_ARCHIVIST)

    def test_public_achievements_by_user_id(self):
        resp = self.client.get(f"/api/v1/users/{self.user.id}/achievements/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["slug"], SLUG_ARCHIVIST)
