# Glyph reflavor: emoji glyphs, 15 unordered-pair classes, new starters, Scrapers Gulch.

from django.db import migrations, models


OLD_CLASS_SLUGS = (
    "bulwark",
    "scoundrel",
    "magister",
    "devotee",
    "skirmisher",
    "wayfarer",
    "savant",
    "spellblade",
    "warden",
    "champion",
    "virtuoso",
    "tinker",
    "firebrand",
    "seeker",
    "physicker",
    "visionary",
    "nurse",
    "gym_rat",
)

OLD_ITEM_SLUGS = (
    "stained-jerkin",
    "tattered-cloak",
    "stuffy-robe",
    "threadbare-gown",
    "rusty-sword",
    "chipped-knife",
    "bent-staff",
    "dull-scepter",
    "denim-jacket",
    "wooden-stick",
    "soiled-suitcoat",
    "oil-stained-smock",
    "hospital-gown",
    "space-blanket",
    "wet-rags",
    "chipped-gavel",
    "greasy-wrench",
    "rusty-hacksaw",
    "stolen-blaster",
    "dessicated-branch",
)


def reflavor_data(apps, schema_editor):
    from qff.glyph_class_map import CLASSES_BY_PAIR

    Character = apps.get_model("qff", "Character")
    CharacterClass = apps.get_model("qff", "CharacterClass")
    Item = apps.get_model("qff", "Item")
    Area = apps.get_model("qff", "Area")
    Room = apps.get_model("qff", "Room")
    AreaCell = apps.get_model("qff", "AreaCell")

    Character.objects.all().delete()
    CharacterClass.objects.filter(slug__in=OLD_CLASS_SLUGS).delete()
    Item.objects.filter(slug__in=OLD_ITEM_SLUGS).delete()

    armors = [
        {
            "slug": "soiled-leathers",
            "name": "Soiled Leathers",
            "description": "Toughened scraps held together with stubborn thread.",
        },
        {
            "slug": "fleabitten-cloak",
            "name": "Fleabitten Cloak",
            "description": "Threadbare but still useful when the wind turns sharp.",
        },
        {
            "slug": "unwashed-robe",
            "name": "Unwashed Robe",
            "description": "Stained cloth that has survived too many long nights.",
        },
        {
            "slug": "bloodstained-jacket",
            "name": "Bloodstained Jacket",
            "description": "A medic's old shell, patched and repatched.",
        },
    ]

    weapons = [
        {
            "slug": "rusty-sword",
            "name": "Rusty Sword",
            "element": "physical",
            "description": "Corroded steel with a stubborn edge.",
        },
        {
            "slug": "dented-knife",
            "name": "Dented Knife",
            "element": "physical",
            "description": "A nicked blade for close work.",
        },
        {
            "slug": "broken-wand",
            "name": "Broken Wand",
            "element": "physical",
            "description": "Snapped focus, still useful as a striker.",
        },
        {
            "slug": "wooden-spoon",
            "name": "Wooden Spoon",
            "element": "physical",
            "description": "A kitchen tool turned survival weapon.",
        },
    ]

    for d in armors:
        Item.objects.update_or_create(
            slug=d["slug"],
            defaults={
                "name": d["name"],
                "item_type": "armor",
                "slot": "chest",
                "description": d["description"],
                "lore": "",
                "lore_chance": None,
                "cost": 1,
                "armor": 1,
                "damage": 0,
                "dmg_type": "physical",
                "element": "",
                "consumable": False,
            },
        )

    for d in weapons:
        Item.objects.update_or_create(
            slug=d["slug"],
            defaults={
                "name": d["name"],
                "item_type": "weapon",
                "slot": "main_hand",
                "description": d["description"],
                "lore": "",
                "lore_chance": None,
                "cost": 1,
                "armor": 0,
                "damage": 1,
                "dmg_type": "physical",
                "element": d["element"],
                "consumable": False,
            },
        )

    area, _ = Area.objects.update_or_create(
        slug="scrapers-gulch",
        defaults={
            "name": "Scrapers Gulch",
            "description": "A wide basin of rust, dust, and scavenger trails.",
            "grid_width": 15,
            "grid_height": 15,
            "theme_primary": "#c4a574",
            "theme_secondary": "#6b5344",
            "theme_accent": "#e8dcc8",
        },
    )

    room, _ = Room.objects.update_or_create(
        area=area,
        slug="dusty-path",
        defaults={
            "name": "Dusty Path",
            "description": "A narrow track through scrap and grit. The gulch opens ahead.",
            "is_spawn_point": True,
        },
    )

    AreaCell.objects.update_or_create(
        area=area,
        x=7,
        y=7,
        defaults={"room": room},
    )

    rows = sorted(CLASSES_BY_PAIR.values(), key=lambda m: m["sort_order"])
    for meta in rows:
        CharacterClass.objects.get_or_create(
            slug=meta["slug"],
            defaults={
                "name": meta["name"],
                "description": meta["description"],
                "sort_order": meta["sort_order"],
                "priority_stat_1": meta["stat_1"],
                "priority_stat_2": meta["stat_2"],
                "starter_chest_item": None,
                "starter_main_hand_item": None,
                "extra_data": {},
            },
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0034_roombroadcast_log_tone"),
    ]

    operations = [
        migrations.RunPython(reflavor_data, noop_reverse),
        migrations.AlterField(
            model_name="character",
            name="glyphs",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text=(
                    "Ordered glyph ids from character creation (emoji strings, e.g. 👽, 🤖). "
                    "Class is determined by the unordered pair; starting gear uses this order."
                ),
            ),
        ),
    ]
