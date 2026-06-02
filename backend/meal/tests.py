from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.test import TestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from friends.models import FriendRequest
from meal.models import MealPartnerDisconnectRequest, MealPlanInstanceSlot, MealPlanInstanceSlotMeal
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
        instance = self.client.post(
            "/api/v1/meal/instances/",
            {"week_start": "2026-04-06"},
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
        instance = self.client.post(
            "/api/v1/meal/instances/",
            {"week_start": "2026-04-06"},
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
        owner_instance = self.client.post(
            "/api/v1/meal/instances/",
            {"week_start": "2026-04-13"},
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
                f"/api/v1/meal/instances/{owner_instance['id']}/grid/",
                {"slots": [{"day_index": 0, "slot_index": 0, "meal_ids": [outsider_meal['id']]}]},
                format="json",
            ).status_code,
            404,
        )

        self._as(owner)
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


class PantryImportTests(TestCase):
    def test_section_header_detection(self):
        from meal.pantry_import import is_section_header

        self.assertTrue(is_section_header("CHEST FREEZER"))
        self.assertTrue(is_section_header("KITCHEN FREEZER"))
        self.assertFalse(is_section_header("2 lb shrimp"))
        self.assertFalse(is_section_header("Box of Par baked French baguettes"))

    def test_parse_line_shrimp(self):
        from meal.pantry_import import parse_pantry_line

        item = parse_pantry_line("2 lb shrimp")
        self.assertEqual(item.name, "shrimp")
        self.assertEqual(item.quantity, 2)
        self.assertEqual(item.location, "")

    def test_parse_line_okra(self):
        from meal.pantry_import import parse_pantry_line

        item = parse_pantry_line("1 open bag of okra")
        self.assertEqual(item.name, "okra")
        self.assertEqual(item.quantity, 1)

    def test_parse_line_box_without_number(self):
        from meal.pantry_import import parse_pantry_line

        item = parse_pantry_line("Box of Par baked French baguettes")
        self.assertEqual(item.name, "Par baked French baguettes")
        self.assertEqual(item.quantity, 1)

    def test_parse_text_locations_and_merge(self):
        from meal.pantry_import import parse_pantry_text

        text = """CHEST FREEZER
2 bags sweet corn
1 bag sweet corn
KITCHEN FREEZER
2 bags sweet corn
1 lb chicken thighs"""
        items = parse_pantry_text(text)
        importable = [it for it in items if not it.skipped and not it.is_section_header]
        self.assertEqual(len(importable), 3)
        chest = next(it for it in importable if it.location == "Chest Freezer")
        kitchen_corn = next(
            it for it in importable if it.location == "Kitchen Freezer" and it.name == "sweet corn"
        )
        kitchen_chicken = next(
            it for it in importable if it.location == "Kitchen Freezer" and it.name == "chicken thighs"
        )
        self.assertEqual(chest.name, "sweet corn")
        self.assertEqual(chest.quantity, 3)
        self.assertEqual(kitchen_corn.quantity, 2)
        self.assertEqual(kitchen_chicken.quantity, 1)

    def test_pantry_import_endpoint(self):
        from meal.models import Ingredient, UserIngredientInventory

        user = User.objects.create_user(email="pantry@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save(update_fields=["account_status"])
        self.client.force_login(user)
        text = """CHEST FREEZER
2 lb shrimp
1 open bag of okra"""
        r = self.client.post(
            "/api/v1/meal/pantry/inventory/import/",
            {"text": text, "merge": "set"},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        body = r.json()
        self.assertEqual(body["imported"], 2)
        self.assertTrue(Ingredient.objects.filter(owner_user=user, name__iexact="shrimp").exists())
        self.assertTrue(Ingredient.objects.filter(owner_user=user, name__iexact="okra").exists())
        shrimp_row = UserIngredientInventory.objects.get(
            owner_user=user,
            ingredient__name__iexact="shrimp",
            location="Chest Freezer",
        )
        self.assertEqual(shrimp_row.quantity, 2)

    def test_pantry_parse_endpoint(self):
        user = User.objects.create_user(email="parse@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save(update_fields=["account_status"])
        self.client.force_login(user)
        r = self.client.post(
            "/api/v1/meal/pantry/inventory/parse/",
            {"text": "3 Frozen pizzas"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        items = [it for it in r.json()["items"] if not it.get("skipped")]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["name"], "Frozen pizzas")
        self.assertEqual(items[0]["quantity"], 3)


class PantryTagsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="pantry-tags@example.com", password="secret12345")
        self.user.account_status = User.AccountStatus.APPROVED
        self.user.save(update_fields=["account_status"])
        self.client.force_login(self.user)

    def test_upsert_and_list_pantry_tags(self):
        from meal.models import Ingredient

        ing = Ingredient.objects.create(owner_user=self.user, name="Salmon")
        r = self.client.put(
            "/api/v1/meal/pantry/inventory/upsert/",
            {
                "ingredient_id": ing.id,
                "quantity": 2,
                "location": "Kitchen Freezer",
                "pantry_tags": {
                    "food_group": ["protein", "protein"],
                    "storage": ["freezer"],
                    "preferred_meal": ["dinner"],
                    "dietary": ["gluten-free"],
                    "bogus": ["ignored"],
                },
            },
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        body = r.json()
        self.assertEqual(body["pantry_tags"]["food_group"], ["protein"])
        self.assertEqual(body["pantry_tags"]["storage"], ["freezer"])
        self.assertEqual(body["pantry_tags"]["preferred_meal"], ["dinner"])
        self.assertEqual(body["pantry_tags"]["dietary"], ["gluten-free"])

        listed = self.client.get("/api/v1/meal/pantry/inventory/")
        self.assertEqual(listed.status_code, 200)
        row = next(it for it in listed.json() if it["id"] == body["id"])
        self.assertEqual(row["pantry_tags"]["food_group"], ["protein"])


class PantryStaplesTests(TestCase):
    def test_assumed_staples_match(self):
        from meal.pantry_staples import is_assumed_pantry_staple

        self.assertTrue(is_assumed_pantry_staple("salt"))
        self.assertTrue(is_assumed_pantry_staple("kosher salt"))
        self.assertTrue(is_assumed_pantry_staple("extra virgin olive oil"))
        self.assertTrue(is_assumed_pantry_staple("2 tbsp olive oil"))
        self.assertTrue(is_assumed_pantry_staple("unsalted butter"))
        self.assertTrue(is_assumed_pantry_staple("black pepper"))

    def test_fresh_pepper_not_staple(self):
        from meal.pantry_staples import is_assumed_pantry_staple

        self.assertFalse(is_assumed_pantry_staple("bell pepper"))
        self.assertFalse(is_assumed_pantry_staple("green pepper"))

    def test_staples_make_meal_can_make_without_pantry_rows(self):
        from meal.models import Ingredient, Meal, MealIngredient, UserIngredientInventory
        from meal.pantry_recipes import match_meals_to_pantry

        user = User.objects.create_user(email="staples@example.com", password="secret12345")
        pasta_ing = Ingredient.objects.create(owner_user=user, name="pasta")
        meal = Meal.objects.create(owner_user=user, title="Simple pasta")
        MealIngredient.objects.create(
            meal=meal,
            position=0,
            raw_line="1 lb pasta",
            name="pasta",
            ingredient_id=pasta_ing.id,
        )
        MealIngredient.objects.create(meal=meal, position=1, raw_line="salt", name="salt")
        MealIngredient.objects.create(meal=meal, position=2, raw_line="olive oil", name="olive oil")
        UserIngredientInventory.objects.create(
            owner_user=user,
            ingredient=pasta_ing,
            quantity=1,
        )
        can_make, almost = match_meals_to_pantry(
            meals=[meal],
            available_ingredient_ids={pasta_ing.id},
        )
        self.assertEqual(len(can_make), 1)
        self.assertEqual(can_make[0].title, "Simple pasta")
        self.assertEqual(len(almost), 0)


class PantryRecipeMatchTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="pantry-recipes@example.com", password="secret12345")
        self.user.account_status = User.AccountStatus.APPROVED
        self.user.save(update_fields=["account_status"])
        profile, _ = Profile.objects.get_or_create(user=self.user)
        profile.meal_pantry_enabled = True
        profile.save(update_fields=["meal_pantry_enabled"])
        self.client.force_login(self.user)

    def _ingredient(self, name: str):
        from meal.models import Ingredient

        return Ingredient.objects.create(owner_user=self.user, name=name)

    def _meal(self, title: str, lines: list[str]):
        from meal.models import Meal

        r = self.client.post(
            "/api/v1/meal/meals/",
            {
                "title": title,
                "ingredients": [{"raw_line": line} for line in lines],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        return Meal.objects.get(pk=r.json()["id"])

    def test_pantry_recipes_can_make_and_almost_make(self):
        from meal.models import UserIngredientInventory

        crepes = self._meal("Crepes", ["1 cup flour", "2 eggs", "1 cup milk"])
        shortbread = self._meal("Shortbread", ["1 cup flour", "1 cup sugar", "1 cup butter"])
        self._meal("Too many gaps", ["saffron", "truffle", "caviar", "foie gras", "wagyu beef"])

        for line in crepes.ingredients.all():
            if line.ingredient_id:
                UserIngredientInventory.objects.create(
                    owner_user=self.user,
                    ingredient_id=line.ingredient_id,
                    quantity=1,
                )
        flour_line = shortbread.ingredients.filter(name__icontains="flour").first() or shortbread.ingredients.first()
        if flour_line and flour_line.ingredient_id:
            UserIngredientInventory.objects.get_or_create(
                owner_user=self.user,
                ingredient_id=flour_line.ingredient_id,
                location="",
                defaults={"quantity": 1},
            )

        r = self.client.get("/api/v1/meal/pantry/recipes/")
        self.assertEqual(r.status_code, 200, r.content)
        body = r.json()
        self.assertTrue(body["enabled"])
        can_titles = {m["title"] for m in body["can_make"]}
        almost = {m["title"]: m for m in body["almost_make"]}
        self.assertIn("Crepes", can_titles)
        # Butter is an assumed staple; only sugar is missing for shortbread.
        self.assertIn("Shortbread", almost)
        self.assertEqual(almost["Shortbread"]["missing_count"], 1)
        missing_names = {m["name"].casefold() for m in almost["Shortbread"]["missing_ingredients"]}
        self.assertIn("sugar", missing_names)
        self.assertNotIn("Too many gaps", almost)
        self.assertNotIn("Too many gaps", can_titles)

    def test_pantry_recipes_disabled_when_pantry_off(self):
        profile = Profile.objects.get(user=self.user)
        profile.meal_pantry_enabled = False
        profile.save(update_fields=["meal_pantry_enabled"])
        r = self.client.get("/api/v1/meal/pantry/recipes/")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["enabled"])


class PantryPartnerSharingTests(TestCase):
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

    def _mutual_partners(self, a, b):
        pa, _ = Profile.objects.get_or_create(user=a)
        pb, _ = Profile.objects.get_or_create(user=b)
        pa.meal_crud_partner_id = b.id
        pb.meal_crud_partner_id = a.id
        pa.save(update_fields=["meal_crud_partner_id"])
        pb.save(update_fields=["meal_crud_partner_id"])

    def test_partner_sees_and_edits_shared_pantry_rows(self):
        from meal.models import Ingredient, UserIngredientInventory

        alice = self._approved_user("pantry-alice@example.com")
        bob = self._approved_user("pantry-bob@example.com")
        self._make_friends(alice, bob)
        self._mutual_partners(alice, bob)

        ing = Ingredient.objects.create(owner_user=alice, name="Shared rice")
        row = UserIngredientInventory.objects.create(
            owner_user=alice,
            ingredient=ing,
            quantity=2,
            location="Pantry shelf",
        )

        self.client.force_login(bob)
        listed = self.client.get("/api/v1/meal/pantry/inventory/")
        self.assertEqual(listed.status_code, 200, listed.content)
        ids = {it["id"] for it in listed.json()}
        self.assertIn(row.id, ids)
        partner_row = next(it for it in listed.json() if it["id"] == row.id)
        self.assertTrue(partner_row["owner_label"])

        updated = self.client.put(
            "/api/v1/meal/pantry/inventory/upsert/",
            {"inventory_id": row.id, "quantity": 5, "location": "Pantry shelf"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.content)
        self.assertEqual(updated.json()["quantity"], 5)

    def test_non_partner_cannot_edit_partner_pantry_row(self):
        from meal.models import Ingredient, UserIngredientInventory

        owner = self._approved_user("pantry-owner2@example.com")
        other = self._approved_user("pantry-other2@example.com")
        ing = Ingredient.objects.create(owner_user=owner, name="Private beans")
        row = UserIngredientInventory.objects.create(
            owner_user=owner,
            ingredient=ing,
            quantity=1,
        )
        self.client.force_login(other)
        r = self.client.put(
            "/api/v1/meal/pantry/inventory/upsert/",
            {"inventory_id": row.id, "quantity": 9},
            format="json",
        )
        self.assertEqual(r.status_code, 403)


class MealTagSeedTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="tag-seed@example.com", password="secret12345")
        self.user.account_status = User.AccountStatus.APPROVED
        self.user.save(update_fields=["account_status"])
        self.client.force_login(self.user)

    def test_meal_tag_seed_creates_vocab(self):
        r = self.client.post(
            "/api/v1/meal/meals/tags/seed/",
            {"tags": ["Vegan", "Gluten-free"]},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIn("Vegan", r.json()["tags"])
        listed = self.client.get("/api/v1/meal/meals/tags/")
        self.assertIn("Gluten-free", listed.json()["tags"])


class MealGridSlotPreservationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="grid-slots@example.com", password="secret12345")
        self.user.account_status = User.AccountStatus.APPROVED
        self.user.save(update_fields=["account_status"])
        self.client.force_login(self.user)
        self.profile = Profile.objects.get(user=self.user)
        self.profile.meal_slots_per_day = 5
        self.profile.save(update_fields=["meal_slots_per_day"])

    def test_shrink_slots_hides_rows_without_deleting_assignments(self):
        meal = self.client.post(
            "/api/v1/meal/meals/",
            {
                "title": "Late snack",
                "blurb": "",
                "directions": "",
                "ingredients": [{"position": 0, "raw_line": "crackers"}],
            },
            format="json",
        ).json()
        instance = self.client.post(
            "/api/v1/meal/instances/",
            {"week_start": "2026-04-06"},
            format="json",
        ).json()
        self.assertEqual(
            self.client.patch(
                f"/api/v1/meal/instances/{instance['id']}/grid/",
                {"slots": [{"day_index": 0, "slot_index": 4, "meal_ids": [meal["id"]]}]},
                format="json",
            ).status_code,
            200,
        )

        hidden_slot = MealPlanInstanceSlot.objects.get(
            instance_id=instance["id"],
            day_index=0,
            slot_index=4,
        )
        self.assertTrue(
            MealPlanInstanceSlotMeal.objects.filter(slot=hidden_slot, meal_id=meal["id"]).exists()
        )

        self.profile.meal_slots_per_day = 3
        self.profile.save(update_fields=["meal_slots_per_day"])
        from meal.grid import rebuild_all_instances_for_user

        rebuild_all_instances_for_user(owner=self.user, slots_per_day=3)

        self.assertTrue(
            MealPlanInstanceSlot.objects.filter(
                instance_id=instance["id"],
                day_index=0,
                slot_index=4,
            ).exists()
        )
        self.assertTrue(
            MealPlanInstanceSlotMeal.objects.filter(slot=hidden_slot, meal_id=meal["id"]).exists()
        )

        self.profile.meal_slots_per_day = 5
        self.profile.save(update_fields=["meal_slots_per_day"])
        rebuild_all_instances_for_user(owner=self.user, slots_per_day=5)

        inst = self.client.get(f"/api/v1/meal/instances/{instance['id']}/").json()
        slot_row = next(
            s for s in inst["slots"] if s["day_index"] == 0 and s["slot_index"] == 4
        )
        self.assertEqual(slot_row["meal_ids"], [meal["id"]])
