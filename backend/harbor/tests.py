"""Tests for the harbor API: player state, catalog, staff CRUD + permissions."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from harbor.models import (
    HarborCatalogVersion,
    HarborGameSave,
    HarborShipDef,
)

User = get_user_model()


def _mk_user(email: str, is_staff: bool = False):
    return User.objects.create_user(
        email=email, password="secret12345", is_staff=is_staff
    )


class HarborPlayerStateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _mk_user("player@example.com")

    def test_requires_auth(self):
        r = self.client.get("/api/v1/harbor/state/")
        self.assertIn(r.status_code, (401, 403))

    def test_get_returns_blank_when_no_save_exists(self):
        self.client.force_authenticate(self.user)
        r = self.client.get("/api/v1/harbor/state/")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIsNone(body["state"])
        self.assertEqual(body["schema_version"], 1)
        self.assertIn("current_catalog_version", body)
        self.assertIn("server_time", body)

    def test_post_persists_and_is_idempotent(self):
        self.client.force_authenticate(self.user)
        payload = {
            "state": {"day": 5, "stageId": 2},
            "schema_version": 1,
            "catalog_version": 3,
        }
        first = self.client.post(
            "/api/v1/harbor/state/", payload, format="json"
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["state"], {"day": 5, "stageId": 2})
        self.assertEqual(first.json()["catalog_version"], 3)

        # POST again — upsert, not duplicate.
        again = self.client.post(
            "/api/v1/harbor/state/",
            {**payload, "state": {"day": 6, "stageId": 2}},
            format="json",
        )
        self.assertEqual(again.status_code, 200)
        self.assertEqual(HarborGameSave.objects.filter(user=self.user).count(), 1)
        self.assertEqual(again.json()["state"], {"day": 6, "stageId": 2})

    def test_post_rejects_non_object_state(self):
        self.client.force_authenticate(self.user)
        r = self.client.post(
            "/api/v1/harbor/state/",
            {"state": [1, 2, 3]},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_post_rejects_missing_state(self):
        self.client.force_authenticate(self.user)
        r = self.client.post(
            "/api/v1/harbor/state/",
            {"schema_version": 1},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_saves_are_per_user(self):
        other = _mk_user("other@example.com")
        HarborGameSave.objects.create(
            user=other, state={"day": 99}, schema_version=1, catalog_version=1
        )
        self.client.force_authenticate(self.user)
        r = self.client.get("/api/v1/harbor/state/")
        # Our user has no save; the other user's save is not leaked.
        self.assertIsNone(r.json()["state"])


class HarborCatalogTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _mk_user("player2@example.com")
        HarborShipDef.objects.create(
            slug="test-enabled",
            name="Test Enabled",
            extra={"role": "cargo"},
            enabled=True,
        )
        HarborShipDef.objects.create(
            slug="test-hidden",
            name="Test Hidden",
            extra={"role": "cargo"},
            enabled=False,
        )

    def test_requires_auth(self):
        r = self.client.get("/api/v1/harbor/catalog/")
        self.assertIn(r.status_code, (401, 403))

    def test_returns_only_enabled_rows_with_version(self):
        self.client.force_authenticate(self.user)
        r = self.client.get("/api/v1/harbor/catalog/")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("catalog_version", body)
        slugs = [ship["slug"] for ship in body["ships"]]
        self.assertIn("test-enabled", slugs)
        self.assertNotIn("test-hidden", slugs)
        # All eight def categories always present.
        for key in (
            "ships",
            "buildings",
            "operations",
            "arrivals",
            "events",
            "consequences",
            "policies",
            "doctrines",
        ):
            self.assertIn(key, body)


class HarborStaffPermissionsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = _mk_user("staff@example.com", is_staff=True)
        self.player = _mk_user("player3@example.com", is_staff=False)

    def test_schema_requires_staff(self):
        r = self.client.get("/api/v1/harbor/staff/schema/")
        self.assertIn(r.status_code, (401, 403))

        self.client.force_authenticate(self.player)
        r = self.client.get("/api/v1/harbor/staff/schema/")
        self.assertEqual(r.status_code, 403)

        self.client.force_authenticate(self.staff)
        r = self.client.get("/api/v1/harbor/staff/schema/")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("resources", body)
        self.assertIn("stages", body)

    def test_def_list_requires_staff(self):
        self.client.force_authenticate(self.player)
        r = self.client.get("/api/v1/harbor/staff/ships/")
        self.assertEqual(r.status_code, 403)

    def test_unknown_def_type_404(self):
        self.client.force_authenticate(self.staff)
        r = self.client.get("/api/v1/harbor/staff/widgets/")
        self.assertEqual(r.status_code, 404)


class HarborStaffCrudTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = _mk_user("staff2@example.com", is_staff=True)
        self.client.force_authenticate(self.staff)

    def test_full_crud_cycle_for_ships(self):
        created = self.client.post(
            "/api/v1/harbor/staff/ships/",
            {
                "slug": "test-trader",
                "name": "Trader",
                "stage_min": 1,
                "tags": ["starter"],
                "extra": {"role": "cargo", "capacity": 3, "hull": 2},
                "enabled": True,
                "sort_order": 10,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        pk = created.json()["id"]

        listed = self.client.get("/api/v1/harbor/staff/ships/")
        self.assertEqual(listed.status_code, 200)
        slugs = [r["slug"] for r in listed.json()]
        self.assertIn("test-trader", slugs)

        patched = self.client.patch(
            f"/api/v1/harbor/staff/ships/{pk}/",
            {"name": "Big Trader", "stage_min": 2},
            format="json",
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.json()["name"], "Big Trader")
        self.assertEqual(patched.json()["stage_min"], 2)

        deleted = self.client.delete(f"/api/v1/harbor/staff/ships/{pk}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(HarborShipDef.objects.filter(pk=pk).exists())

    def test_duplicate_slug_rejected(self):
        HarborShipDef.objects.create(slug="test-dup", name="One")
        r = self.client.post(
            "/api/v1/harbor/staff/ships/",
            {"slug": "test-dup", "name": "Two"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_missing_slug_or_name_rejected(self):
        r = self.client.post(
            "/api/v1/harbor/staff/ships/", {"slug": "", "name": ""}, format="json"
        )
        self.assertEqual(r.status_code, 400)

    def test_stage_min_clamped_to_1_12(self):
        created = self.client.post(
            "/api/v1/harbor/staff/ships/",
            {"slug": "test-wild", "name": "Wild", "stage_min": 99},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["stage_min"], 12)

    def test_import_export_roundtrip(self):
        HarborShipDef.objects.create(
            slug="test-alpha", name="Alpha", extra={"role": "cargo"}
        )
        HarborShipDef.objects.create(
            slug="test-beta", name="Beta", extra={"role": "cargo"}
        )
        exported = self.client.get("/api/v1/harbor/staff/ships/export/")
        self.assertEqual(exported.status_code, 200)
        rows = exported.json()["rows"]
        self.assertGreaterEqual(len(rows), 2)

        # Mutate one row in the import payload to test upsert behavior.
        for row in rows:
            if row["slug"] == "test-alpha":
                row["name"] = "Alpha Prime"
        rows.append(
            {"slug": "test-gamma", "name": "Gamma", "extra": {"role": "cargo"}}
        )

        imported = self.client.post(
            "/api/v1/harbor/staff/ships/import/",
            {"rows": rows},
            format="json",
        )
        self.assertEqual(imported.status_code, 200)
        body = imported.json()
        self.assertGreaterEqual(body["updated"], 2)
        self.assertEqual(body["created"], 1)
        self.assertEqual(body["errors"], [])

        self.assertEqual(
            HarborShipDef.objects.get(slug="test-alpha").name, "Alpha Prime"
        )
        self.assertTrue(HarborShipDef.objects.filter(slug="test-gamma").exists())

    def test_import_reports_errors_per_row(self):
        r = self.client.post(
            "/api/v1/harbor/staff/ships/import/",
            {"rows": [{"slug": "", "name": ""}, "not-an-object"]},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()["errors"]), 2)


class HarborCatalogVersionBumpTests(TestCase):
    """Ensure saving or deleting any def row bumps HarborCatalogVersion."""

    def test_version_bumps_on_save_and_delete(self):
        before = HarborCatalogVersion.objects.filter(id=1).first()
        before_v = before.version if before else 0

        HarborShipDef.objects.create(slug="test-bumpy", name="Bumpy")
        after_save = HarborCatalogVersion.objects.get(id=1).version
        self.assertGreater(after_save, before_v)

        HarborShipDef.objects.filter(slug="test-bumpy").delete()
        after_delete = HarborCatalogVersion.objects.get(id=1).version
        self.assertGreater(after_delete, after_save)
