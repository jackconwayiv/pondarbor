"""Untranslated readables: /read requires 👽 for text; look/inspect use inspect_text only."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from qff.command_handlers import execute_command
from qff.command_parser import parse_command
from qff.models import Area, Character, CharacterClass, Interactable, Room

User = get_user_model()


class UntranslatedReadableTests(TestCase):
    def setUp(self):
        self.area = Area.objects.create(
            name="UtArea",
            slug="ut-area",
            grid_width=1,
            grid_height=1,
        )
        self.room = Room.objects.create(area=self.area, name="UtRoom", slug="ut-room")
        self.cc = CharacterClass.objects.create(slug="ut-class", name="Fighter", sort_order=0)
        u = User.objects.create_user(email="ut@readable.test", password="secret12345")
        self.char = Character.objects.create(
            user=u,
            name="Reader",
            character_class=self.cc,
            current_room=self.room,
            spawn_room=self.room,
            last_activity_at=timezone.now(),
            cur_health=5,
            max_health=10,
        )
        self.stone = Interactable.objects.create(
            room=self.room,
            slug="alien-plaque",
            name="alien plaque",
            kind=Interactable.Kind.READABLE,
            inspect_text="A dark slab covered in symbols.",
            read_text="BEWARE THE VOID",
            untranslated=True,
        )

    def test_read_without_glyph_denies_without_spoiler(self):
        lines = execute_command(self.char, parse_command("read alien"))
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0], "You don't understand the alien language.")
        self.assertNotIn("BEWARE", lines[0])

    def test_read_with_glyph_shows_read_text(self):
        self.char.glyphs = ["👽"]
        self.char.save(update_fields=["glyphs", "updated_at"])
        lines = execute_command(self.char, parse_command("read alien"))
        self.assertEqual(lines, ["BEWARE THE VOID"])

    def test_look_shows_inspect_not_block(self):
        lines = execute_command(self.char, parse_command("look alien"))
        self.assertTrue(any("slab" in ln.lower() or "symbols" in ln.lower() for ln in lines), lines)

    def test_inspect_shows_inspect_not_block(self):
        lines = execute_command(self.char, parse_command("inspect alien"))
        self.assertTrue(any("slab" in ln.lower() or "symbols" in ln.lower() for ln in lines), lines)

    def test_untranslated_empty_read_text_read_says_nothing_look_shows_inspect(self):
        Interactable.objects.create(
            room=self.room,
            slug="alien-note",
            name="alien note",
            kind=Interactable.Kind.READABLE,
            inspect_text="Cold to the touch.",
            read_text="",
            untranslated=True,
        )
        read_lines = execute_command(self.char, parse_command("read note"))
        self.assertEqual(read_lines, ["There is nothing to read."])
        look_lines = execute_command(self.char, parse_command("look note"))
        self.assertTrue(any("cold" in ln.lower() for ln in look_lines), look_lines)
