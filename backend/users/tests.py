from datetime import timedelta
from urllib.parse import quote

from django.contrib.auth import get_user_model
from django.http import Http404
from django.test import RequestFactory
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from users.frontend_views import spa_index
from closet.models import Item
from contact.models import ContactMessage
from friends.models import FriendRequest
from whatif.models import WhatIfQuestion

User = get_user_model()


class UsersApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_signup_creates_profile_and_me_shape(self):
        response = self.client.post(
            "/api/v1/users/signup/",
            {
                "email": "new@example.com",
                "password": "goodpass12",
                "display_name": "Nick",
                "timezone": "UTC",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertIn("user", body)
        self.assertIn("profile", body)
        self.assertEqual(body["user"]["email"], "new@example.com")
        self.assertEqual(body["user"]["account_status"], "pending")
        self.assertFalse(body["user"]["is_approved"])
        self.assertNotIn("status", body["profile"])
        self.assertEqual(body["profile"]["display_name"], "Nick")
        self.assertIsNone(body["profile"]["birth_date"])
        self.assertFalse(body["profile"]["whatif_completed_session"])

    def test_me_requires_authentication(self):
        response = self.client.get("/api/v1/users/me/")
        self.assertIn(response.status_code, (401, 403))

    def test_me_returns_authenticated_user_only(self):
        user = User.objects.create_user(email="self@example.com", password="secret12345")
        self.client.force_login(user)
        response = self.client.get("/api/v1/users/me/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["user"]["email"], "self@example.com")
        self.assertEqual(body["user"]["id"], user.id)
        self.assertFalse(body["profile"]["whatif_completed_session"])
        self.assertIsNotNone(body["user"].get("date_joined"))

    def test_public_summary_anonymous_by_id_and_email_returns_401(self):
        user = User.objects.create_user(email="friend@example.com", password="secret12345")
        user.profile.display_name = "Pat"
        user.profile.save()
        by_id = self.client.get(f"/api/v1/users/{user.id}/public/")
        self.assertIn(by_id.status_code, (401, 403))
        by_email = self.client.get(f"/api/v1/users/{quote(user.email, safe='')}/public/")
        self.assertIn(by_email.status_code, (401, 403))

    def test_public_summary_friend_viewer_includes_extended_fields(self):
        viewer = User.objects.create_user(email="viewer@example.com", password="secret12345")
        viewer.account_status = User.AccountStatus.APPROVED
        viewer.save(update_fields=["account_status"])
        target = User.objects.create_user(email="target@example.com", password="secret12345")
        target.account_status = User.AccountStatus.APPROVED
        target.save(update_fields=["account_status"])
        target.profile.display_name = "TargetNick"
        target.profile.save(update_fields=["display_name"])

        FriendRequest.objects.create(requester=viewer, requested=target, is_accepted=True)
        FriendRequest.objects.create(requester=target, requested=viewer, is_accepted=True)

        self.client.force_login(viewer)
        resp = self.client.get(f"/api/v1/users/{target.id}/public/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body["is_friend"])
        self.assertTrue(body["can_view_full_profile"])
        self.assertEqual(body["friendship_status"], "friends")
        self.assertEqual(body["display_name"], "TargetNick")
        self.assertEqual(body["email"], "target@example.com")
        self.assertEqual(body["closet_items_count"], 0)

    def test_public_summary_friend_includes_closet_items_count(self):
        viewer = User.objects.create_user(email="cv@example.com", password="secret12345")
        viewer.account_status = User.AccountStatus.APPROVED
        viewer.save(update_fields=["account_status"])
        target = User.objects.create_user(email="ct@example.com", password="secret12345")
        target.account_status = User.AccountStatus.APPROVED
        target.save(update_fields=["account_status"])
        FriendRequest.objects.create(requester=viewer, requested=target, is_accepted=True)
        Item.objects.create(
            owner_user=target,
            current_holder_user=target,
            name="Ladder",
            category="",
            tags=[],
            image_key="",
        )
        self.client.force_login(viewer)
        resp = self.client.get(f"/api/v1/users/{target.id}/public/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["closet_items_count"], 1)

    def test_user_friends_list_non_friend_forbidden(self):
        viewer = User.objects.create_user(email="uf-nf-v@example.com", password="secret12345")
        viewer.account_status = User.AccountStatus.APPROVED
        viewer.save(update_fields=["account_status"])
        target = User.objects.create_user(email="uf-nf-t@example.com", password="secret12345")
        target.account_status = User.AccountStatus.APPROVED
        target.save(update_fields=["account_status"])
        self.client.force_login(viewer)
        resp = self.client.get(f"/api/v1/users/{target.id}/friends/")
        self.assertEqual(resp.status_code, 403)

    def test_user_friends_list_friend_returns_buddies(self):
        viewer = User.objects.create_user(email="uf-v@example.com", password="secret12345")
        viewer.account_status = User.AccountStatus.APPROVED
        viewer.save(update_fields=["account_status"])
        target = User.objects.create_user(email="uf-t@example.com", password="secret12345")
        target.account_status = User.AccountStatus.APPROVED
        target.save(update_fields=["account_status"])
        buddy = User.objects.create_user(email="uf-b@example.com", password="secret12345")
        buddy.account_status = User.AccountStatus.APPROVED
        buddy.save(update_fields=["account_status"])
        FriendRequest.objects.create(requester=viewer, requested=target, is_accepted=True)
        FriendRequest.objects.create(requester=target, requested=viewer, is_accepted=True)
        FriendRequest.objects.create(requester=target, requested=buddy, is_accepted=True)
        FriendRequest.objects.create(requester=buddy, requested=target, is_accepted=True)
        self.client.force_login(viewer)
        resp = self.client.get(f"/api/v1/users/{target.id}/friends/")
        self.assertEqual(resp.status_code, 200)
        rows = resp.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["email"], buddy.email)
        self.assertIn("nickname", rows[0])
        self.assertIn("avatar_url", rows[0])
        self.assertTrue(all(row["email"] != viewer.email for row in rows))

    def test_patch_profile_updates_preferences_and_returns_full_me(self):
        user = User.objects.create_user(email="edit@example.com", password="secret12345")
        user.profile.display_name = "Before"
        user.profile.save()
        self.client.force_login(user)
        response = self.client.patch(
            "/api/v1/users/me/profile/",
            {
                "display_name": "After",
                "timezone": "America/New_York",
                "avatar_url": "https://example.com/p.png",
                "birth_date": "1990-05-17",
                "social_publish_visibility": "friends_only",
                "social_read_scope": "friends_only",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["profile"]["display_name"], "After")
        self.assertEqual(body["profile"]["timezone"], "America/New_York")
        self.assertEqual(body["profile"]["avatar_url"], "https://example.com/p.png")
        self.assertEqual(body["profile"]["birth_date"], "1990-05-17")
        self.assertEqual(body["profile"]["social_publish_visibility"], "friends_only")
        self.assertEqual(body["profile"]["social_read_scope"], "friends_only")
        self.assertIn("meal_partner_incoming_pending", body["profile"])
        self.assertFalse(body["profile"]["meal_partner_incoming_pending"])
        self.assertIn("meal_crud_partner_label", body["profile"])
        self.assertEqual(body["profile"]["meal_crud_partner_label"], "")
        self.assertIn("meal_slot_labels", body["profile"])
        user.profile.refresh_from_db()
        self.assertEqual(user.profile.display_name, "After")
        self.assertEqual(str(user.profile.birth_date), "1990-05-17")
        self.assertEqual(user.profile.social_publish_visibility, "friends_only")
        self.assertEqual(user.profile.social_read_scope, "friends_only")

    def test_patch_profile_allows_clearing_birth_date(self):
        user = User.objects.create_user(email="clear@example.com", password="secret12345")
        user.profile.birth_date = "1990-05-17"
        user.profile.save()
        self.client.force_login(user)
        response = self.client.patch(
            "/api/v1/users/me/profile/",
            {"birth_date": None},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIsNone(body["profile"]["birth_date"])
        user.profile.refresh_from_db()
        self.assertIsNone(user.profile.birth_date)

    def test_patch_profile_rejects_invalid_birth_date(self):
        user = User.objects.create_user(email="invalid@example.com", password="secret12345")
        self.client.force_login(user)
        response = self.client.patch(
            "/api/v1/users/me/profile/",
            {"birth_date": "not-a-date"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertIn("birth_date", body)

    def test_me_includes_meal_crud_partner_label_from_partner_display_name(self):
        viewer = User.objects.create_user(email="meal-view@example.com", password="secret12345")
        partner = User.objects.create_user(email="meal-partner@example.com", password="secret12345")
        partner.profile.display_name = "PartnerNick"
        partner.profile.save()
        viewer.profile.meal_crud_partner_id = partner.id
        viewer.profile.save(update_fields=["meal_crud_partner_id"])
        self.client.force_login(viewer)
        resp = self.client.get("/api/v1/users/me/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["profile"]["meal_crud_partner_label"], "PartnerNick")

    def test_patch_meal_slot_labels_persists(self):
        user = User.objects.create_user(email="slotlabels@example.com", password="secret12345")
        self.client.force_login(user)
        payload = {
            "3": ["Breakfast", "Lunch", "Dinner"],
        }
        resp = self.client.patch(
            "/api/v1/users/me/profile/",
            {"meal_slot_labels": payload},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["profile"]["meal_slot_labels"], payload)
        user.profile.refresh_from_db()
        self.assertEqual(user.profile.meal_slot_labels, payload)

    def test_patch_profile_forbidden_when_anonymous(self):
        response = self.client.patch(
            "/api/v1/users/me/profile/",
            {"display_name": "X"},
            format="json",
        )
        self.assertIn(response.status_code, (401, 403))

    def _approved_user(self, email: str):
        user = User.objects.create_user(email=email, password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save(update_fields=["account_status"])
        return user

    def _make_friends(self, a, b):
        FriendRequest.objects.create(requester=a, requested=b, is_accepted=True)
        FriendRequest.objects.create(requester=b, requested=a, is_accepted=True)

    def test_patch_meal_partner_rejects_when_target_chose_someone_else(self):
        alice = self._approved_user("meal-a@example.com")
        bob = self._approved_user("meal-b@example.com")
        charlie = self._approved_user("meal-c@example.com")
        self._make_friends(alice, bob)
        self._make_friends(alice, charlie)
        bob.profile.meal_crud_partner_id = charlie.id
        bob.profile.save(update_fields=["meal_crud_partner_id"])

        self.client.force_login(alice)
        response = self.client.patch(
            "/api/v1/users/me/profile/",
            {"meal_crud_partner_id": bob.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("another meal partner", response.json()["detail"])

    def test_patch_meal_partner_allows_when_target_chose_requester(self):
        alice = self._approved_user("meal-a2@example.com")
        bob = self._approved_user("meal-b2@example.com")
        self._make_friends(alice, bob)
        bob.profile.meal_crud_partner_id = alice.id
        bob.profile.save(update_fields=["meal_crud_partner_id"])

        self.client.force_login(alice)
        response = self.client.patch(
            "/api/v1/users/me/profile/",
            {"meal_crud_partner_id": bob.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["profile"]["meal_crud_partner_id"], bob.id)

    def test_me_meal_partner_incoming_pending_true_when_friend_chose_me_unreciprocated(self):
        alice = self._approved_user("meal-in@example.com")
        bob = self._approved_user("meal-out@example.com")
        self._make_friends(alice, bob)
        bob.profile.meal_crud_partner_id = alice.id
        bob.profile.save(update_fields=["meal_crud_partner_id"])

        self.client.force_login(alice)
        response = self.client.get("/api/v1/users/me/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["profile"]["meal_partner_incoming_pending"])

    def test_me_meal_partner_incoming_pending_false_when_mutual(self):
        alice = self._approved_user("meal-m1@example.com")
        bob = self._approved_user("meal-m2@example.com")
        self._make_friends(alice, bob)
        alice.profile.meal_crud_partner_id = bob.id
        alice.profile.save(update_fields=["meal_crud_partner_id"])
        bob.profile.meal_crud_partner_id = alice.id
        bob.profile.save(update_fields=["meal_crud_partner_id"])

        self.client.force_login(alice)
        response = self.client.get("/api/v1/users/me/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["profile"]["meal_partner_incoming_pending"])

    @override_settings(CLOSET_R2_KEY_PREFIX="closet", CLOSET_R2_PUBLIC_BASE_URL="https://cdn.example.test")
    def test_patch_profile_accepts_avatar_image_key_for_owner_prefix(self):
        user = User.objects.create_user(email="avatar@example.com", password="secret12345")
        self.client.force_login(user)
        key = f"closet/{user.id}/20240202/a.jpg"
        response = self.client.patch(
            "/api/v1/users/me/profile/",
            {"avatar_image_key": key},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["profile"]["avatar_url"], f"https://cdn.example.test/{key}")

    @override_settings(CLOSET_R2_KEY_PREFIX="closet", CLOSET_R2_PUBLIC_BASE_URL="https://cdn.example.test")
    def test_patch_profile_rejects_avatar_image_key_from_other_user_prefix(self):
        user = User.objects.create_user(email="avatar2@example.com", password="secret12345")
        other = User.objects.create_user(email="other@example.com", password="secret12345")
        self.client.force_login(user)
        key = f"closet/{other.id}/20240202/b.jpg"
        response = self.client.patch(
            "/api/v1/users/me/profile/",
            {"avatar_image_key": key},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("avatar_image_key", response.json())

    def test_approved_check_forbidden_when_pending(self):
        user = User.objects.create_user(email="pend@example.com", password="secret12345")
        self.client.force_login(user)
        response = self.client.get("/api/v1/users/approved-check/")
        self.assertEqual(response.status_code, 403)

    def test_approved_check_ok_when_approved(self):
        user = User.objects.create_user(email="ok@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save()
        self.client.force_login(user)
        response = self.client.get("/api/v1/users/approved-check/")
        self.assertEqual(response.status_code, 200)

    def test_upcoming_birthdays_forbidden_when_pending(self):
        caller = User.objects.create_user(email="pend@example.com", password="secret12345")
        self.client.force_login(caller)
        response = self.client.get("/api/v1/users/upcoming-birthdays/")
        self.assertEqual(response.status_code, 403)

    def test_upcoming_birthdays_returns_only_friends_in_window(self):
        caller = User.objects.create_user(email="caller@example.com", password="secret12345")
        caller.account_status = User.AccountStatus.APPROVED
        caller.save()
        self.client.force_login(caller)

        today = timezone.localdate()

        def accept_pair(a, b):
            FriendRequest.objects.update_or_create(
                requester=a, requested=b, defaults={"is_accepted": True}
            )
            FriendRequest.objects.update_or_create(
                requester=b, requested=a, defaults={"is_accepted": True}
            )

        in_future = User.objects.create_user(
            email="future@example.com", password="secret12345"
        )
        in_future.account_status = User.AccountStatus.APPROVED
        in_future.save()
        in_future.profile.display_name = "FutureNick"
        in_future.profile.birth_date = today + timedelta(days=7)
        in_future.profile.save()
        accept_pair(caller, in_future)

        in_past = User.objects.create_user(email="past@example.com", password="secret12345")
        in_past.account_status = User.AccountStatus.APPROVED
        in_past.save()
        in_past.profile.display_name = "PastNick"
        in_past.profile.birth_date = today - timedelta(days=2)
        in_past.profile.save()
        accept_pair(caller, in_past)

        not_friend_in_window = User.objects.create_user(
            email="strangerbday@example.com", password="secret12345"
        )
        not_friend_in_window.account_status = User.AccountStatus.APPROVED
        not_friend_in_window.save()
        not_friend_in_window.profile.display_name = "StrangerBirthday"
        not_friend_in_window.profile.birth_date = today + timedelta(days=1)
        not_friend_in_window.profile.save()

        out_future = User.objects.create_user(
            email="outfuture@example.com", password="secret12345"
        )
        out_future.account_status = User.AccountStatus.APPROVED
        out_future.save()
        out_future.profile.display_name = "OutFutureNick"
        out_future.profile.birth_date = today + timedelta(days=8)
        out_future.profile.save()
        accept_pair(caller, out_future)

        out_past = User.objects.create_user(
            email="outpast@example.com", password="secret12345"
        )
        out_past.account_status = User.AccountStatus.APPROVED
        out_past.save()
        out_past.profile.display_name = "OutPastNick"
        out_past.profile.birth_date = today - timedelta(days=3)
        out_past.profile.save()
        accept_pair(caller, out_past)

        pending_in_range = User.objects.create_user(
            email="pendingrange@example.com", password="secret12345"
        )
        pending_in_range.profile.display_name = "PendingNick"
        pending_in_range.profile.birth_date = today + timedelta(days=1)
        pending_in_range.profile.save()

        no_birth_date = User.objects.create_user(
            email="nobday@example.com", password="secret12345"
        )
        no_birth_date.account_status = User.AccountStatus.APPROVED
        no_birth_date.save()
        no_birth_date.profile.display_name = "NoBirthDateNick"
        no_birth_date.profile.birth_date = None
        no_birth_date.profile.save()
        accept_pair(caller, no_birth_date)

        response = self.client.get("/api/v1/users/upcoming-birthdays/")
        self.assertEqual(response.status_code, 200)
        body = response.json()

        self.assertEqual([row["display_name"] for row in body], ["PastNick", "FutureNick"])
        self.assertEqual(body[0]["birth_month"], (today - timedelta(days=2)).month)
        self.assertEqual(body[0]["birth_day"], (today - timedelta(days=2)).day)
        self.assertEqual(body[1]["birth_month"], (today + timedelta(days=7)).month)
        self.assertEqual(body[1]["birth_day"], (today + timedelta(days=7)).day)

        for row in body:
            self.assertEqual(set(row.keys()), {"display_name", "birth_month", "birth_day"})
            self.assertNotIn("email", row)
            self.assertNotIn("id", row)
            self.assertNotIn("birth_year", row)

    def test_quotes_health_reachable_under_api_v1(self):
        response = self.client.get("/api/v1/quotes/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["app"], "quotes")

    def test_quote_bulk_import_requires_approved_user(self):
        user = User.objects.create_user(email="bulkpending@example.com", password="secret12345")
        self.client.force_login(user)
        response = self.client.post(
            "/api/v1/quotes/bulk-import/",
            {"text": "One quote"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_quote_bulk_import_splits_on_blank_lines(self):
        user = User.objects.create_user(email="bulkok@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save(update_fields=["account_status"])
        self.client.force_login(user)
        response = self.client.post(
            "/api/v1/quotes/bulk-import/",
            {"text": "Line 1\nLine 2\n\nSecond quote\n\n\nThird quote"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["created_count"], 3)
        self.assertEqual(len(payload["quotes"]), 3)
        self.assertEqual(payload["quotes"][0]["body"], "Line 1\nLine 2")
        self.assertEqual(payload["quotes"][1]["body"], "Second quote")
        self.assertEqual(payload["quotes"][2]["body"], "Third quote")

    def test_whatif_health_reachable_under_api_v1(self):
        response = self.client.get("/api/v1/whatif/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["app"], "whatif")


class StaffApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_staff_endpoints_forbidden_for_non_staff(self):
        user = User.objects.create_user(email="plain@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save()
        self.client.force_login(user)
        for method, path, data in (
            ("get", "/api/v1/users/staff/pending-summary/", None),
            ("get", "/api/v1/users/staff/users/", None),
            ("get", "/api/v1/contact/staff/messages/", None),
            ("post", "/api/v1/contact/staff/messages/acknowledge/", {}),
            ("delete", "/api/v1/contact/staff/messages/1/", None),
            ("patch", "/api/v1/users/staff/users/999/", {"account_status": "approved"}),
        ):
            if method == "get":
                response = self.client.get(path)
            elif method == "post":
                response = self.client.post(path, data or {}, format="json")
            elif method == "delete":
                response = self.client.delete(path)
            else:
                response = self.client.patch(path, data, format="json")
            self.assertEqual(response.status_code, 403, msg=f"{method.upper()} {path}")

    def test_staff_pending_summary_counts(self):
        staff = User.objects.create_user(
            email="staff@example.com", password="secret12345", is_staff=True
        )
        staff.account_status = User.AccountStatus.APPROVED
        staff.save()
        User.objects.create_user(email="pend1@example.com", password="secret12345")
        User.objects.create_user(email="pend2@example.com", password="secret12345")
        WhatIfQuestion.objects.create(
            prompt="Q?",
            answer_1="a1",
            answer_2="a2",
            answer_3="a3",
            answer_4="a4",
            answer_5="a5",
            answer_6="a6",
            review_status=WhatIfQuestion.ReviewStatus.PENDING,
            is_active=False,
        )
        self.client.force_login(staff)
        response = self.client.get("/api/v1/users/staff/pending-summary/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["pending_members"], 2)
        self.assertEqual(body["pending_whatif_questions"], 1)
        self.assertEqual(body["contact_messages_count"], 0)
        self.assertIsNone(body["latest_contact_message_id"])
        self.assertEqual(body["pending_zodiac_charts"], 0)

        sender = User.objects.create_user(email="cm@example.com", password="secret12345")
        sender.account_status = User.AccountStatus.APPROVED
        sender.save()
        cm = ContactMessage.objects.create(from_user=sender, message="Hi")
        response2 = self.client.get("/api/v1/users/staff/pending-summary/")
        body2 = response2.json()
        self.assertEqual(body2["contact_messages_count"], 1)
        self.assertEqual(body2["latest_contact_message_id"], cm.id)

        ack = self.client.post("/api/v1/contact/staff/messages/acknowledge/", {}, format="json")
        self.assertEqual(ack.status_code, 200)
        self.assertEqual(ack.json()["updated"], 1)
        response3 = self.client.get("/api/v1/users/staff/pending-summary/")
        body3 = response3.json()
        self.assertEqual(body3["contact_messages_count"], 0)
        self.assertIsNone(body3["latest_contact_message_id"])

    def test_staff_users_list_and_patch(self):
        staff = User.objects.create_user(
            email="staff@example.com", password="secret12345", is_staff=True
        )
        staff.account_status = User.AccountStatus.APPROVED
        staff.save()
        target = User.objects.create_user(email="target@example.com", password="secret12345")
        self.client.force_login(staff)
        list_res = self.client.get("/api/v1/users/staff/users/")
        self.assertEqual(list_res.status_code, 200)
        rows = list_res.json()
        self.assertTrue(any(r["email"] == "target@example.com" for r in rows))
        patch_res = self.client.patch(
            f"/api/v1/users/staff/users/{target.id}/",
            {"account_status": "approved"},
            format="json",
        )
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.json()["account_status"], "approved")
        target.refresh_from_db()
        self.assertEqual(target.account_status, User.AccountStatus.APPROVED)

    def test_staff_cannot_patch_own_account_status(self):
        staff = User.objects.create_user(
            email="staff@example.com", password="secret12345", is_staff=True
        )
        staff.account_status = User.AccountStatus.APPROVED
        staff.save()
        self.client.force_login(staff)
        response = self.client.patch(
            f"/api/v1/users/staff/users/{staff.id}/",
            {"account_status": "suspended"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)


class UserVisibilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_me_never_exposes_another_accounts_identity(self):
        alice = User.objects.create_user(email="alice@example.com", password="secret12345")
        User.objects.create_user(email="bob@example.com", password="secret12345")
        self.client.force_login(alice)
        response = self.client.get("/api/v1/users/me/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["user"]["email"], "alice@example.com")
        self.assertEqual(body["user"]["id"], alice.id)
        self.assertNotIn("bob@example.com", str(body))


class InboxBootstrapPayloadTests(TestCase):
    """Shape tests for shell inbox bundled into POST /api/v1/users/bootstrap/."""

    def test_inbox_bootstrap_payload_approved_shape(self):
        from users.views import inbox_bootstrap_payload

        user = User.objects.create_user(email="ibp@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save()
        req = RequestFactory().post("/api/v1/users/bootstrap/")
        req.user = user
        payload = inbox_bootstrap_payload(req)
        self.assertIsInstance(payload["upcoming_birthdays"], list)
        self.assertEqual(payload["pending_friend_count"], 0)
        self.assertEqual(payload["closet"]["outstanding_actions_count"], 0)
        self.assertIsNone(payload["staff_pending_summary"])

    def test_inbox_bootstrap_payload_staff_includes_summary(self):
        from users.views import inbox_bootstrap_payload

        user = User.objects.create_user(email="ibp2@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.is_staff = True
        user.save()
        req = RequestFactory().post("/")
        req.user = user
        payload = inbox_bootstrap_payload(req)
        summary = payload["staff_pending_summary"]
        self.assertIsNotNone(summary)
        self.assertIn("pending_members", summary)
        self.assertIn("contact_messages_count", summary)
        self.assertIn("pending_zodiac_charts", summary)

    def test_bootstrap_session_updates_last_login(self):
        user = User.objects.create_user(email="boot@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.last_login = None
        user.save(update_fields=["account_status", "last_login"])
        client = APIClient()
        client.force_authenticate(user=user)
        before = timezone.now()
        response = client.post("/api/v1/users/bootstrap/")
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertIsNotNone(user.last_login)
        self.assertGreaterEqual(user.last_login, before)


class SpaRoutingTests(TestCase):
    def test_spa_index_accepts_catch_all_route_kwarg(self):
        request = RequestFactory().get("/quotes")
        try:
            response = spa_index(request, route="quotes")
        except Http404:
            # Valid in environments where frontend build artifacts are absent.
            return
        except TypeError as exc:
            self.fail(f"spa_index should accept catch-all route kwarg: {exc}")

        # Valid in environments where frontend build artifacts are present.
        self.assertEqual(response.status_code, 200)
        self.assertIn(
            "no-store",
            response["Cache-Control"],
            msg="HTML shell must not be long-cached at CDN (stale index vs new /static/ chunks).",
        )
