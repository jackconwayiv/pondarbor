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
            "slug": "soiled-suitcoat",
            "name": "Soiled Suitcoat",
            "description": "A grimy coat that still counts as armor.",
        },
        {
            "slug": "oil-stained-smock",
            "name": "Oil-Stained Smock",
            "description": "Workshop grease never quite washes out.",
        },
        {
            "slug": "hospital-gown",
            "name": "Hospital Gown",
            "description": "Thin fabric; better than nothing.",
        },
        {
            "slug": "space-blanket",
            "name": "Space Blanket",
            "description": "Crinkly foil that might deflect a glancing blow.",
        },
        {
            "slug": "wet-rags",
            "name": "Wet Rags",
            "description": "Layers of soaked cloth, heavy and clinging.",
        },
    ]

    weapons = [
        {
            "slug": "chipped-gavel",
            "name": "Chipped Gavel",
            "element": "bludgeoning",
            "description": "Authority you can swing.",
        },
        {
            "slug": "greasy-wrench",
            "name": "Greasy Wrench",
            "element": "bludgeoning",
            "description": "Adjusts nuts, skulls, and morale.",
        },
        {
            "slug": "rusty-hacksaw",
            "name": "Rusty Hacksaw",
            "element": "slashing",
            "description": "Teeth meant for softer things than armor.",
        },
        {
            "slug": "stolen-blaster",
            "name": "Stolen Blaster",
            "element": "piercing",
            "description": "Low charge; still points the right way.",
        },
        {
            "slug": "dessicated-branch",
            "name": "Dessicated Branch",
            "element": "bludgeoning",
            "description": "Dry wood, heavy enough to sting.",
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
