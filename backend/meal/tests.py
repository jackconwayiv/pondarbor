from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.test import TestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from friends.models import FriendRequest
from meal.models import MealPartnerDisconnectRequest
from meal.grocery_amounts import build_merged_grocery_display_text, combine_quantities_for_headline
from meal.paprika_import import iter_paprika_recipes_from_bytes
from meal.recipe_import import (
    extract_recipe_from_html,
    ingredient_product_name,
    parse_amount_to_float,
    parse_ingredient_line,
    validate_http_url,
)
from users.models import Profile

User = get_user_model()


class MealAuthorizationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def _approved_user(self, email: str):
        user = User.objects.create_user(email=email, password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save(update_fields=["account_status"])
        return user

    def _make_friends(self, a, b):
        FriendRequest.objects.create(requester=a, requested=b, is_accepted=True)
        FriendRequest.objects.create(requester=b, requested=a, is_accepted=True)

    def _as(self, user):
        self.client.force_login(user)

    def test_non_partner_cannot_crud_or_view_other_users_meal_objects(self):
        owner = self._approved_user("meal-owner@example.com")
        other = self._approved_user("meal-other@example.com")

        self._as(owner)
        meal = self.client.post(
            "/api/v1/meal/meals/",
            {
                "title": "Owner meal",
                "blurb": "x",
                "directions": "y",
                "ingredients": [{"position": 0, "raw_line": "1 onion"}],
            },
            format="json",
        ).json()
        template = self.client.post(
            "/api/v1/meal/templates/",
            {"name": "Owner template", "description": "", "slots_per_day": 3},
            format="json",
        ).json()
        instance = self.client.post(
            "/api/v1/meal/instances/",
            {"template_id": template["id"], "week_start": "2026-04-06"},
            format="json",
        ).json()
        grocery = self.client.post(
            f"/api/v1/meal/instances/{instance['id']}/grocery/generate/",
            {},
            format="json",
        ).json()

        self._as(other)

        self.assertEqual(self.client.get("/api/v1/meal/meals/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/meal/meals/").json(), [])
        self.assertEqual(self.client.get(f"/api/v1/meal/meals/{meal['id']}/").status_code, 404)
        self.assertEqual(
            self.client.patch(
                f"/api/v1/meal/meals/{meal['id']}/",
                {"title": "hijack"},
                format="json",
            ).status_code,
            404,
        )
        self.assertEqual(self.client.delete(f"/api/v1/meal/meals/{meal['id']}/").status_code, 404)

        self.assertEqual(self.client.get(f"/api/v1/meal/templates/{template['id']}/").status_code, 404)
        self.assertEqual(
            self.client.patch(
                f"/api/v1/meal/templates/{template['id']}/",
                {"name": "hijack"},
                format="json",
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.patch(
                f"/api/v1/meal/templates/{template['id']}/grid/",
                {"slots": [{"day_index": 0, "slot_index": 0, "meal_ids": []}]},
                format="json",
            ).status_code,
            404,
        )
        self.assertEqual(self.client.delete(f"/api/v1/meal/templates/{template['id']}/").status_code, 404)

        self.assertEqual(self.client.get(f"/api/v1/meal/instances/{instance['id']}/").status_code, 404)
        self.assertEqual(
            self.client.patch(
                f"/api/v1/meal/instances/{instance['id']}/grid/",
                {"slots": [{"day_index": 0, "slot_index": 0, "meal_ids": []}]},
                format="json",
            ).status_code,
            404,
        )
        self.assertEqual(self.client.delete(f"/api/v1/meal/instances/{instance['id']}/").status_code, 404)
        self.assertEqual(
            self.client.post(
                f"/api/v1/meal/instances/{instance['id']}/grocery/generate/",
                {},
                format="json",
            ).status_code,
            404,
        )
        self.assertEqual(self.client.get(f"/api/v1/meal/grocery/{grocery['id']}/").status_code, 404)
        self.assertEqual(
            self.client.get(f"/api/v1/meal/instances/{instance['id']}/grocery/").status_code,
            404,
        )

    def test_instance_grocery_retrieve_and_hide_checked_patch(self):
        owner = self._approved_user("grocery-instance-get@example.com")
        self._as(owner)
        template = self.client.post(
            "/api/v1/meal/templates/",
            {"name": "T", "description": "", "slots_per_day": 3},
            format="json",
        ).json()
        instance = self.client.post(
            "/api/v1/meal/instances/",
            {"template_id": template["id"], "week_start": "2026-04-06"},
            format="json",
        ).json()
        self.assertEqual(
            self.client.get(f"/api/v1/meal/instances/{instance['id']}/grocery/").status_code,
            404,
        )
        grocery = self.client.post(
            f"/api/v1/meal/instances/{instance['id']}/grocery/generate/",
            {},
            format="json",
        ).json()
        r = self.client.get(f"/api/v1/meal/instances/{instance['id']}/grocery/")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["id"], grocery["id"])
        self.assertFalse(body.get("hide_checked", False))
        p = self.client.patch(
            f"/api/v1/meal/grocery/{grocery['id']}/",
            {"hide_checked": True},
            format="json",
        )
        self.assertEqual(p.status_code, 200)
        self.assertTrue(p.json()["hide_checked"])
        r2 = self.client.get(f"/api/v1/meal/instances/{instance['id']}/grocery/")
        self.assertTrue(r2.json()["hide_checked"])

    def test_grid_rejects_cross_scope_meal_ids(self):
        owner = self._approved_user("grid-owner@example.com")
        other = self._approved_user("grid-other@example.com")

        self._as(owner)
        template = self.client.post(
            "/api/v1/meal/templates/",
            {"name": "Owner template", "description": "", "slots_per_day": 3},
            format="json",
        ).json()

        self._as(other)
        outsider_meal = self.client.post(
            "/api/v1/meal/meals/",
            {"title": "Other meal", "blurb": "", "directions": "", "ingredients": []},
            format="json",
        ).json()
        self.assertEqual(
            self.client.patch(
                f"/api/v1/meal/templates/{template['id']}/grid/",
                {"slots": [{"day_index": 0, "slot_index": 0, "meal_ids": [outsider_meal['id']]}]},
                format="json",
            ).status_code,
            404,
        )

        self._as(owner)
        owner_instance = self.client.post(
            "/api/v1/meal/instances/",
            {"template_id": template["id"], "week_start": "2026-04-13"},
            format="json",
        ).json()
        grid_resp = self.client.patch(
            f"/api/v1/meal/instances/{owner_instance['id']}/grid/",
            {"slots": [{"day_index": 0, "slot_index": 0, "meal_ids": [outsider_meal['id']]}]},
            format="json",
        )
        self.assertEqual(grid_resp.status_code, 400)
        self.assertIn(
            "One or more meals are not accessible.",
            str(grid_resp.json()),
        )

    def test_mutual_partner_can_access_but_one_way_cannot(self):
        alice = self._approved_user("pair-a@example.com")
        bob = self._approved_user("pair-b@example.com")
        carol = self._approved_user("pair-c@example.com")
        self._make_friends(alice, bob)
        self._make_friends(alice, carol)

        self._as(alice)
        meal = self.client.post(
            "/api/v1/meal/meals/",
            {"title": "Alice meal", "blurb": "", "directions": "", "ingredients": []},
            format="json",
        ).json()

        carol.profile.meal_crud_partner_id = alice.id
        carol.profile.save(update_fields=["meal_crud_partner_id"])
        self._as(carol)
        self.assertEqual(self.client.get(f"/api/v1/meal/meals/{meal['id']}/").status_code, 404)

        alice.profile.meal_crud_partner_id = bob.id
        alice.profile.save(update_fields=["meal_crud_partner_id"])
        bob.profile.meal_crud_partner_id = alice.id
        bob.profile.save(update_fields=["meal_crud_partner_id"])

        self._as(bob)
        self.assertEqual(self.client.get(f"/api/v1/meal/meals/{meal['id']}/").status_code, 200)
        self.assertEqual(
            self.client.patch(
                f"/api/v1/meal/meals/{meal['id']}/",
                {"title": "Bob edited"},
                format="json",
            ).status_code,
            200,
        )

    def test_unapproved_user_is_forbidden_on_meal_endpoints(self):
        pending = User.objects.create_user(email="pending-meal@example.com", password="secret12345")
        self._as(pending)
        self.assertEqual(self.client.get("/api/v1/meal/meals/").status_code, 403)

    def test_decline_incoming_partner_request_clears_requester_selection(self):
        requester = self._approved_user("decline-requester@example.com")
        recipient = self._approved_user("decline-recipient@example.com")
        self._make_friends(requester, recipient)
        requester.profile.meal_crud_partner_id = recipient.id
        requester.profile.save(update_fields=["meal_crud_partner_id"])

        self._as(recipient)
        response = self.client.post(
            "/api/v1/meal/partner/request/decline/",
            {"requester_id": requester.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        requester.profile.refresh_from_db()
        self.assertIsNone(requester.profile.meal_crud_partner_id)

    def test_decline_incoming_partner_request_rejects_non_incoming(self):
        requester = self._approved_user("decline-none-requester@example.com")
        recipient = self._approved_user("decline-none-recipient@example.com")
        self._make_friends(requester, recipient)

        self._as(recipient)
        response = self.client.post(
            "/api/v1/meal/partner/request/decline/",
            {"requester_id": requester.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_confirm_disconnect_deletes_all_disconnect_requests_between_users(self):
        alice = self._approved_user("disconnect-a@example.com")
        bob = self._approved_user("disconnect-b@example.com")
        self._make_friends(alice, bob)

        alice.profile.meal_crud_partner_id = bob.id
        alice.profile.save(update_fields=["meal_crud_partner_id"])
        bob.profile.meal_crud_partner_id = alice.id
        bob.profile.save(update_fields=["meal_crud_partner_id"])

        MealPartnerDisconnectRequest.objects.create(
            initiator=alice,
            recipient=bob,
            status=MealPartnerDisconnectRequest.Status.PENDING,
        )
        MealPartnerDisconnectRequest.objects.create(
            initiator=bob,
            recipient=alice,
            status=MealPartnerDisconnectRequest.Status.CANCELLED,
        )
        MealPartnerDisconnectRequest.objects.create(
            initiator=alice,
            recipient=bob,
            status=MealPartnerDisconnectRequest.Status.COMPLETED,
        )

        self._as(bob)
        response = self.client.post("/api/v1/meal/partner/disconnect/confirm/", {}, format="json")
        self.assertEqual(response.status_code, 200)

        alice.profile.refresh_from_db()
        bob.profile.refresh_from_db()
        self.assertIsNone(alice.profile.meal_crud_partner_id)
        self.assertIsNone(bob.profile.meal_crud_partner_id)
        self.assertFalse(
            MealPartnerDisconnectRequest.objects.filter(
                Q(initiator=alice, recipient=bob) | Q(initiator=bob, recipient=alice)
            ).exists()
        )
        self.assertFalse(
            Profile.objects.filter(
                user_id__in=[alice.id, bob.id],
                meal_crud_partner_id__in=[alice.id, bob.id],
            ).exists()
        )


class RecipeImportTests(TestCase):
    def test_parse_ingredient_line_structured(self):
        r = parse_ingredient_line("2 cups all-purpose flour")
        self.assertEqual(r["raw_line"], "2 cups all-purpose flour")
        self.assertEqual(r["amount"], "2")
        self.assertEqual(r["unit"], "cups")
        self.assertEqual(r["name"], "all-purpose flour")

    def test_parse_ingredient_line_plain(self):
        r = parse_ingredient_line("Salt and pepper to taste")
        self.assertEqual(r["raw_line"], "Salt and pepper to taste")
        self.assertEqual(r["amount"], "")
        self.assertEqual(r["unit"], "")

    def test_ingredient_product_name_strips_leading_count(self):
        self.assertEqual(ingredient_product_name("1 Hash Browns"), "Hash Browns")
        self.assertEqual(ingredient_product_name("2 cups flour"), "flour")

    def test_parse_amount_mixed_fractions(self):
        self.assertEqual(parse_amount_to_float("1 1/2"), 1.5)
        self.assertEqual(parse_amount_to_float("1½"), 1.5)

    def test_grocery_merge_count_and_volume(self):
        hb = {
            "display": "1 Hash Browns",
            "raw_line": "1 Hash Browns",
            "quantity": "",
            "unit": "",
            "name": "",
        }
        self.assertEqual(
            build_merged_grocery_display_text(n=2, ing_obj=None, contribs=[hb, dict(hb)]),
            "2 Hash Browns",
        )
        salt = [
            {"display": "1 tsp salt", "raw_line": "1 tsp salt", "quantity": "1", "unit": "tsp", "name": ""},
            {"display": "1 Tbsp salt", "raw_line": "1 Tbsp salt", "quantity": "1", "unit": "tbsp", "name": ""},
        ]
        self.assertEqual(combine_quantities_for_headline(salt), "1 Tbsp + 1 tsp")
        self.assertEqual(
            build_merged_grocery_display_text(n=2, ing_obj=None, contribs=salt),
            "1 Tbsp + 1 tsp salt",
        )

    def test_extract_from_json_ld_graph(self):
        html = """<!DOCTYPE html><html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {"@type": "WebSite", "name": "X"},
    {
      "@type": "Recipe",
      "name": "Graph Salad",
      "description": "A nice salad.",
      "recipeIngredient": ["2 cups greens", "1 tbsp oil"],
      "recipeInstructions": [
        {"@type": "HowToStep", "text": "Toss."},
        {"@type": "HowToStep", "text": "Serve."}
      ]
    }
  ]
}
</script></head><body></body></html>"""
        data = extract_recipe_from_html(html, "https://example.com/recipe")
        self.assertEqual(data["title"], "Graph Salad")
        self.assertIn("nice", data["blurb"].lower())
        self.assertIn("Toss", data["directions"])
        self.assertEqual(len(data["ingredients"]), 2)
        self.assertEqual(data["canonical_url"], "https://example.com/recipe")

    def test_validate_http_url_rejects_loopback(self):
        with self.assertRaises(ValidationError):
            validate_http_url("http://127.0.0.1/recipe")

    def test_iter_paprika_zip_one_recipe(self):
        import gzip
        import io
        import json
        import zipfile

        inner = {
            "name": "ZipTest",
            "ingredients": "1 egg",
            "directions": "Cook.",
            "source_url": "https://example.com/r",
        }
        buf = io.BytesIO()
        gz = gzip.compress(json.dumps(inner).encode("utf-8"))
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("T.paprikarecipe", gz)
        data = buf.getvalue()
        recs = iter_paprika_recipes_from_bytes(data=data, filename="bulk.paprikarecipes")
        self.assertEqual(len(recs), 1)
        self.assertEqual(recs[0]["name"], "ZipTest")

    def test_directions_preserve_line_breaks_in_plain_text(self):
        html = """<!DOCTYPE html><html><head>
<script type="application/ld+json">
{
  "@type": "Recipe",
  "name": "Line Test",
  "recipeIngredient": ["1 x"],
  "recipeInstructions": "Step one here.\\n\\n  Step two with indent.\\nStep three."
}
</script></head><body></body></html>"""
        data = extract_recipe_from_html(html, "https://example.com/r")
        self.assertIn("\n\n", data["directions"])
        self.assertIn("  Step two", data["directions"])

    @patch("meal.views.validate_http_url", return_value="https://example.org/soup")
    @patch("meal.views.fetch_recipe_html")
    def test_meal_import_from_url_endpoint(self, mock_fetch, _mock_validate):
        user = User.objects.create_user(email="import@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save(update_fields=["account_status"])
        html = """<html><head><script type="application/ld+json">
        {"@type": "Recipe", "name": "API Soup", "recipeIngredient": ["1 cup water"]}
        </script></head><body></body></html>"""
        mock_fetch.return_value = (html, "https://example.org/soup")
        self.client.force_login(user)
        r = self.client.post(
            "/api/v1/meal/meals/import/",
            {"url": "https://example.org/soup"},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        body = r.json()
        self.assertEqual(body["title"], "API Soup")
        self.assertEqual(body["source_url"], "https://example.org/soup")
        self.assertEqual(len(body["ingredients"]), 1)
