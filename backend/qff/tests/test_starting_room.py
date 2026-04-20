"""Default starting room selection for new characters."""

from django.test import TestCase

from qff.constants import (
    DEFAULT_START_AREA_SLUGS,
    DEFAULT_START_ROOM_NAME,
    LEGACY_START_AREA_SLUGS,
    LEGACY_START_ROOM_NAME,
)
from qff.models import Area, Room
from qff.views import _starting_room


class StartingRoomTests(TestCase):
    def setUp(self):
        # Migration 0035 seeds Scrapers Gulch for production; tests own hub layout.
        Area.objects.filter(slug__in=("scrapers-gulch", "scrapers_gulch")).delete()

    def test_prefers_scrapers_gulch_dusty_path_when_present(self):
        other = Area.objects.create(name="Other", slug="other-area", grid_width=1, grid_height=1)
        first = Room.objects.create(area=other, name="First", slug="first")
        camp = Area.objects.create(
            name="Scrapers Gulch",
            slug=DEFAULT_START_AREA_SLUGS[0],
            grid_width=1,
            grid_height=1,
        )
        dusty = Room.objects.create(
            area=camp,
            name=DEFAULT_START_ROOM_NAME,
            slug="dusty-path",
        )
        self.assertEqual(_starting_room().pk, dusty.pk)
        self.assertNotEqual(_starting_room().pk, first.pk)

    def test_matches_case_insensitive_room_name(self):
        camp = Area.objects.create(
            name="Scrapers Gulch",
            slug=DEFAULT_START_AREA_SLUGS[0],
            grid_width=1,
            grid_height=1,
        )
        dusty = Room.objects.create(
            area=camp,
            name="dusty path",
            slug="dp",
        )
        self.assertEqual(_starting_room().pk, dusty.pk)

    def test_matches_alternate_area_slug_underscore(self):
        camp = Area.objects.create(
            name="Scrapers Gulch",
            slug="scrapers_gulch",
            grid_width=1,
            grid_height=1,
        )
        dusty = Room.objects.create(
            area=camp,
            name=DEFAULT_START_ROOM_NAME,
            slug="dusty-path",
        )
        self.assertEqual(_starting_room().pk, dusty.pk)

    def test_matches_by_room_slug_when_name_differs(self):
        camp = Area.objects.create(
            name="Scrapers Gulch",
            slug=DEFAULT_START_AREA_SLUGS[0],
            grid_width=1,
            grid_height=1,
        )
        dusty = Room.objects.create(
            area=camp,
            name="Dust patch",
            slug="dusty-path",
        )
        self.assertEqual(_starting_room().pk, dusty.pk)

    def test_matches_by_area_display_name_fallback(self):
        camp = Area.objects.create(
            name="Scrapers Gulch",
            slug="custom-gulch-slug",
            grid_width=1,
            grid_height=1,
        )
        dusty = Room.objects.create(
            area=camp,
            name=DEFAULT_START_ROOM_NAME,
            slug="vb",
        )
        self.assertEqual(_starting_room().pk, dusty.pk)

    def test_falls_back_to_legacy_village_well(self):
        noise = Area.objects.create(name="X", slug="x", grid_width=1, grid_height=1)
        Room.objects.create(area=noise, name="Alpha", slug="alpha")
        ort = Area.objects.create(
            name="Ort",
            slug=LEGACY_START_AREA_SLUGS[0],
            grid_width=1,
            grid_height=1,
        )
        well = Room.objects.create(
            area=ort,
            name=LEGACY_START_ROOM_NAME,
            slug="village-well",
        )
        self.assertEqual(_starting_room().pk, well.pk)

    def test_falls_back_to_lowest_pk_when_no_named_starts(self):
        a = Area.objects.create(name="A", slug="a", grid_width=1, grid_height=1)
        r1 = Room.objects.create(area=a, name="R1", slug="r1")
        Room.objects.create(area=a, name="R2", slug="r2")
        self.assertEqual(_starting_room().pk, r1.pk)
