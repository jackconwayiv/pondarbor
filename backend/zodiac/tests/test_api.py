from datetime import date, time

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User
from zodiac.models import AstroProfile

MINIMAL_CHART = """
Sun	11°37'		Libra
Moon	26°33'		Sagittarius
AS	28°17'		Pisces
House 1	28°17'	Pisces
House 2	13°11'	Taurus
House 3	9°11'	Gemini
House 4	29°13'	Gemini
House 5	19°07'	Cancer
House 6	14°34'	Leo
House 7	28°17'	Virgo
House 8	13°11'	Scorpio
House 9	9°11'	Sagittarius
House 10	29°13'	Sagittarius
House 11	19°07'	Capricorn
House 12	14°34'	Aquarius
"""


class ZodiacApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_staff_import_forbidden_for_plain_user(self):
        user = User.objects.create_user(email="u1@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save()
        self.client.force_login(user)
        response = self.client.post(
            "/api/v1/zodiac/staff/users/999/chart/",
            {"chart_text": MINIMAL_CHART},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_user_put_creates_waiting_profile(self):
        user = User.objects.create_user(email="u2@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save()
        self.client.force_login(user)
        response = self.client.put(
            "/api/v1/zodiac/profile/",
            {
                "birth_date": "1990-06-15",
                "birth_time": "14:30:00",
                "country_code": "US",
                "admin_area": "AZ",
                "locality": "Phoenix",
                "postal_code": "85001",
                "latitude": None,
                "longitude": None,
                "iana_timezone": "America/Phoenix",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["profile"]["chart_status"], "waiting_staff_chart")
        prof = AstroProfile.objects.get(user=user)
        self.assertEqual(prof.chart_status, AstroProfile.ChartStatus.WAITING_STAFF_CHART)

    def test_user_put_without_timezone_or_coords_ok(self):
        user = User.objects.create_user(email="u9@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save()
        self.client.force_login(user)
        response = self.client.put(
            "/api/v1/zodiac/profile/",
            {
                "birth_date": "1992-03-01",
                "birth_time": "09:15:00",
                "country_code": "US",
                "admin_area": "CA",
                "locality": "Oakland",
                "postal_code": "94607",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        prof = AstroProfile.objects.get(user=user)
        self.assertEqual(prof.locality, "Oakland")
        self.assertEqual(prof.iana_timezone, "")

    def test_user_put_optional_birth_time_null_ok(self):
        user = User.objects.create_user(email="u10@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save()
        self.client.force_login(user)
        response = self.client.put(
            "/api/v1/zodiac/profile/",
            {
                "birth_date": "1988-11-22",
                "birth_time": None,
                "country_code": "US",
                "admin_area": "NY",
                "locality": "Buffalo",
                "postal_code": "",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        prof = AstroProfile.objects.get(user=user)
        self.assertIsNone(prof.birth_time)

    def test_user_put_missing_state_rejected(self):
        user = User.objects.create_user(email="u11@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save()
        self.client.force_login(user)
        response = self.client.put(
            "/api/v1/zodiac/profile/",
            {
                "birth_date": "1988-11-22",
                "country_code": "US",
                "admin_area": "   ",
                "locality": "Buffalo",
                "postal_code": "14201",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("state", response.json()["detail"].lower())

    def test_staff_import_chart(self):
        staff = User.objects.create_user(
            email="staff@example.com", password="secret12345", is_staff=True
        )
        staff.account_status = User.AccountStatus.APPROVED
        staff.save()
        user = User.objects.create_user(email="u3@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save()
        AstroProfile.objects.create(
            user=user,
            chart_status=AstroProfile.ChartStatus.WAITING_STAFF_CHART,
            birth_date=date(1990, 1, 1),
            birth_time=time(12, 0, 0),
            country_code="US",
            locality="Testville",
            iana_timezone="America/New_York",
        )

        self.client.force_login(staff)
        response = self.client.post(
            f"/api/v1/zodiac/staff/users/{user.id}/chart/",
            {"chart_text": MINIMAL_CHART},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        prof = AstroProfile.objects.get(user=user)
        self.assertEqual(prof.chart_status, AstroProfile.ChartStatus.READY)
        self.assertIsNotNone(prof.natal_chart)

    def test_staff_imported_lists_ready_charts(self):
        staff = User.objects.create_user(
            email="staff2@example.com", password="secret12345", is_staff=True
        )
        staff.account_status = User.AccountStatus.APPROVED
        staff.save()
        user = User.objects.create_user(email="u_imp@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save()
        AstroProfile.objects.create(
            user=user,
            chart_status=AstroProfile.ChartStatus.WAITING_STAFF_CHART,
            birth_date=date(1990, 1, 1),
            birth_time=time(12, 0, 0),
            country_code="US",
            locality="Here",
            admin_area="ST",
            iana_timezone="",
        )

        self.client.force_login(staff)
        r = self.client.post(
            f"/api/v1/zodiac/staff/users/{user.id}/chart/",
            {"chart_text": MINIMAL_CHART},
            format="json",
        )
        self.assertEqual(r.status_code, 200)

        r2 = self.client.get("/api/v1/zodiac/staff/imported/")
        self.assertEqual(r2.status_code, 200)
        body = r2.json()
        self.assertEqual(len(body["imported"]), 1)
        self.assertEqual(body["imported"][0]["user_id"], user.id)
        self.assertEqual(body["imported"][0]["chart_status"], "ready")
        self.assertIsNotNone(body["imported"][0]["natal_chart"])

    def test_staff_delete_chart_returns_to_waiting(self):
        staff = User.objects.create_user(
            email="staff3@example.com", password="secret12345", is_staff=True
        )
        staff.account_status = User.AccountStatus.APPROVED
        staff.save()
        user = User.objects.create_user(email="u_del@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save()
        AstroProfile.objects.create(
            user=user,
            chart_status=AstroProfile.ChartStatus.WAITING_STAFF_CHART,
            birth_date=date(1990, 1, 1),
            birth_time=time(12, 0, 0),
            country_code="US",
            locality="Here",
            admin_area="ST",
            iana_timezone="",
        )

        self.client.force_login(staff)
        self.client.post(
            f"/api/v1/zodiac/staff/users/{user.id}/chart/",
            {"chart_text": MINIMAL_CHART},
            format="json",
        )

        r = self.client.delete(f"/api/v1/zodiac/staff/users/{user.id}/chart/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["profile"]["chart_status"], "waiting_staff_chart")
        prof = AstroProfile.objects.get(user=user)
        self.assertEqual(prof.chart_status, AstroProfile.ChartStatus.WAITING_STAFF_CHART)
        self.assertIsNone(prof.natal_chart)
